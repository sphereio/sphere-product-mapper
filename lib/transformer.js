/* ===========================================================
# sphere-product-mapper - v0.1.6
# ==============================================================
# Copyright (c) 2014 Oleg Ilyenko
# Licensed MIT.
*/
var AdditionalOptionsWrapper, ColumnTransformer, ConstantTransformer, CounterTransformer, FallbackTransformer, GroupCounterTransformer, LookupTransformer, LowerCaseTransformer, MultipartStringTransformer, OncePerGroupTransformer, PrintTransformer, Q, RandomDelayTransformer, RandomTransformer, RegexpTransformer, RequiredTransformer, SlugifyTransformer, UpperCaseTransformer, ValueTransformer, csv, util, _, _s,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Q = require('q');

csv = require('csv');

_ = require('underscore')._;

_s = require('underscore.string');

util = require('../lib/util');

ValueTransformer = (function() {
  function ValueTransformer() {}

  ValueTransformer.create = function(options) {
    return util.abstractMethod();
  };

  ValueTransformer.supports = function(options) {
    return util.abstractMethod();
  };

  ValueTransformer.prototype.transform = function(value, row) {
    return util.abstractMethod();
  };

  return ValueTransformer;

})();

ConstantTransformer = (function(_super) {
  __extends(ConstantTransformer, _super);

  ConstantTransformer.create = function(transformers, options) {
    return Q(new ConstantTransformer(transformers, options));
  };

  ConstantTransformer.supports = function(options) {
    return options.type === 'constant';
  };

  function ConstantTransformer(transformers, options) {
    this._value = options.value;
  }

  ConstantTransformer.prototype.transform = function(value, row) {
    return Q(this._value);
  };

  return ConstantTransformer;

})(ValueTransformer);

PrintTransformer = (function(_super) {
  __extends(PrintTransformer, _super);

  PrintTransformer.create = function(transformers, options) {
    return Q(new PrintTransformer(transformers, options));
  };

  PrintTransformer.supports = function(options) {
    return options.type === 'print';
  };

  function PrintTransformer(transformers, options) {}

  PrintTransformer.prototype.transform = function(value, row) {
    console.info(value);
    return Q(value);
  };

  return PrintTransformer;

})(ValueTransformer);

RandomDelayTransformer = (function(_super) {
  __extends(RandomDelayTransformer, _super);

  RandomDelayTransformer.create = function(transformers, options) {
    return Q(new RandomDelayTransformer(transformers, options));
  };

  RandomDelayTransformer.supports = function(options) {
    return options.type === 'randomDelay';
  };

  function RandomDelayTransformer(transformers, options) {
    this._minMs = options.minMs || 10;
    this._maxMs = options.maxMs || 80;
  }

  RandomDelayTransformer.prototype.transform = function(value, row) {
    return Q.delay(_.random(this._minMs, this._maxMs)).then(function() {
      return value;
    });
  };

  return RandomDelayTransformer;

})(ValueTransformer);

CounterTransformer = (function(_super) {
  __extends(CounterTransformer, _super);

  CounterTransformer.create = function(transformers, options) {
    return Q(new CounterTransformer(transformers, options));
  };

  CounterTransformer.supports = function(options) {
    return options.type === 'counter';
  };

  function CounterTransformer(transformers, options) {
    this._startAt = options.startAt || 0;
  }

  CounterTransformer.prototype.transform = function(value, row) {
    return Q("" + (this._startAt + row.index));
  };

  return CounterTransformer;

})(ValueTransformer);

GroupCounterTransformer = (function(_super) {
  __extends(GroupCounterTransformer, _super);

  GroupCounterTransformer.create = function(transformers, options) {
    return Q(new GroupCounterTransformer(transformers, options));
  };

  GroupCounterTransformer.supports = function(options) {
    return options.type === 'groupCounter';
  };

  function GroupCounterTransformer(transformers, options) {
    this._startAt = options.startAt || 0;
  }

  GroupCounterTransformer.prototype.transform = function(value, row) {
    return Q("" + (this._startAt + (row.index - row.groupFirstIndex)));
  };

  return GroupCounterTransformer;

})(ValueTransformer);

