module.exports = function(config) {
  config.set({
    browsers: [process.env.CI ? 'ChromeHeadless' : 'Chrome'],
    frameworks: ['mocha'],
    preprocessors: {
      '**/*.test.js': ['esbuild']
    },
    files: ['**/*.test.js']
  });
};
