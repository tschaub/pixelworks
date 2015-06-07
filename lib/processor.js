function createProcessor(operations) {
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

function Processor(config) {
  var lines = [
    'var operations = [' + config.operations.map(String).join(',') + '];',
    createProcessor.toString(),
    'var process = createProcessor(operations);',
    'self.addEventListener("message", function(event) {',
      'var buffer = process(event.data);',
      'self.postMessage(buffer, [buffer]);',
    '});'
  ];
  var blob = new Blob(lines, {type: 'text/javascript'});
  var source = URL.createObjectURL(blob);
  var worker = new Worker(source);
  worker.addEventListener('message', this._onWorkerMessage.bind(this));
  this._worker = worker;
  this._callback = config.callback;
}

Processor.prototype._onWorkerMessage = function(event) {
  var data = new Uint8ClampedArray(event.data);
  var output = new ImageData(data, input.width, input.height);
  this._callback(output);
};

Processor.prototype.process = function(input) {
  var buffer = input.data.buffer;
  this._worker.postMessage(buffer, [buffer]);
};

module.exports = Processor;
