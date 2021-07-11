let hasImageData = true;
try {
  new ImageData(10, 10);
} catch (_) {
  hasImageData = false;
}

let context;

function newImageData(data, width, height) {
  if (hasImageData) {
    return new ImageData(data, width, height);
  }

  if (!context) {
    context = document.createElement('canvas').getContext('2d');
  }
  const imageData = context.createImageData(width, height);
  imageData.data.set(data);
  return imageData;
}

exports.newImageData = newImageData;
