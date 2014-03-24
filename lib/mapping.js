/* ===========================================================
# sphere-product-mapper - v0.1.6
# ==============================================================
# Copyright (c) 2014 Oleg Ilyenko
# Licensed MIT.
*/
var ColumnMapping, ColumnTransformer, CopyFromOriginalTransformer, Mapping, Q, RemoveColumnsTransformer, csv, util, _, _s,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Q = require('q');

csv = require('csv');

_ = require('underscore')._;

_s = require('underscore.string');

util = require('../lib/util');

ColumnMapping = (function() {
  ColumnMapping.create = function(options) {
    return util.abstractMethod();
  };

  ColumnMapping.supports = function(options) {
    return util.abstractMethod();
  };

  function ColumnMapping(transformers, options) {
    this._transformers = transformers;
    this._priority = options.priority;
    this._groups = options.groups || [util.defaultGroup()];
  }

  ColumnMapping.prototype.map = function(origRow, accRow) {
    return util.abstractMethod();
  };

  ColumnMapping.prototype.transformHeader = function(headerAccumulator, originalHeader) {
    return util.abstractMethod();
  };

  ColumnMapping.prototype._defaultPriority = function() {
    return util.abstractMethod();
  };

  ColumnMapping.prototype.priority = function() {
    return this._priority || this._defaultPriority();
  };

  ColumnMapping.prototype.supportsGroup = function(group) {
    return _.contains(this._groups, group);
  };

  ColumnMapping.prototype._getPropertyForGroup = function(origRow, accRow, name) {
    var found, virtualRow;
    found = _.find(accRow, (function(_this) {
      return function(acc) {
        return _this.supportsGroup(acc.group) && acc.row[name];
      };
    })(this));
    if (found) {
      return found.row[name];
    } else {
      virtualRow = _.find(accRow, function(acc) {
        return acc.group === util.virtualGroup();
      });
      if (virtualRow && virtualRow.row[name]) {
        return virtualRow.row[name];
      } else {
        return origRow[name];
      }
    }
  };

  ColumnMapping.prototype._updatePropertyInGroups = function(accRow, name, value) {
    return _.each(accRow, (function(_this) {
      return function(acc) {
        if (_this.supportsGroup(acc.group)) {
          return acc.row[name] = value;
        }
      };
    })(this));
  };

  ColumnMapping.prototype._containsSupportedGroup = function(accRow) {
    return _.find(accRow, (function(_this) {
      return function(acc) {
        return _this.supportsGroup(acc.group);
      };
    })(this));
  };

  return ColumnMapping;

})();

CopyFromOriginalTransformer = (function(_super) {
  __extends(CopyFromOriginalTransformer, _super);

  CopyFromOriginalTransformer.create = function(transformers, options) {
    return Q(new CopyFromOriginalTransformer(transformers, options));
  };

  CopyFromOriginalTransformer.supports = function(options) {
    return options.type === 'copyFromOriginal';
  };

  function CopyFromOriginalTransformer(transformers, options) {
    CopyFromOriginalTransformer.__super__.constructor.call(this, transformers, options);
    this._includeCols = options.includeCols;
    this._excludeCols = options.excludeCols;
  }

  CopyFromOriginalTransformer.prototype.map = function(origRow, accRow) {
    _.each(accRow, (function(_this) {
      return function(acc) {
        if (_this.supportsGroup(acc.group)) {
          return _.each(_.keys(origRow), function(name) {
            if (_this._include(name)) {
              return acc.row[name] = origRow[name];
            }
          });
        }
      };
    })(this));
    return Q(accRow);
  };

  CopyFromOriginalTransformer.prototype._include = function(name) {
    return (!this._includeCols || _.contains(this._includeCols, name)) && (!this._excludeCols || !_.contains(this._excludeCols, name));
  };

  CopyFromOriginalTransformer.prototype.transformHeader = function(headerAccumulator, originalHeader) {
    return _.map(headerAccumulator, (function(_this) {
      return function(acc) {
        if (_this.supportsGroup(acc.group)) {
          return {
            group: acc.group,
            newHeaders: acc.newHeaders.concat(_.filter(originalHeader, (function(name) {
              return _this._include(name);
            })))
          };
        } else {
          return acc;
        }
      };
    })(this));
  };

  CopyFromOriginalTransformer.prototype._defaultPriority = function() {
    return 1000;
  };

  return CopyFromOriginalTransformer;

})(ColumnMapping);

RemoveColumnsTransformer = (function(_super) {
  __extends(RemoveColumnsTransformer, _super);

  RemoveColumnsTransformer.create = function(transformers, options) {
    return Q(new RemoveColumnsTransformer(transformers, options));
  };

  RemoveColumnsTransformer.supports = function(options) {
    return options.type === 'removeColumns';
  };

  function RemoveColumnsTransformer(transformers, options) {
    RemoveColumnsTransformer.__super__.constructor.call(this, transformers, options);
    this._cols = options.cols || [];
  }

  RemoveColumnsTransformer.prototype.map = function(origRow, accRow) {
    _.each(accRow, (function(_this) {
      return function(acc) {
        if (_this.supportsGroup(acc.group)) {
          return _.each(_.keys(acc.row), function(name) {
            if (_.contains(_this._cols, name)) {
              return delete acc.row[name];
            }
          });
        }
      };
    })(this));
    return Q(accRow);
  };

  RemoveColumnsTransformer.prototype.transformHeader = function(headerAccumulator, originalHeader) {
    return _.map(headerAccumulator, (function(_this) {
      return function(acc) {
        if (_this.supportsGroup(acc.group)) {
          return {
            group: acc.group,
            newHeaders: _.filter(acc.newHeaders, (function(name) {
              return !_.contains(_this._cols, name);
            }))
          };
        } else {
          return acc;
        }
      };
    })(this));
  };

  RemoveColumnsTransformer.prototype._defaultPriority = function() {
    return 1500;
  };

  return RemoveColumnsTransformer;

})(ColumnMapping);

