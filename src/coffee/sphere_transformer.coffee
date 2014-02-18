Q = require 'q'
csv = require 'csv'

_ = require('underscore')._
_s = require 'underscore.string'

util = require '../lib/util'

{Rest} = require('sphere-node-connect')
{Repeater} = require('../lib/repeater')
{BatchTaskQueue} = require('../lib/task_queue')

class SphereSequenceTransformer extends transformer.ValueTransformer
  @create: (transformers, options) ->
    Q(new SphereSequenceTransformer(transformers, options))

  @supports: (options) ->
    options.type is 'sphereSequence'

  constructor: (transformers, options) ->
    @_sphere = options.sphereService

    @_sequenceOptions =
      name: options.name
      initial: options.initial
      max: options.max
      min: options.min
      increment: options.increment
      rotate: options.rotate

  transform: (value, row) ->
    @_sphere.getAndIncrementCounter @_sequenceOptions

class RepeatOnDuplicateSkuTransformer extends transformer.ValueTransformer
  @create: (transformers, options) ->
    (new RepeatOnDuplicateSkuTransformer(transformers, options))._init()

  @supports: (options) ->
    options.type is 'repeatOnDuplicateSku'

  constructor: (transformers, options) ->
    @_transformers = transformers
    @_sphere = options.sphereService
    @_attempts = options.attempts
    @_valueTransformersConfig = options.valueTransformers

  _init: ->
    util.initValueTransformers @_transformers, @_valueTransformersConfig
    .then (vt) =>
      @_valueTransformers = vt
      this

  transform: (value, row) ->
    @_sphere.repeatOnDuplicateSku
      attempts: @_attempts
      valueFn: () =>
        util.transformValue @_valueTransformers, value, row
        .then (newValue) =>
          @_sphere.checkUniqueSku newValue


class ErrorStatusCode extends Error
  constructor: (@code, @body) ->
    @message = "Status code is #{@code}: #{JSON.stringify @body}"
    @name = 'ErrorStatusCode'
    Error.captureStackTrace this, this

class DuplicateSku extends Error
  constructor: (sku) ->
    @message = "Duplicate SKU '#{sku}'"
    @name = 'DuplicateSku'
    Error.captureStackTrace this, this

class OfflineSphereService
  constructor: (options) ->
    @_counters = []

  getAndIncrementCounter: (options) ->
    counter = _.find @_counters, (c) -> c.name is options.name

    if not counter
      counter = _.clone options
      counter.currentValue = counter.initial
      @_counters.push counter

    counter.currentValue = @_nexCounterValue counter

    Q(counter.currentValue)

  _nexCounterValue: (config) ->
    newVal = config.currentValue + config.increment

    if (newVal > config.max or newVal < config.min) and not config.rotate
      throw new Error("Sequence '#{config.name}' is exhausted! #{JSON.stringify config}")
    else if newVal > config.max
      min
    else if newVal < config.min
      max
    else
      newVal

  repeatOnDuplicateSku: (options) ->
    options.valueFn()

  checkUniqueSku: (sku) ->
    Q(sku)

class SphereService
  constructor: (options) ->
    @_sequenceNamespace = "sequence"

    @_client = new Rest options.connector
    @_repeater = new Repeater options.repeater
    @_incrementQueues = []

  getAndIncrementCounter: (options) ->
    @_getIncrementQueue(options).addTask options

  repeatOnDuplicateSku: (options) ->
    new Repeater
      attempts: options.attempts
      timeout: 0
      timeoutType: 'constant'
    .execute
      recoverableError: (e) -> e instanceof DuplicateSku
      task: options.valueFn

  checkUniqueSku: (sku) ->
    projectionQuery = """masterVariant(sku="#{sku}") or variants(sku="#{sku}")"""
    query = "masterData(current(#{projectionQuery}) or staged(#{projectionQuery}))"

    @_get "/products?limit=1&where=#{encodeURIComponent query}"
    .then (json) ->
      if json.total > 0
        throw new DuplicateSku(sku)
      else
        sku

  _getIncrementQueue: (options) ->
    queue = _.find @_incrementQueues, (q) -> q.name is options.name

    if not queue
      queue = new BatchTaskQueue
        taskFn: _.bind(@_doGetAndIncrementCounter, this)

      @_incrementQueues.push {name: options.name, queue: queue}
      queue
    else
      queue.queue

  _get: (path) ->
    d = Q.defer()

    @_client.GET path, (error, response, body) ->
      if error
        d.reject error
      else if response.statusCode is 200
        d.resolve body
      else
        d.reject new ErrorStatusCode(response.statusCode, body)

    d.promise

  _post: (path, json) ->
    d = Q.defer()

    @_client.POST path, json, (error, response, body) ->
      if error
        d.reject error
      else if response.statusCode is 200 or response.statusCode is 201
        d.resolve body
      else
        d.reject new ErrorStatusCode(response.statusCode, body)

    d.promise

  _incrementCounter: (json, defers) ->
    val = json.value
    values = _.map defers, (d) =>
      nextVal = @_nexCounterValue(val)
      val.currentValue = nextVal
      nextVal

    @_post "/custom-objects", json
    .then (obj) ->
      _.each defers, (d, idx) -> d.resolve(values[idx])
      values

  _nexCounterValue: (config) ->
    newVal = config.currentValue + config.increment

    if (newVal > config.max or newVal < config.min) and not config.rotate
      throw new Error("Sequence '#{config.name}' is exhausted! #{JSON.stringify config}")
    else if newVal > config.max
      min
    else if newVal < config.min
      max
    else
      newVal

  _createSequence: (options) ->
    @_post "/custom-objects",
      container: @_sequenceNamespace
      key: options.name,
      value:
        name: options.name
        initial: options.initial
        max: options.max
        min: options.min
        increment: options.increment
        rotate: options.rotate
        currentValue: options.initial

  _doGetAndIncrementCounter: (tasks) ->
    @_repeater.execute
      recoverableError: (e) -> e instanceof ErrorStatusCode and e.code is 409
      task: () =>
        @_get "/custom-objects/#{@_sequenceNamespace}/#{tasks[0].options.name}"
        .then (json) =>
          @_incrementCounter(json, _.map(tasks, (t) -> t.defer))
        .fail (error) =>
          if error instanceof ErrorStatusCode and error.code is 404
            @_createSequence(tasks[0].options)
            .then (json) =>
              @_incrementCounter(json, _.map(tasks, (t) -> t.defer))
          else
            throw error

module.exports =
  SphereSequenceTransformer: SphereSequenceTransformer
  RepeatOnDuplicateSkuTransformer: RepeatOnDuplicateSkuTransformer
  SphereService: SphereService
  OfflineSphereService: OfflineSphereService
  DuplicateSku: DuplicateSku