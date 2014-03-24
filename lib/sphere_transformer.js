/* ===========================================================
# sphere-product-mapper - v0.1.6
# ==============================================================
# Copyright (c) 2014 Oleg Ilyenko
# Licensed MIT.
*/
var BatchTaskQueue, DuplicateSku, ErrorStatusCode, OfflineSphereService, Q, RepeatOnDuplicateSkuTransformer, Repeater, Rest, SphereSequenceTransformer, SphereService, csv, util, _, _s,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Q = require('q');

csv = require('csv');

_ = require('underscore')._;

_s = require('underscore.string');

util = require('../lib/util');

Rest = require('sphere-node-connect').Rest;

Repeater = require('../lib/repeater').Repeater;

BatchTaskQueue = require('../lib/task_queue').BatchTaskQueue;

SphereSequenceTransformer = (function(_super) {
  __extends(SphereSequenceTransformer, _super);

  SphereSequenceTransformer.create = function(transformers, options) {
    return Q(new SphereSequenceTransformer(transformers, options));
  };

  SphereSequenceTransformer.supports = function(options) {
    return options.type === 'sphereSequence';
  };

  function SphereSequenceTransformer(transformers, options) {
    this._sphere = options.sphereService;
    this._sequenceOptions = {
      name: options.name,
      initial: options.initial,
      max: options.max,
      min: options.min,
      increment: options.increment,
      rotate: options.rotate
    };
  }

  SphereSequenceTransformer.prototype.transform = function(value, row) {
    return this._sphere.getAndIncrementCounter(this._sequenceOptions);
  };

  return SphereSequenceTransformer;

})(transformer.ValueTransformer);

RepeatOnDuplicateSkuTransformer = (function(_super) {
  __extends(RepeatOnDuplicateSkuTransformer, _super);

  RepeatOnDuplicateSkuTransformer.create = function(transformers, options) {
    return (new RepeatOnDuplicateSkuTransformer(transformers, options))._init();
  };

  RepeatOnDuplicateSkuTransformer.supports = function(options) {
    return options.type === 'repeatOnDuplicateSku';
  };

  function RepeatOnDuplicateSkuTransformer(transformers, options) {
    this._name = options.name;
    this._transformers = transformers;
    this._sphere = options.sphereService;
    this._attempts = options.attempts;
    this._valueTransformersConfig = options.valueTransformers;
  }

  RepeatOnDuplicateSkuTransformer.prototype._init = function() {
    return util.initValueTransformers(this._transformers, this._valueTransformersConfig).then((function(_this) {
      return function(vt) {
        _this._valueTransformers = vt;
        return _this;
      };
    })(this));
  };

  RepeatOnDuplicateSkuTransformer.prototype._getElection = function(row, round) {
    if (row.groupContext[this._name + ".election"] != null) {
      return row.groupContext[this._name + ".election"]["" + round];
    } else {
      return null;
    }
  };

  RepeatOnDuplicateSkuTransformer.prototype._setElection = function(row, round, value) {
    if (row.groupContext[this._name + ".election"] == null) {
      row.groupContext[this._name + ".election"] = {};
    }
    return row.groupContext[this._name + ".election"]["" + round] = value;
  };

  RepeatOnDuplicateSkuTransformer.prototype._clearGroupContext = function(row) {
    return delete row.groupContext[this._name];
  };

  RepeatOnDuplicateSkuTransformer.prototype._myGroupIdx = function(row) {
    return row.index - row.groupFirstIndex;
  };

  RepeatOnDuplicateSkuTransformer.prototype._setupElections = function(row, round) {
    var election;
    if (round == null) {
      round = 1;
    }
    election = this._getElection(row, round);
    if (election == null) {
      election = _.map(_.range(row.groupRows), function(idx) {
        var d;
        d = Q.defer();
        return {
          defer: d,
          promise: d.promise
        };
      });
      election = this._setElection(row, round, election);
    }
    return [election, election[this._myGroupIdx(row)], round];
  };

  RepeatOnDuplicateSkuTransformer.prototype._decideMyVote = function(value, row, vote) {
    return util.transformValue(this._valueTransformers, value, row).then((function(_this) {
      return function(newValue) {
        return _this._sphere.checkUniqueSku(newValue);
      };
    })(this)).then(function(res) {
      return vote.resolve(res);
    }).fail(function(error) {
      return vote.reject(error);
    }).done();
  };

  RepeatOnDuplicateSkuTransformer.prototype._startElection = function(value, row, election, myVote, round, lastDisagreement) {
    if (round > this._attempts) {
      return Q.reject(lastDisagreement);
    } else {
      this._clearGroupContext(row);
      this._decideMyVote(value, row, myVote.defer);
      return Q.all(_.map(election, function(voter) {
        return voter.promise;
      })).then((function(_this) {
        return function(consensus) {
          return consensus[_this._myGroupIdx(row)];
        };
      })(this)).fail((function(_this) {
        return function(disagreement) {
          var myNextVote, nextElection, nextRound, _ref;
          if (disagreement instanceof DuplicateSku) {
            _ref = _this._setupElections(row, round + 1), nextElection = _ref[0], myNextVote = _ref[1], nextRound = _ref[2];
            return _this._startElection(value, row, nextElection, myNextVote, nextRound, disagreement);
          } else {
            return Q.reject(error);
          }
        };
      })(this));
    }
  };

  RepeatOnDuplicateSkuTransformer.prototype.transform = function(value, row) {
    var election, myVote, round, _ref;
    _ref = this._setupElections(row), election = _ref[0], myVote = _ref[1], round = _ref[2];
    return this._startElection(value, row, election, myVote, round);
  };

  return RepeatOnDuplicateSkuTransformer;

})(transformer.ValueTransformer);