OncePerGroupTransformer = (function(_super) {
  __extends(OncePerGroupTransformer, _super);

  OncePerGroupTransformer.create = function(transformers, options) {
    return (new OncePerGroupTransformer(transformers, options))._init();
  };

  OncePerGroupTransformer.supports = function(options) {
    return options.type === 'oncePerGroup';
  };

  function OncePerGroupTransformer(transformers, options) {
    this._transformers = transformers;
    this._name = options.name;
    this._valueTransformersConfig = options.valueTransformers;
  }

  OncePerGroupTransformer.prototype._init = function() {
    return util.initValueTransformers(this._transformers, this._valueTransformersConfig).then((function(_this) {
      return function(vt) {
        _this._valueTransformers = vt;
        return _this;
      };
    })(this));
  };

  OncePerGroupTransformer.prototype.transform = function(value, row) {
    if (row.groupContext[this._name] != null) {
      return row.groupContext[this._name];
    } else {
      return row.groupContext[this._name] = util.transformValue(this._valueTransformers, value, row).then(function(newValue) {
        return newValue;
      });
    }
  };

  return OncePerGroupTransformer;

})(ValueTransformer);

ColumnTransformer = (function(_super) {
  __extends(ColumnTransformer, _super);

  ColumnTransformer.create = function(transformers, options) {
    return Q(new ColumnTransformer(transformers, options));
  };

  ColumnTransformer.supports = function(options) {
    return options.type === 'column';
  };

  function ColumnTransformer(transformers, options) {
    this._col = options.col;
  }

  ColumnTransformer.prototype.transform = function(value, row) {
    return Q(row[this._col]);
  };

  return ColumnTransformer;

})(ValueTransformer);

RequiredTransformer = (function(_super) {
  __extends(RequiredTransformer, _super);

  RequiredTransformer.create = function(transformers, options) {
    return Q(new RequiredTransformer(transformers, options));
  };

  RequiredTransformer.supports = function(options) {
    return options.type === 'required';
  };

  function RequiredTransformer(transformers, options) {
    this._disabled = options.disable || false;
  }

  RequiredTransformer.prototype.transform = function(value, row) {
    if (this._disabled || util.nonEmpty(value)) {
      return Q(value);
    } else {
      return Q.reject(new Error("Value is empty."));
    }
  };

  return RequiredTransformer;

})(ValueTransformer);

UpperCaseTransformer = (function(_super) {
  __extends(UpperCaseTransformer, _super);

  UpperCaseTransformer.create = function(transformers, options) {
    return Q(new UpperCaseTransformer(transformers, options));
  };

  UpperCaseTransformer.supports = function(options) {
    return options.type === 'upper';
  };

  function UpperCaseTransformer(transformers, options) {}

  UpperCaseTransformer.prototype.transform = function(value, row) {
    return util.withSafeValue(value, function(safe) {
      return Q(safe.toUpperCase());
    });
  };

  return UpperCaseTransformer;

})(ValueTransformer);

LowerCaseTransformer = (function(_super) {
  __extends(LowerCaseTransformer, _super);

  LowerCaseTransformer.create = function(transformers, options) {
    return Q(new LowerCaseTransformer(transformers, options));
  };

  LowerCaseTransformer.supports = function(options) {
    return options.type === 'lower';
  };

  function LowerCaseTransformer(transformers, options) {}

  LowerCaseTransformer.prototype.transform = function(value, row) {
    return util.withSafeValue(value, function(safe) {
      return Q(safe.toLowerCase());
    });
  };

  return LowerCaseTransformer;

})(ValueTransformer);

SlugifyTransformer = (function(_super) {
  __extends(SlugifyTransformer, _super);

  SlugifyTransformer.create = function(transformers, options) {
    return Q(new SlugifyTransformer(transformers, options));
  };

  SlugifyTransformer.supports = function(options) {
    return options.type === 'slugify';
  };

  function SlugifyTransformer(transformers, options) {}

  SlugifyTransformer.prototype.transform = function(value, row) {
    return util.withSafeValue(value, function(safe) {
      return Q(_s.slugify(safe));
    });
  };

  return SlugifyTransformer;

})(ValueTransformer);

RandomTransformer = (function(_super) {
  __extends(RandomTransformer, _super);

  RandomTransformer.create = function(transformers, options) {
    return Q(new RandomTransformer(transformers, options));
  };

  RandomTransformer.supports = function(options) {
    return options.type === 'random';
  };

  function RandomTransformer(transformers, options) {
    this._size = options.size;
    this._chars = options.chars;
  }

  RandomTransformer.prototype.transform = function(value, row) {
    var rndChars;
    rndChars = _.map(_.range(this._size), (function(_this) {
      return function(idx) {
        return _this._chars.charAt(_.random(0, _this._chars.length - 1));
      };
    })(this));
    return Q(rndChars.join(''));
  };

  return RandomTransformer;

})(ValueTransformer);

