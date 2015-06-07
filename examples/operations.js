var luminance = function(pixel) {
  var l = 0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2];
  pixel[0] = l;
  pixel[1] = l;
  pixel[2] = l;
}

var inputContext = document.getElementById('input').getContext('2d');
var outputContext = document.getElementById('output').getContext('2d');
var image = new Image();

var worker = new pxl.Processor({
  threads: 2,
  operations: [luminance]
});

image.onload = function() {
  inputContext.drawImage(image, 0, 0);
  var canvas = inputContext.canvas;
  var input = inputContext.getImageData(0, 0, canvas.width, canvas.height);
  worker.process(input).then(function(output) {
    outputContext.putImageData(output, 0, 0);
  }, function(err) {
    throw err;
  });
};

image.src = '0.jpg';
