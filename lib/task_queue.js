/* ===========================================================
# sphere-product-mapper - v0.1.6
# ==============================================================
# Copyright (c) 2014 Oleg Ilyenko
# Licensed MIT.
*/
var BatchTaskQueue, Q, _;

Q = require('q');

_ = require('underscore')._;

BatchTaskQueue = (function() {
  function BatchTaskQueue(options) {
    this._taskFn = options.taskFn;
    this._queue = [];
    this._active = false;
  }

  BatchTaskQueue.prototype.addTask = function(taskOptions) {
    var d;
    d = Q.defer();
    this._queue.push({
      options: taskOptions,
      defer: d
    });
    this._maybeExecute();
    return d.promise;
  };

  BatchTaskQueue.prototype._maybeExecute = function() {
    if (!this._active && this._queue.length > 0) {
      this._startTasks(this._queue);
      return this._queue = [];
    }
  };

  BatchTaskQueue.prototype._startTasks = function(tasks) {
    this._active = true;
    return this._taskFn(tasks).fail(function(error) {
      return _.each(tasks, function(t) {
        return t.defer.reject(error);
      });
    })["finally"]((function(_this) {
      return function() {
        _this._active = false;
        return _this._maybeExecute();
      };
    })(this));
  };

  return BatchTaskQueue;

})();

exports.BatchTaskQueue = BatchTaskQueue;
