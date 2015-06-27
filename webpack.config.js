var path = require('path');

module.exports = {
  entry: './lib/index.js',
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'pixelworks.js',
    library: 'pixelworks',
    libraryTarget: 'umd',
    sourcePrefix: ''
  }
}
