Q = require 'q'
csv = require 'csv'

_ = require('underscore')._
_s = require 'underscore.string'

util = require '../lib/util'

class ColumnMapping
  @create: (options) -> util.abstractMethod() # promise with mapplig
  @supports: (options) -> util.abstractMethod() # boolean - whether options are supported

  map: (origRow, accRow) -> util.abstractMethod() # mapped row promice
  transformHeader: (headerAccumulator, originalHeader) -> util.abstractMethod() # array of string with the new updated header
  priority: () -> util.abstractMethod() # int

  _initValueTransformers: (transformers, transformerConfig) ->
    if transformerConfig
      promises = _.map transformerConfig, (config) ->
        found  = _.find transformers, (t) -> t.supports(config)

        if found
          found.create config
        else
          throw new Error("unsupported value transformer type: #{config.type}")

      Q.all promises
    else
      Q([])

  _transformValue: (valueTransformers, value) ->
    safeValue = if util.nonEmpty(value) then value else ''
    _.reduce valueTransformers, ((acc, transformer) -> transformer.transform(acc)), safeValue

class CopyFromOriginalTransformer extends ColumnMapping
  @create: (transformers, options) ->
    Q(new CopyFromOriginalTransformer(transformers, options))

  @supports: (options) ->
    options.type is 'copyFromOriginal'

  constructor: (transformers, options) ->
    @_includeCols = options.includeCols
    @_excludeCols = options.excludeCols
    @_priority = options.priority

  map: (origRow, accRow) ->
    reduceFn = (acc, name) =>
      if @_include(name)
        acc[name] = origRow[name]

      acc

    Q(_.reduce(_.keys(origRow), reduceFn, accRow))

  _include: (name) ->
    (not @_includeCols or _.contains(@_includeCols, name)) and (not @_excludeCols or not _.contains(@_excludeCols, name))

  transformHeader: (headerAccumulator, originalHeader) ->
    headerAccumulator.concat _.filter(originalHeader, ((name) => @_include(name)))

  priority: () ->
    @_priority or 1000

class RemoveColumnsTransformer extends ColumnMapping
  @create: (transformers, options) ->
    Q(new RemoveColumnsTransformer(transformers, options))

  @supports: (options) ->
    options.type is 'removeColumns'

  constructor: (transformers, options) ->
    @_cols = options.cols or []

  map: (origRow, accRow) ->
    reduceFn = (acc, name) =>
      if _.contains(@_cols, name)
        delete acc[name]

      acc

    Q(_.reduce(_.keys(accRow), reduceFn, accRow))

  transformHeader: (headerAccumulator, originalHeader) ->
    _.filter(headerAccumulator, ((name) => not _.contains(@_cols, name)))

  priority: () ->
    @_priority or 1500

class ColumnTransformer extends ColumnMapping
  @create: (transformers, options) ->
    (new ColumnTransformer(transformers, options))._init()

  @supports: (options) ->
    options.type is 'columnTransformer'

  constructor: (transformers, options) ->
    @_transformers = transformers

    @_fromCol = options.fromCol
    @_toCol = options.toCol
    @_priority = options.priority
    @_valueTransformersConfig = options.valueTransformers

  _init: () ->
    @_initValueTransformers @_transformers, @_valueTransformersConfig
    .then (vt) =>
      @_valueTransformers = vt
      this

  map: (origRow, accRow) ->
    value = if accRow[@_fromCol] then accRow[@_fromCol] else origRow[@_fromCol]

    try
      accRow[@_toCol] = @_transformValue(@_valueTransformers, value)
    catch error
      throw new Error("Error during mapping from column '#{@_fromCol}' to column '#{@_toCol}' with current value '#{value}': #{error.message}")

    Q(accRow)

  transformHeader: (headerAccumulator, originalHeader) ->
    headerAccumulator.concat [@_toCol]

  priority: () ->
    @_priority or 2000

class ColumnGenerator extends ColumnMapping
  @create: (transformers, options) ->
    (new ColumnGenerator(transformers, options))._init()

  @supports: (options) ->
    options.type is 'columnGenerator'

  constructor: (transformers, options) ->
    @_transformers = transformers

    @_toCol = options.toCol
    @_projectUnique = options.projectUnique
    @_synonymAttribute = options.synonymAttribute
    @_parts = _.clone options.parts
    @_priority = options.priority

  _init: () ->
    promises = _.map @_parts, (part) =>
      @_initValueTransformers @_transformers, part.valueTransformers
      .then (vt) ->
        part.valueTransformers = vt
        part

    Q.all promises
    .then (parts) =>
      this

  map: (origRow, accRow) ->
    partialValues = _.map @_parts, (part, idx) =>
      {size, pad, fromCol, valueTransformers} = part

      value = if accRow[fromCol] then accRow[fromCol] else origRow[fromCol]

      transformed = try
        @_transformValue(valueTransformers, value)
      catch error
        throw new Error("Error during mapping from column '#{fromCol}' to a generated column '#{@_toCol}' (part #{idx}) with current value '#{value}': #{error.message}")

      if transformed.length < size and pad
        _s.pad(transformed, size, pad)
      else if transformed.length is size
        transformed
      else
        throw new Error("Generated column part size (#{transformed.length} - '#{transformed}') is smaller than expected size (#{size}) and no padding is defined for this column. Source column '#{fromCol}', generated column '#{@_toCol}' (part #{idx}) with current value '#{value}'.")

    finalValue = partialValues.join ''

    # TODO: check @_synonymAttribute and @_projectUnique in SPHERE project!

    accRow[@_toCol] = finalValue

    Q(accRow)

  transformHeader: (headerAccumulator, originalHeader) ->
    headerAccumulator.concat [@_toCol]

  priority: () ->
    @_priority or 3000

###
  Transforms one object into another object accoring to the mapping configuration

  Options:
    mappingFile
    transformers
    columnMappers
###
class Mapping
  constructor: (options) ->
    @_mappingFile = options.mappingFile
    @_transformers = options.transformers
    @_columnMappers = options.columnMappers

  init: () ->
    util.loadFile @_mappingFile
    .then (contents) =>
      @_constructMapping(JSON.parse(contents))
    .then (mapping) =>
      @_columnMapping = mapping
      this

  _constructMapping: (mappingJson) ->
    columnPromises = _.map mappingJson.columnMapping, (elem) =>
      found = _.find @_columnMappers, (mapper) -> mapper.supports(elem)

      if found
        found.create(@_transformers, elem)
      else
        throw new Error("Unsupported column mapping type: #{elem.type}")

    Q.all columnPromises

  transformHeader: (columnNames) ->
    _.reduce @_columnMapping, ((acc, mapping) -> mapping.transformHeader(acc, columnNames)), []

  transformRow: (row) ->
    mappingsSorted = _.sortBy @_columnMapping, (mapping) -> mapping.priority()

    _.reduce mappingsSorted, ((accRowPromise, mapping) -> accRowPromise.then((accRow) -> mapping.map(row, accRow))), Q({})

module.exports =
  ColumnMapping: ColumnMapping
  ColumnTransformer: ColumnTransformer
  CopyFromOriginalTransformer: CopyFromOriginalTransformer
  RemoveColumnsTransformer: RemoveColumnsTransformer
  ColumnGenerator: ColumnGenerator
  Mapping: Mapping
  defaultColumnMappers: [
    ColumnTransformer,
    CopyFromOriginalTransformer,
    RemoveColumnsTransformer
    ColumnGenerator
  ]