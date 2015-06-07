var path = require('path');

module.exports = {
  entry: './lib/index.js',
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'pxl.js',
    library: 'pxl',
    libraryTarget: 'umd',
    sourcePrefix: ''
  }
}
