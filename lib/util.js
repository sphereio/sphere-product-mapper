/* ===========================================================
# sphere-product-mapper - v0.1.6
# ==============================================================
# Copyright (c) 2014 Oleg Ilyenko
# Licensed MIT.
*/
var Q, fs, http, stdFs, _, _s;

Q = require('q');

fs = require('q-io/fs');

http = require('q-io/http');

stdFs = require('fs');

_ = require('underscore')._;

_s = require('underscore.string');


/*
  Module has some utility functions
 */

module.exports = {
  loadFile: function(fileOrUrl) {
    if (_s.startsWith(fileOrUrl, 'http')) {
      return http.read(fileOrUrl);
    } else {
      return fs.read(fileOrUrl, 'r');
    }
  },
  fileStreamOrStdin: function(filePath) {
    return fs.exists(filePath).then(function(exists) {
      if (exists) {
        return [stdFs.createReadStream(filePath), false];
      } else {
        return [process.stdin, true];
      }
    });
  },
  fileStreamOrStdout: function(filePath) {
    if (this.nonEmpty(filePath)) {
      return Q([stdFs.createWriteStream(filePath), false]);
    } else {
      return Q([process.stdout, true]);
    }
  },
  closeStream: function(stream) {
    var d;
    d = Q.defer();
    stream.on('finish', function() {
      return d.resolve();
    });
    stream.on('error', function(e) {
      return d.reject(e);
    });
    stream.end();
    return d.promise;
  },
  nonEmpty: function(str) {
    return str && _s.trim(str).length > 0;
  },
  abstractMethod: function() {
    throw new Error('Method not implemented!');
  },
  notImplementedYet: function() {
    throw new Error('Method not implemented!');
  },
  defaultGroup: function() {
    return "default";
  },
  virtualGroup: function() {
    return "virtual";
  },
  withSafeValue: function(value, fn) {
    if (this.nonEmpty(value)) {
      return fn(value);
    } else {
      return Q(value);
    }
  },
  transformValue: function(valueTransformers, value, row) {
    return _.reduce(valueTransformers, (function(acc, transformer) {
      return acc.then(function(v) {
        return transformer.transform(v, row);
      });
    }), Q(value));
  },
  transformFirstValue: function(valueTransformers, value, row) {
    if (valueTransformers.length === 0) {
      return value;
    } else {
      return _.head(valueTransformers).transform(value, row).then((function(_this) {
        return function(newVal) {
          if (_this.nonEmpty(newVal)) {
            return newVal;
          } else {
            return _this.transformFirstValue(_.tail(valueTransformers), value, row);
          }
        };
      })(this));
    }
  },
  initValueTransformers: function(transformers, transformerConfig) {
    var promises;
    if (transformerConfig) {
      promises = _.map(transformerConfig, function(config) {
        var found;
        found = _.find(transformers, function(t) {
          return t.supports(config);
        });
        if (found) {
          return found.create(transformers, config);
        } else {
          throw new Error("unsupported value transformer type: " + config.type);
        }
      });
      return Q.all(promises);
    } else {
      return Q([]);
    }
  },
  parseAdditionalOutCsv: function(config) {
    if (!config) {
      return [];
    } else {
      return _.map(config.split(/,/), (function(_this) {
        return function(c) {
          var parts;
          parts = c.split(/:/);
          if (parts.length === 2) {
            return {
              group: parts[0],
              file: parts[1]
            };
          } else {
            return {
              group: _this.defaultGroup(),
              file: parts[0]
            };
          }
        };
      })(this));
    }
  }
};