ColumnTransformer = (function(_super) {
  __extends(ColumnTransformer, _super);

  ColumnTransformer.create = function(transformers, options) {
    return (new ColumnTransformer(transformers, options))._init();
  };

  ColumnTransformer.supports = function(options) {
    return options.type === 'transformColumn' || options.type === 'addColumn';
  };

  function ColumnTransformer(transformers, options) {
    ColumnTransformer.__super__.constructor.call(this, transformers, options);
    this._fromCol = options.fromCol;
    this._toCol = options.toCol;
    this._type = options.type;
    this._valueTransformersConfig = options.valueTransformers;
  }

  ColumnTransformer.prototype._init = function() {
    return util.initValueTransformers(this._transformers, this._valueTransformersConfig).then((function(_this) {
      return function(vt) {
        _this._valueTransformers = vt;
        return _this;
      };
    })(this));
  };

  ColumnTransformer.prototype.map = function(origRow, accRow) {
    var mergedRow, value;
    value = this._getPropertyForGroup(origRow, accRow, this._fromCol);
    if (this._containsSupportedGroup(accRow)) {
      mergedRow = _.reduce(_.map(accRow, function(acc) {
        return acc.row;
      }), (function(acc, obj) {
        return _.extend(acc, obj);
      }), origRow);
      return util.transformValue(this._valueTransformers, value, mergedRow).then((function(_this) {
        return function(finalValue) {
          _this._updatePropertyInGroups(accRow, _this._toCol, finalValue);
          return accRow;
        };
      })(this)).fail((function(_this) {
        return function(error) {
          var fromMessage, valueMessage;
          fromMessage = _this._fromCol ? "mapping from column '" + _this._fromCol + "' to" : "generation of";
          valueMessage = value ? " with current value '" + value + "'" : "";
          throw new Error("Error during " + fromMessage + " column '" + _this._toCol + "'" + valueMessage + ": " + error.stack);
        };
      })(this));
    } else {
      return Q(accRow);
    }
  };

  ColumnTransformer.prototype.transformHeader = function(headerAccumulator, originalHeader) {
    return _.map(headerAccumulator, (function(_this) {
      return function(acc) {
        if (_this.supportsGroup(acc.group)) {
          return {
            group: acc.group,
            newHeaders: acc.newHeaders.concat([_this._toCol])
          };
        } else {
          return acc;
        }
      };
    })(this));
  };

  ColumnTransformer.prototype._defaultPriority = function() {
    if (this._type === 'addColumn') {
      return 3000;
    } else {
      return 2000;
    }
  };

  return ColumnTransformer;

})(ColumnMapping);


/*
  Transforms one object into another object accoring to the mapping configuration

  Options:
    mappingConfig
    transformers
    columnMappers
 */

Mapping = (function() {
  function Mapping(options) {
    this._mappingConfig = options.mappingConfig;
    this._transformers = options.transformers;
    this._columnMappers = options.columnMappers;
    this.groupColumn = this._mappingConfig.groupColumn;
  }

  Mapping.prototype.init = function() {
    return this._constructMapping(this._mappingConfig).then((function(_this) {
      return function(mapping) {
        _this._columnMapping = mapping;
        return _this;
      };
    })(this));
  };

  Mapping.prototype._constructMapping = function(mappingJson) {
    var columnPromises;
    columnPromises = _.map(mappingJson.columnMapping, (function(_this) {
      return function(elem) {
        var found;
        found = _.find(_this._columnMappers, function(mapper) {
          return mapper.supports(elem);
        });
        if (found) {
          return found.create(_this._transformers, elem);
        } else {
          throw new Error("Unsupported column mapping type: " + elem.type);
        }
      };
    })(this));
    return Q.all(columnPromises);
  };

  Mapping.prototype.transformHeader = function(groups, columnNames) {
    return _.reduce(this._columnMapping, (function(acc, mapping) {
      return mapping.transformHeader(acc, columnNames);
    }), _.map(groups, function(g) {
      return {
        group: g,
        newHeaders: []
      };
    }));
  };

  Mapping.prototype.transformRow = function(groups, row, additionalProperties) {
    var initialAcc, mappingsSorted;
    if (additionalProperties == null) {
      additionalProperties = {};
    }
    mappingsSorted = _.sortBy(this._columnMapping, function(mapping) {
      return mapping.priority();
    });
    initialAcc = _.map(groups, function(g) {
      return {
        group: g,
        row: {}
      };
    }).concat({
      group: util.virtualGroup(),
      row: additionalProperties
    });
    return _.reduce(mappingsSorted, (function(accRowPromise, mapping) {
      return accRowPromise.then(function(accRow) {
        return mapping.map(row, accRow);
      });
    }), Q(initialAcc));
  };

  return Mapping;

})();

module.exports = {
  ColumnMapping: ColumnMapping,
  ColumnTransformer: ColumnTransformer,
  CopyFromOriginalTransformer: CopyFromOriginalTransformer,
  RemoveColumnsTransformer: RemoveColumnsTransformer,
  Mapping: Mapping,
  defaultColumnMappers: [ColumnTransformer, CopyFromOriginalTransformer, RemoveColumnsTransformer]
};