RegexpTransformer = (function(_super) {
  __extends(RegexpTransformer, _super);

  RegexpTransformer.create = function(transformers, options) {
    return Q(new RegexpTransformer(transformers, options));
  };

  RegexpTransformer.supports = function(options) {
    return options.type === 'regexp';
  };

  function RegexpTransformer(transformers, options) {
    this._find = new RegExp(options.find, 'g');
    this._replace = options.replace;
  }

  RegexpTransformer.prototype.transform = function(value, row) {
    return util.withSafeValue(value, (function(_this) {
      return function(safe) {
        if (safe.match(_this._find)) {
          return Q(safe.replace(_this._find, _this._replace));
        } else {
          return Q(null);
        }
      };
    })(this));
  };

  return RegexpTransformer;

})(ValueTransformer);

LookupTransformer = (function(_super) {
  __extends(LookupTransformer, _super);

  LookupTransformer.create = function(transformers, options) {
    return (new LookupTransformer(transformers, options))._init();
  };

  LookupTransformer.supports = function(options) {
    return options.type === 'lookup';
  };

  function LookupTransformer(transformers, options) {
    this._header = options.header;
    this._keyCol = options.keyCol;
    this._valueCol = options.valueCol;
    this._file = options.file;
    this._csvDelimiter = options.csvDelimiter || ',';
    this._csvQuote = options.csvQuote || '"';
    if (options.values) {
      this._headers = options.values.shift();
      this._values = options.values;
    }
  }

  LookupTransformer.prototype._init = function() {
    if (util.nonEmpty(this._file)) {
      return util.loadFile(this._file).then((function(_this) {
        return function(contents) {
          return _this._parseCsv(contents);
        };
      })(this)).then((function(_this) {
        return function(values) {
          _this._headers = values.headers;
          _this._values = values.data;
          return _this;
        };
      })(this));
    } else {
      return Q(this);
    }
  };

  LookupTransformer.prototype._parseCsv = function(csvText) {
    var cvsOptions, d;
    d = Q.defer();
    cvsOptions = {
      delimiter: this._csvDelimiter,
      quote: this._csvQuote
    };
    csv().from("" + csvText, cvsOptions).to.array((function(_this) {
      return function(data) {
        return d.resolve({
          headers: _this._header ? data.shift() : [],
          data: data
        });
      };
    })(this)).on('error', function(error) {
      return d.reject(error);
    });
    return d.promise;
  };

  LookupTransformer.prototype.transform = function(value, row) {
    return util.withSafeValue(value, (function(_this) {
      return function(safe) {
        var fileMessage, found, keyIdx, valueIdx, valuesMessage;
        keyIdx = _.isString(_this._keyCol) ? _this._headers.indexOf(_this._keyCol) : _this._keyCol;
        valueIdx = _.isString(_this._valueCol) ? _this._headers.indexOf(_this._valueCol) : _this._valueCol;
        if (keyIdx < 0 || valueIdx < 0) {
          throw new Error("Something is wrong in lookup config: key '" + _this._keyCol + "' or value '" + _this._valueCol + "' column not found by name!.");
        }
        found = _.find(_this._values, function(row) {
          return row[keyIdx] === safe;
        });
        if (found) {
          return Q(found[valueIdx]);
        } else {
          fileMessage = _this._file ? " File: " + _this._file + "." : "";
          valuesMessage = _this._values.join("; ");
          return new Error("Lookup transformation failed for value '" + safe + "'." + fileMessage + " Values: " + valuesMessage);
        }
      };
    })(this));
  };

  return LookupTransformer;

})(ValueTransformer);

