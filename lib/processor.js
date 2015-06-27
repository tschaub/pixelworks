function createMinion(operations) {
  var numOps = operations.length;
  var pixels, arrays;
  return function(data) {
    /* eslint-disable dot-notation */
    // bracket notation for minification support
    var buffers = data['buffers'];
    var meta = data['meta'];
    /* eslint-enable dot-notation */
    var numBuffers = buffers.length;
    var numBytes = buffers[0].byteLength;
    if (!pixels) {
      arrays = new Array(numBuffers);
      pixels = new Array(numBuffers);
      for (var b = 0; b < numBuffers; ++b) {
        arrays[b] = new Uint8ClampedArray(buffers[b]);
        pixels[b] = [0, 0, 0, 0];
      }
    }
    var output = new Uint8ClampedArray(numBytes);
    for (var i = 0; i < numBytes; i += 4) {
      for (var j = 0; j < numBuffers; ++j) {
        var array = arrays[j];
        pixels[j][0] = array[i];
        pixels[j][1] = array[i + 1];
        pixels[j][2] = array[i + 2];
        pixels[j][3] = array[i + 3];
      }
      for (var k = 0; k < numOps; ++k) {
        operations[k](pixels, meta);
      }
      var pixel = pixels[0];
      output[i] = pixel[0];
      output[i + 1] = pixel[1];
      output[i + 2] = pixel[2];
      output[i + 3] = pixel[3];
    }
    return output.buffer;
  };
}

function createWorker(operations) {
  var lines = [
    'var ops = [' + operations.map(String).join(',') + '];',
    'var minion = (' + createMinion.toString() + ')(ops);',
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

Processor.prototype.process = function(inputs, meta) {
  var promise = new Promise(function(resolve, reject) {
    this._enqueue({
      resolve: resolve,
      reject: reject,
      inputs: inputs,
      meta: meta
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
    var job = this._job = this._queue.shift();
    var buffers = job.inputs.map(function(input) {
      return input.data.buffer;
    });
    var threads = this._workers.length;
    this._running = threads;
    if (threads === 1) {
      this._workers[0].postMessage({
        'buffers': buffers,
        'meta': job.meta
      }, buffers);
    } else {
      var length = job.inputs[0].data.length;
      var segmentLength = 4 * Math.ceil(length / 4 / threads);
      for (var i = 0; i < threads; ++i) {
        var offset = i * segmentLength;
        var slices = [];
        for (var j = 0, jj = buffers.length; j < jj; ++j) {
          slices.push(buffers[i].slice(offset, offset + segmentLength));
        }
        this._workers[i].postMessage({
          'buffers': slices,
          'meta': job.meta
        }, slices);
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
    var length = job.inputs[0].data.length;
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
  job.resolve(new ImageData(data, job.inputs[0].width, job.inputs[0].height));
  this._dispatch();
};

module.exports = Processor;
