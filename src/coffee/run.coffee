Q = require 'q'
{_} = require 'underscore'

{util, transformer, mapping, Mapper} = require 'csv-mapper'
{ProjectCredentialsConfig} = require 'sphere-node-utils'

package_json = require '../package.json'

optimist = require('optimist')
.usage('Usage: $0 --mapping [mapping.json]')
.alias('projectKey', 'k')
.alias('clientId', 'i')
.alias('clientSecret', 's')
.alias('help', 'h')
.alias('mapping', 'm')
.alias('dryRun', 'd')
.describe('help', 'Shows usage info and exits.')
.describe('projectKey', 'Sphere.io project key (required if you use sphere-specific value transformers).')
.describe('clientId', 'Sphere.io HTTP API client id (required if you use sphere-specific value transformers).')
.describe('clientSecret', 'Sphere.io HTTP API client secret (required if you use sphere-specific value transformers).')
.describe('inCsv', 'The input product CSV file (optional, STDIN would be used if not specified).')
.describe('outCsv', 'The output product CSV file (optional, STDOUT would be used if not specified).')
.describe('csvDelimiter', 'CSV delimiter (by default ,).')
.describe('inCsvDelimiter', 'CSV delimiter in input file (by default csvDelimiter is used).')
.describe('outCsvDelimiter', 'CSV delimiter in output files (by default csvDelimiter is used).')
.describe('csvQuote', 'CSV quote (by default ").')
.describe('mapping', 'Mapping JSON file or URL.')
.describe('group', "The column group that should be used.")
.describe('additionalOutCsv', 'Addition output CSV files separated by comma `,` and optionally prefixed with `groupName:`.')
.describe('timeout', 'Set timeout for requests')
.describe('dryRun', 'No external side-effects would be performed (also sphere services would generate mocked values)')
.describe('attemptsOnConflict', 'Number of attempts to update the project in case of conflict (409 HTTP status)')
.describe('disableAsserts', 'disable asserts (e.g.: required)')
.default('timeout', 300000)
.default('group', "default")
.default('dryRun', false)
.default('attemptsOnConflict', 10)
.demand(['mapping'])

sphere_transformer = require('../main').sphere_transformer

argv = optimist.argv
startTime = new Date().getTime()

if (argv.help)
  optimist.showHelp()
  process.exit 0

required =
  if argv.disableAsserts
    new transformer.AdditionalOptionsWrapper transformer.RequiredTransformer,
      disable: true
  else
    transformer.RequiredTransformer


Q.spread [util.loadFile(argv.mapping), ProjectCredentialsConfig.create()], (mappingText, credentialsConfig) ->
  additionalTransformers =
    if argv.projectKey? or argv.dryRun
      sphereService =
        if argv.dryRun
          new sphere_transformer.OfflineSphereService
        else
          new sphere_transformer.SphereService
            connector:
              config: credentialsConfig.enrichCredentials
                project_key: argv.projectKey
                client_id: argv.clientId
                client_secret: argv.clientSecret
              timeout: argv.timeout
              user_agent: "#{package_json.name} - #{package_json.version}"
            repeater:
              attempts: argv.attemptsOnConflict
              timeout: 100

      sphereSequence = new transformer.AdditionalOptionsWrapper sphere_transformer.SphereSequenceTransformer,
        sphereService: sphereService
      repeatOnDuplicateSku = new transformer.AdditionalOptionsWrapper sphere_transformer.RepeatOnDuplicateSkuTransformer,
        sphereService: sphereService

      [sphereSequence, repeatOnDuplicateSku]
    else
      []

  new mapping.Mapping
    mappingConfig: JSON.parse(mappingText)
    transformers: transformer.defaultTransformers.concat(additionalTransformers).concat([required])
    columnMappers: mapping.defaultColumnMappers
  .init()
.then (mapping) ->
  new Mapper
    inCsv: argv.inCsv
    outCsv: argv.outCsv
    csvDelimiter: argv.csvDelimiter
    inCsvDelimiter: argv.inCsvDelimiter
    outCsvDelimiter: argv.outCsvDelimiter
    csvQuote: argv.csvQuote
    mapping: mapping
    group: argv.group
    additionalOutCsv: util.parseAdditionalOutCsv(argv.additionalOutCsv)
  .run()
.then (count) ->
  endTime = new Date().getTime()
  console.error "\n\nProcessed #{count} lines in #{endTime - startTime} ms."
  process.exit 0
.fail (error) ->
  console.error error.stack
  process.exit 1
.done()