MultipartStringTransformer = (function(_super) {
  __extends(MultipartStringTransformer, _super);

  MultipartStringTransformer.create = function(transformers, options) {
    return new MultipartStringTransformer(transformers, options)._init();
  };

  MultipartStringTransformer.supports = function(options) {
    return options.type === 'multipartString';
  };

  function MultipartStringTransformer(transformers, options) {
    this._transformers = transformers;
    this._parts = _.clone(options.parts);
  }

  MultipartStringTransformer.prototype._init = function() {
    var promises;
    promises = _.map(this._parts, (function(_this) {
      return function(part) {
        return util.initValueTransformers(_this._transformers, part.valueTransformers).then(function(vt) {
          part.valueTransformers = vt;
          return part;
        });
      };
    })(this));
    return Q.all(promises).then((function(_this) {
      return function(parts) {
        return _this;
      };
    })(this));
  };

  MultipartStringTransformer.prototype.transform = function(value, row) {
    var partialValuePromises;
    partialValuePromises = _.map(this._parts, function(part, idx) {
      var fromCol, pad, size, valueTransformers;
      size = part.size, pad = part.pad, fromCol = part.fromCol, valueTransformers = part.valueTransformers;
      value = row[fromCol];
      return util.transformValue(valueTransformers, value, row).then(function(transformed) {
        var valueMessage;
        if (!size) {
          return transformed;
        } else if ((transformed != null) && transformed.length < size && pad) {
          return _s.pad(transformed, size, pad);
        } else if ((transformed != null) && transformed.length === size) {
          return transformed;
        } else {
          valueMessage = value ? " with current value '" + value + "'" : "";
          throw new Error("Generated column part size (" + (transformed == null ? 0 : transformed.length) + " - '" + transformed + "') is smaller than expected size (" + size + ") and no padding is defined for this column. Source column '" + fromCol + "' (part " + idx + ")" + valueMessage + ".");
        }
      });
    });
    return Q.all(partialValuePromises).then(function(partialValues) {
      return partialValues.join('');
    });
  };

  return MultipartStringTransformer;

})(ValueTransformer);

FallbackTransformer = (function(_super) {
  __extends(FallbackTransformer, _super);

  FallbackTransformer.create = function(transformers, options) {
    return (new FallbackTransformer(transformers, options))._init();
  };

  FallbackTransformer.supports = function(options) {
    return options.type === 'fallback';
  };

  function FallbackTransformer(transformers, options) {
    this._transformers = transformers;
    this._valueTransformersConfig = options.valueTransformers;
  }

  FallbackTransformer.prototype._init = function() {
    return util.initValueTransformers(this._transformers, this._valueTransformersConfig).then((function(_this) {
      return function(vt) {
        _this._valueTransformers = vt;
        return _this;
      };
    })(this));
  };

  FallbackTransformer.prototype.transform = function(value, row) {
    return util.transformFirstValue(this._valueTransformers, value, row);
  };

  return FallbackTransformer;

})(ValueTransformer);

AdditionalOptionsWrapper = (function() {
  function AdditionalOptionsWrapper(_delegate, _options) {
    this._delegate = _delegate;
    this._options = _options;
  }

  AdditionalOptionsWrapper.prototype._fullOptions = function(options) {
    return _.extend({}, options, this._options);
  };

  AdditionalOptionsWrapper.prototype.create = function(transformers, options) {
    return this._delegate.create(transformers, this._fullOptions(options));
  };

  AdditionalOptionsWrapper.prototype.supports = function(options) {
    return this._delegate.supports(this._fullOptions(options));
  };

  return AdditionalOptionsWrapper;

})();

module.exports = {
  ValueTransformer: ValueTransformer,
  ConstantTransformer: ConstantTransformer,
  PrintTransformer: PrintTransformer,
  ColumnTransformer: ColumnTransformer,
  RequiredTransformer: RequiredTransformer,
  UpperCaseTransformer: UpperCaseTransformer,
  LowerCaseTransformer: LowerCaseTransformer,
  SlugifyTransformer: SlugifyTransformer,
  RandomTransformer: RandomTransformer,
  RegexpTransformer: RegexpTransformer,
  LookupTransformer: LookupTransformer,
  MultipartStringTransformer: MultipartStringTransformer,
  AdditionalOptionsWrapper: AdditionalOptionsWrapper,
  FallbackTransformer: FallbackTransformer,
  RandomDelayTransformer: RandomDelayTransformer,
  CounterTransformer: CounterTransformer,
  GroupCounterTransformer: GroupCounterTransformer,
  OncePerGroupTransformer: OncePerGroupTransformer,
  defaultTransformers: [ConstantTransformer, PrintTransformer, ColumnTransformer, UpperCaseTransformer, LowerCaseTransformer, SlugifyTransformer, RandomTransformer, RegexpTransformer, LookupTransformer, MultipartStringTransformer, FallbackTransformer, RandomDelayTransformer, CounterTransformer, GroupCounterTransformer, OncePerGroupTransformer]
};
