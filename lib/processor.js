function createMinion(operations) {
  var numOps = operations.length;
  var pixel = [0, 0, 0, 0];
  return function(buffer) {
    var data = new Uint8ClampedArray(buffer);
    for (var i = 0, ii = data.length; i < ii; i += 4) {
      pixel[0] = data[i];
      pixel[1] = data[i + 1];
      pixel[2] = data[i + 2];
      pixel[3] = data[i + 3];
      for (var j = 0; j < numOps; ++j) {
        operations[j](pixel);
      }
      data[i] = pixel[0];
      data[i + 1] = pixel[1];
      data[i + 2] = pixel[2];
      data[i + 3] = pixel[3];
    }
    return data.buffer;
  }
}

function createWorker(operations) {
  var lines = [
    'var operations = [' + operations.map(String).join(',') + '];',
    createMinion.toString(),
    'var minion = createMinion(operations);',
    'self.addEventListener("message", function(event) {',
      'var buffer = minion(event.data);',
      'self.postMessage(buffer, [buffer]);',
    '});'
  ];
  var blob = new Blob(lines, {type: 'text/javascript'});
  var source = URL.createObjectURL(blob);
  return new Worker(source);
}

function Processor(config) {
  var threads = config.threads || 1;
  var workers = [];
  for (var i = 0; i < threads; ++i) {
    var worker = createWorker(config.operations);
    worker.addEventListener('message', this._onWorkerMessage.bind(this, i));
    workers[i] = worker;
  }
  this._workers = workers;
  this._queue = [];
  this._maxQueueLength = ('queue' in config) ? config.queue : Infinity;
  this._running = 0;
  this._bufferLookup = {};
  this._job = null;
}

Processor.prototype.process = function(input) {
  var promise = new Promise(function(resolve, reject) {
    this._enqueue({
      resolve: resolve,
      reject: reject,
      input: input
    });
  }.bind(this));
  this._dispatch();
  return promise;
};

Processor.prototype._enqueue = function(job) {
  this._queue.push(job);
  while (this._queue.length > this._maxQueueLength) {
    this._queue.shift().resolve(null);
  }
};

Processor.prototype._dispatch = function() {
  if (this._running === 0 && this._queue.length > 0) {
    this._job = this._queue.shift();
    var buffer = this._job.input.data.buffer;
    var threads = this._workers.length;
    this._running = threads;
    if (threads === 1) {
      this._workers[0].postMessage(buffer, [buffer]);
    } else {
      var length = this._job.input.data.length;
      var segmentLength = 4 * Math.ceil(length / 4 / threads);
      for (var i = 0; i < threads; ++i) {
        var offset = i * segmentLength;
        var slice = buffer.slice(offset, offset + segmentLength);
        this._workers[i].postMessage(slice, [slice]);
      }
    }
  }
};

Processor.prototype._onWorkerMessage = function(index, event) {
  this._bufferLookup[index] = event.data;
  --this._running;
  if (this._running === 0) {
    this._resolveJob();
  }
};

Processor.prototype._resolveJob = function() {
  var job = this._job;
  var threads = this._workers.length;
  var data;
  if (threads === 1) {
    data = new Uint8ClampedArray(this._bufferLookup[0]);
  } else {
    var length = job.input.data.length;
    data = new Uint8ClampedArray(length);
    var segmentLength = 4 * Math.ceil(length / 4 / threads);
    for (var i = 0; i < threads; ++i) {
      var buffer = this._bufferLookup[i];
      var offset = i * segmentLength;
      data.set(new Uint8ClampedArray(buffer), offset);
    }
  }
  this._job = null;
  this._bufferLookup = {};
  job.resolve(new ImageData(data, job.input.width, job.input.height));
  this._dispatch();
};

module.exports = Processor;