ErrorStatusCode = (function(_super) {
  __extends(ErrorStatusCode, _super);

  function ErrorStatusCode(code, body) {
    this.code = code;
    this.body = body;
    this.message = "Status code is " + this.code + ": " + (JSON.stringify(this.body));
    this.name = 'ErrorStatusCode';
    Error.captureStackTrace(this, this);
  }

  return ErrorStatusCode;

})(Error);

DuplicateSku = (function(_super) {
  __extends(DuplicateSku, _super);

  function DuplicateSku(sku) {
    this.message = "Duplicate SKU '" + sku + "'";
    this.name = 'DuplicateSku';
    Error.captureStackTrace(this, this);
  }

  return DuplicateSku;

})(Error);

OfflineSphereService = (function() {
  function OfflineSphereService(options) {
    this._counters = [];
  }

  OfflineSphereService.prototype.getAndIncrementCounter = function(options) {
    var counter;
    counter = _.find(this._counters, function(c) {
      return c.name === options.name;
    });
    if (!counter) {
      counter = _.clone(options);
      counter.currentValue = counter.initial;
      this._counters.push(counter);
    }
    counter.currentValue = this._nexCounterValue(counter);
    return Q(counter.currentValue);
  };

  OfflineSphereService.prototype._nexCounterValue = function(config) {
    var newVal;
    newVal = config.currentValue + config.increment;
    if ((newVal > config.max || newVal < config.min) && !config.rotate) {
      throw new Error("Sequence '" + config.name + "' is exhausted! " + (JSON.stringify(config)));
    } else if (newVal > config.max) {
      return min;
    } else if (newVal < config.min) {
      return max;
    } else {
      return newVal;
    }
  };

  OfflineSphereService.prototype.repeatOnDuplicateSku = function(options) {
    return options.valueFn();
  };

  OfflineSphereService.prototype.checkUniqueSku = function(sku) {
    return Q(sku);
  };

  return OfflineSphereService;

})();

