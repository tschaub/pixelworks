/* eslint-env mocha */
var assert = require('chai').assert;
var sinon = require('sinon');

var Processor = require('../../lib/processor');

describe('Processor', function() {

  var identity;
  beforeEach(function() {
    identity = sinon.spy(function(inputs) {
      return inputs;
    });
  });

  describe('constructor', function() {
    it('creates a new processor', function() {
      var processor = new Processor({
        operations: [identity]
      });

      assert.instanceOf(processor, Processor);
    });
  });

  describe('#process()', function() {
    it('runs operations', function(done) {
      var processor = new Processor({
        operations: [identity]
      });

      var array = new Uint8ClampedArray([1, 2, 3, 4]);
      var input = new ImageData(array, 1, 1);
      var meta = {foo: 'bar'};

      processor.process([input], meta, function(err, outputs, m) {
        if (err) {
          done(err);
          return;
        }
        assert.deepEqual(m, meta);
        done();
      });

    });
  });

});
