/* ===========================================================
# sphere-product-mapper - v0.1.6
# ==============================================================
# Copyright (c) 2014 Oleg Ilyenko
# Licensed MIT.
*/
var Q, Repeater, _;

Q = require('q');

_ = require('underscore')._;

Repeater = (function() {
  function Repeater(options) {
    this._attempts = options.attempts;
    this._timeout = options.timeout || 100;
    this._timeoutType = options.timeoutType;
  }

  Repeater.prototype.execute = function(options) {
    var d;
    d = Q.defer();
    this._repeat(this._attempts, options, d, null);
    return d.promise;
  };

  Repeater.prototype._repeat = function(attempts, options, defer, lastError) {
    var recoverableError, task;
    task = options.task, recoverableError = options.recoverableError;
    if (attempts === 0) {
      return defer.reject(new Error("Unsuccessful after " + this._attempts + " attempts: " + lastError.message));
    } else {
      return task().then(function(res) {
        return defer.resolve(res);
      }).fail((function(_this) {
        return function(e) {
          if (recoverableError(e)) {
            return Q.delay(_this._calculateDelay(attempts)).then(function(i) {
              return _this._repeat(attempts - 1, options, defer, e);
            });
          } else {
            return defer.reject(e);
          }
        };
      })(this)).done();
    }
  };

  Repeater.prototype._calculateDelay = function(attemptsLeft) {
    var tried;
    if (this._timeoutType === 'constant') {
      return this._timeout;
    } else {
      tried = this._attempts - attemptsLeft - 1;
      return (this._timeout * tried) + _.random(50, this._timeout);
    }
  };

  return Repeater;

})();

exports.Repeater = Repeater;
