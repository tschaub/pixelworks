var swap = function(pixel) {
  var b = pixel[0];
  pixel[0] = pixel[2];
  pixel[2] = b;
}

var inputContext = document.getElementById('input').getContext('2d');
var outputContext = document.getElementById('output').getContext('2d');
var image = new Image();

var worker = new pxl.Worker({
  operations: [swap],
  callback: function(output) {
    outputContext.putImageData(output, 0, 0);
  }
});

image.onload = function() {
  inputContext.drawImage(image, 0, 0);
  var canvas = inputContext.canvas;
  var input = inputContext.getImageData(0, 0, canvas.width, canvas.height);
  worker.process(input);
};

image.src = '0.jpg';
