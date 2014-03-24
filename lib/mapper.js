/* ===========================================================
# sphere-product-mapper - v0.1.6
# ==============================================================
# Copyright (c) 2014 Oleg Ilyenko
# Licensed MIT.
*/
var GroupBuffer, Mapper, Q, Rx, csv, fs, util, _, _s;

Q = require('q');

Rx = require('rx');

csv = require('csv');

fs = require('fs');

_ = require('underscore')._;

_s = require('underscore.string');

util = require('../lib/util');


/*
  Transformes input CSV file to output CSV format by using the mappi mapping

  Options:
    inCsv - input CSV file (optional)
    outCsv - output CSV file (optional)
    includesHeaderRow - (optional - by default true)
    mapping
    csvDelimiter - (optional - by default `,`)
    csvQuote - (optional - by default `"`)
    group - the group of the main CSV
    additionalOutCsv
 */

Mapper = (function() {
  Mapper.prototype._defaultOptions = {
    includesHeaderRow: true
  };

  function Mapper(options) {
    if (options == null) {
      options = {};
    }
    this._inCsv = options.inCsv;
    this._outCsv = options.outCsv;
    this._csvDelimiter = options.csvDelimiter || ',';
    this._csvQuote = options.csvQuote || '"';
    this._includesHeaderRow = options.includesHeaderRow || true;
    this._mapping = options.mapping;
    this._group = options.group || util.defaultGroup();
    this._additionalOutCsv = options.additionalOutCsv;
    if (this._group === util.virtualGroup() || _.find(this._additionalOutCsv, function(c) {
      return c.group === util.virtualGroup();
    })) {
      throw new Error("You are not allowed to use vitual group for CSV creation. It's meant to be used within mapping itself.");
    }
  }

  Mapper.prototype.processCsv = function(csvIn, outWriters) {
    var buffers, d, headers, lastBufferGroupValue, requiredGroups, writers;
    d = Q.defer();
    writers = _.map(outWriters, function(w) {
      w.headers = null;
      w.newHeaders = null;
      return w;
    });
    requiredGroups = _.map(writers, function(w) {
      return w.group;
    });
    buffers = {};
    headers = null;
    lastBufferGroupValue = null;
    csv().from.stream(csvIn, this._cvsOptions()).transform((function(_this) {
      return function(row, idx, done) {
        var buffer, controlPromise, groupValue, inObj, lastControlPromise, newHeadersPerGroup, rowFinishedDefer, rowPromise, _ref;
        if (idx === 0 && _this._includesHeaderRow) {
          headers = row;
          newHeadersPerGroup = _this._mapping.transformHeader(requiredGroups, row);
          _.each(writers, function(w) {
            w.newHeaders = _.find(newHeadersPerGroup, function(h) {
              return h.group === w.group;
            }).newHeaders;
            return w.writer.write(w.newHeaders);
          });
          return done(null, []);
        } else {
          if (idx === 0) {
            headers = _.map(_.range(row.length), function(idx) {
              return "" + idx;
            });
            newHeadersPerGroup = _this._mapping.transformHeader(requiredGroups, headers);
            _.each(writers, function(w) {
              return w.newHeaders = _.find(newHeadersPerGroup, function(h) {
                return h.group === w.group;
              }).newHeaders;
            });
          }
          inObj = _this._convertToObject(headers, row);
          groupValue = _this._mapping.groupColumn != null ? inObj[_this._mapping.groupColumn] : "" + idx;
          buffer = buffers[groupValue];
          lastControlPromise = buffer == null ? (buffer = new GroupBuffer(), buffers[groupValue] = buffer, lastBufferGroupValue != null ? (buffers[lastBufferGroupValue].finished(), delete buffers[lastBufferGroupValue]) : Q(false)) : Q(false);
          _ref = buffer.add(idx, function(groupRows) {
            var bufferFirstIdx;
            bufferFirstIdx = buffer.getFirstIndex() || idx;
            return _this._mapping.transformRow(requiredGroups, inObj, {
              index: _this._includesHeaderRow ? idx - 1 : idx,
              groupFirstIndex: _this._includesHeaderRow ? bufferFirstIdx - 1 : bufferFirstIdx,
              groupContext: buffer.getContext(),
              groupRows: groupRows
            });
          }), rowPromise = _ref[0], rowFinishedDefer = _ref[1], controlPromise = _ref[2];
          rowPromise.then(function(convertedPerGroup) {
            _.each(writers, function(w) {
              var result;
              result = _this._convertFromObject(w.newHeaders, _.find(convertedPerGroup, function(c) {
                return c.group === w.group;
              }).row);
              return w.writer.write(result);
            });
            return rowFinishedDefer.resolve(true);
          }).fail(function(error) {
            done(error, null);
            return rowFinishedDefer.reject(error);
          }).done();
          Q.all([controlPromise, lastControlPromise]).then(function() {
            return done(null, []);
          }).fail(function(error) {
            return done(error, null);
          }).done();
          return lastBufferGroupValue = groupValue;
        }
      };
    })(this)).on('end', function(count) {
      var p;
      p = lastBufferGroupValue != null ? buffers[lastBufferGroupValue].finished() : Q(false);
      return p.then(function() {
        return d.resolve(count);
      }).fail(function(error) {
        return d.reject(error);
      }).done();
    }).on('error', function(error) {
      return d.reject(error);
    });
    return d.promise;
  };

  Mapper.prototype._cvsOptions = function() {
    return {
      delimiter: this._csvDelimiter,
      quote: this._csvQuote
    };
  };

  Mapper.prototype._convertToObject = function(properties, row) {
    var reduceFn;
    reduceFn = function(acc, nameWithIdx) {
      var idx, name;
      name = nameWithIdx[0], idx = nameWithIdx[1];
      acc[name] = row[idx];
      return acc;
    };
    return _.reduce(_.map(properties, (function(prop, idx) {
      return [prop, idx];
    })), reduceFn, {});
  };

  Mapper.prototype._convertFromObject = function(properties, obj) {
    return _.map(properties, function(name) {
      return obj[name];
    });
  };

  Mapper.prototype._createAdditionalWriters = function(csvDefs) {
    return _.map(csvDefs, (function(_this) {
      return function(csvDef) {
        var closeFn, closeWriterFn, stream, writer;
        stream = csvDef.stream || fs.createWriteStream(csvDef.file);
        writer = csv().to.stream(stream, _this._cvsOptions());
        closeWriterFn = function() {
          var d;
          d = Q.defer();
          writer.on('end', function(count) {
            return d.resolve(count);
          }).on('error', function(error) {
            return d.reject(error);
          }).end();
          return d.promise;
        };
        closeFn = function() {
          if (!csvDef.dontClose) {
            return closeWriterFn()["finally"](function() {
              return util.closeStream(stream);
            });
          }
        };
        return {
          group: csvDef.group,
          writer: writer,
          close: closeFn
        };
      };
    })(this));
  };

  Mapper.prototype.run = function() {
    return Q.spread([util.fileStreamOrStdin(this._inCsv), util.fileStreamOrStdout(this._outCsv)], (function(_this) {
      return function(_arg, _arg1) {
        var additionalWriters, allWriters, csvIn, csvOut, doNotCloseIn, doNotCloseStdOut, mainWriters;
        csvIn = _arg[0], doNotCloseIn = _arg[1];
        csvOut = _arg1[0], doNotCloseStdOut = _arg1[1];
        mainWriters = _this._createAdditionalWriters([
          {
            group: _this._group,
            stream: csvOut,
            dontClose: doNotCloseStdOut
          }
        ]);
        additionalWriters = _this._createAdditionalWriters(_this._additionalOutCsv);
        allWriters = mainWriters.concat(additionalWriters);
        return _this.processCsv(csvIn, allWriters)["finally"](function() {
          return Q.all(_.map(allWriters, function(writer) {
            return writer.close();
          }));
        });
      };
    })(this));
  };

  return Mapper;

})();

