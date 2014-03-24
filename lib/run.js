/* ===========================================================
# sphere-product-mapper - v0.1.6
# ==============================================================
# Copyright (c) 2014 Oleg Ilyenko
# Licensed MIT.
*/
var Mapper, ProjectCredentialsConfig, Q, argv, mapping, optimist, package_json, required, sphere_transformer, startTime, transformer, util, _;

Q = require('q');

_ = require('underscore')._;

util = require('../lib/util');

package_json = require('../package.json');

ProjectCredentialsConfig = require('sphere-node-utils').ProjectCredentialsConfig;

optimist = require('optimist').usage('Usage: $0 --mapping [mapping.json]').alias('projectKey', 'k').alias('clientId', 'i').alias('clientSecret', 's').alias('help', 'h').alias('mapping', 'm').alias('dryRun', 'd').describe('help', 'Shows usage info and exits.').describe('projectKey', 'Sphere.io project key (required if you use sphere-specific value transformers).').describe('clientId', 'Sphere.io HTTP API client id (required if you use sphere-specific value transformers).').describe('clientSecret', 'Sphere.io HTTP API client secret (required if you use sphere-specific value transformers).').describe('inCsv', 'The input product CSV file (optional, STDIN would be used if not specified).').describe('outCsv', 'The output product CSV file (optional, STDOUT would be used if not specified).').describe('csvDelimiter', 'CSV delimiter (by default ,).').describe('csvQuote', 'CSV quote (by default ").').describe('mapping', 'Mapping JSON file or URL.').describe('group', "The column group that should be used.").describe('additionalOutCsv', 'Addition output CSV files separated by comma `,` and optionally prefixed with `groupName:`.').describe('timeout', 'Set timeout for requests').describe('dryRun', 'No external side-effects would be performed (also sphere services would generate mocked values)').describe('attemptsOnConflict', 'Number of attempts to update the project in case of conflict (409 HTTP status)').describe('disableAsserts', 'disable asserts (e.g.: required)')["default"]('timeout', 300000)["default"]('group', "default")["default"]('dryRun', false)["default"]('attemptsOnConflict', 10).demand(['mapping']);

Mapper = require('../main').Mapper;

transformer = require('../main').transformer;

sphere_transformer = require('../main').sphere_transformer;

mapping = require('../main').mapping;

argv = optimist.argv;

startTime = new Date().getTime();

if (argv.help) {
  optimist.showHelp();
  process.exit(0);
}

required = argv.disableAsserts ? new transformer.AdditionalOptionsWrapper(transformer.RequiredTransformer, {
  disable: true
}) : transformer.RequiredTransformer;

Q.spread([util.loadFile(argv.mapping), ProjectCredentialsConfig.create()], function(mappingText, credentialsConfig) {
  var additionalTransformers, repeatOnDuplicateSku, sphereSequence, sphereService;
  additionalTransformers = (argv.projectKey != null) || argv.dryRun ? (sphereService = argv.dryRun ? new sphere_transformer.OfflineSphereService : new sphere_transformer.SphereService({
    connector: {
      config: credentialsConfig.enrichCredentials({
        project_key: argv.projectKey,
        client_id: argv.clientId,
        client_secret: argv.clientSecret
      }),
      timeout: argv.timeout,
      user_agent: "" + package_json.name + " - " + package_json.version
    },
    repeater: {
      attempts: argv.attemptsOnConflict,
      timeout: 100
    }
  }), sphereSequence = new transformer.AdditionalOptionsWrapper(sphere_transformer.SphereSequenceTransformer, {
    sphereService: sphereService
  }), repeatOnDuplicateSku = new transformer.AdditionalOptionsWrapper(sphere_transformer.RepeatOnDuplicateSkuTransformer, {
    sphereService: sphereService
  }), [sphereSequence, repeatOnDuplicateSku]) : [];
  return new mapping.Mapping({
    mappingConfig: JSON.parse(mappingText),
    transformers: transformer.defaultTransformers.concat(additionalTransformers).concat([required]),
    columnMappers: mapping.defaultColumnMappers
  }).init();
}).then(function(mapping) {
  return new Mapper({
    inCsv: argv.inCsv,
    outCsv: argv.outCsv,
    csvDelimiter: argv.csvDelimiter,
    csvQuote: argv.csvQuote,
    mapping: mapping,
    group: argv.group,
    additionalOutCsv: util.parseAdditionalOutCsv(argv.additionalOutCsv)
  }).run();
}).then(function(count) {
  var endTime;
  endTime = new Date().getTime();
  console.error("\n\nProcessed " + count + " lines in " + (endTime - startTime) + " ms.");
  return process.exit(0);
}).fail(function(error) {
  console.error(error.stack);
  return process.exit(1);
}).done();