SphereService = (function() {
  function SphereService(options) {
    this._sequenceNamespace = "sequence";
    this._client = new Rest(options.connector);
    this._repeater = new Repeater(options.repeater);
    this._incrementQueues = [];
  }

  SphereService.prototype.getAndIncrementCounter = function(options) {
    return this._getIncrementQueue(options).addTask(options);
  };

  SphereService.prototype.repeatOnDuplicateSku = function(options) {
    return new Repeater({
      attempts: options.attempts,
      timeout: 0,
      timeoutType: 'constant'
    }).execute({
      recoverableError: function(e) {
        return e instanceof DuplicateSku;
      },
      task: options.valueFn
    });
  };

  SphereService.prototype.checkUniqueSku = function(sku) {
    var projectionQuery, query;
    projectionQuery = "masterVariant(sku=\"" + sku + "\") or variants(sku=\"" + sku + "\")";
    query = "masterData(current(" + projectionQuery + ") or staged(" + projectionQuery + "))";
    return this._get("/products?limit=1&where=" + (encodeURIComponent(query))).then(function(json) {
      if (json.total > 0) {
        throw new DuplicateSku(sku);
      } else {
        return sku;
      }
    });
  };

  SphereService.prototype._getIncrementQueue = function(options) {
    var queue;
    queue = _.find(this._incrementQueues, function(q) {
      return q.name === options.name;
    });
    if (!queue) {
      queue = new BatchTaskQueue({
        taskFn: _.bind(this._doGetAndIncrementCounter, this)
      });
      this._incrementQueues.push({
        name: options.name,
        queue: queue
      });
      return queue;
    } else {
      return queue.queue;
    }
  };

  SphereService.prototype._get = function(path) {
    var d;
    d = Q.defer();
    this._client.GET(path, function(error, response, body) {
      if (error) {
        return d.reject(error);
      } else if (response.statusCode === 200) {
        return d.resolve(body);
      } else {
        return d.reject(new ErrorStatusCode(response.statusCode, body));
      }
    });
    return d.promise;
  };

  SphereService.prototype._post = function(path, json) {
    var d;
    d = Q.defer();
    this._client.POST(path, json, function(error, response, body) {
      if (error) {
        return d.reject(error);
      } else if (response.statusCode === 200 || response.statusCode === 201) {
        return d.resolve(body);
      } else {
        return d.reject(new ErrorStatusCode(response.statusCode, body));
      }
    });
    return d.promise;
  };

  SphereService.prototype._incrementCounter = function(json, defers) {
    var val, values;
    val = json.value;
    values = _.map(defers, (function(_this) {
      return function(d) {
        var nextVal;
        nextVal = _this._nexCounterValue(val);
        val.currentValue = nextVal;
        return nextVal;
      };
    })(this));
    return this._post("/custom-objects", json).then(function(obj) {
      _.each(defers, function(d, idx) {
        return d.resolve(values[idx]);
      });
      return values;
    });
  };

  SphereService.prototype._nexCounterValue = function(config) {
    var newVal;
    newVal = config.currentValue + config.increment;
    if ((newVal > config.max || newVal < config.min) && !config.rotate) {
      throw new Error("Sequence '" + config.name + "' is exhausted! " + (JSON.stringify(config)));
    } else if (newVal > config.max) {
      return min;
    } else if (newVal < config.min) {
      return max;
    } else {
      return newVal;
    }
  };

  SphereService.prototype._createSequence = function(options) {
    return this._post("/custom-objects", {
      container: this._sequenceNamespace,
      key: options.name,
      value: {
        name: options.name,
        initial: options.initial,
        max: options.max,
        min: options.min,
        increment: options.increment,
        rotate: options.rotate,
        currentValue: options.initial
      }
    });
  };

  SphereService.prototype._doGetAndIncrementCounter = function(tasks) {
    return this._repeater.execute({
      recoverableError: function(e) {
        return e instanceof ErrorStatusCode && e.code === 409;
      },
      task: (function(_this) {
        return function() {
          return _this._get("/custom-objects/" + _this._sequenceNamespace + "/" + tasks[0].options.name).then(function(json) {
            return _this._incrementCounter(json, _.map(tasks, function(t) {
              return t.defer;
            }));
          }).fail(function(error) {
            if (error instanceof ErrorStatusCode && error.code === 404) {
              return _this._createSequence(tasks[0].options).then(function(json) {
                return _this._incrementCounter(json, _.map(tasks, function(t) {
                  return t.defer;
                }));
              });
            } else {
              throw error;
            }
          });
        };
      })(this)
    });
  };

  return SphereService;

})();

module.exports = {
  SphereSequenceTransformer: SphereSequenceTransformer,
  RepeatOnDuplicateSkuTransformer: RepeatOnDuplicateSkuTransformer,
  SphereService: SphereService,
  OfflineSphereService: OfflineSphereService,
  DuplicateSku: DuplicateSku
};