GroupBuffer = (function() {
  function GroupBuffer() {
    this._buffer = {};
    this._context = {};
    this._finished;
    this._written = false;
  }

  GroupBuffer.prototype.getContext = function() {
    return this._context;
  };

  GroupBuffer.prototype.finished = function() {
    this._finished = true;
    return this._checkWhetherFinished();
  };

  GroupBuffer.prototype.getFirstIndex = function() {
    return this._firstIdx;
  };

  GroupBuffer.prototype.add = function(idx, rowFn) {
    var d, dRowFinished;
    d = Q.defer();
    dRowFinished = Q.defer();
    if (this._firstIdx == null) {
      this._firstIdx = idx;
      this._lastIdx = idx;
    } else if (this._lastIdx < idx) {
      this._lastIdx = idx;
    }
    return [d.promise, dRowFinished, this._incommingRow(idx, rowFn, d, dRowFinished.promise)];
  };

  GroupBuffer.prototype._incommingRow = function(idx, rowFn, defer, rowFinishedPromise) {
    this._buffer["" + idx] = {
      idx: idx,
      row: rowFn,
      defer: defer,
      rowFinishedPromise: rowFinishedPromise
    };
    return this._checkWhetherFinished();
  };

  GroupBuffer.prototype._checkWhetherFinished = function() {
    var ps;
    if (!this._written && this._finished && this._allRowsFinished()) {
      this._written = true;
      ps = _.map(this._getIdxs(), (function(_this) {
        return function(idx) {
          var box;
          box = _this._buffer["" + idx];
          return box.row(_.size(_this._getIdxs())).then(function(res) {
            return [box, res];
          }).fail(function(error) {
            box.defer.reject(error);
            return Q.reject(error);
          });
        };
      })(this));
      return Q.all(ps).then(function(list) {
        var writtenPs;
        writtenPs = _.map(list, function(elem) {
          var box, row;
          box = elem[0], row = elem[1];
          box.defer.resolve(row);
          return box.rowFinishedPromise;
        });
        return Q.all(writtenPs);
      }).then(function() {
        return true;
      });
    } else {
      return Q(false);
    }
  };

  GroupBuffer.prototype._allRowsFinished = function() {
    return _.every(this._getIdxs(), (function(_this) {
      return function(idx) {
        return _this._buffer["" + idx] != null;
      };
    })(this));
  };

  GroupBuffer.prototype._getIdxs = function() {
    if (this._firstIdx === this._lastIdx) {
      return [this._firstIdx];
    } else {
      return _.range(this._firstIdx, this._lastIdx + 1);
    }
  };

  return GroupBuffer;

})();

exports.Mapper = Mapper;
