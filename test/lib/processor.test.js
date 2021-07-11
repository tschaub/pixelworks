/* eslint-env mocha */

const Processor = require('../../lib/processor');
const chai = require('chai');
const newImageData = require('../../lib/util').newImageData;
const spies = require('chai-spies');

chai.use(spies);
const assert = chai.assert;

describe('Processor', function() {
  const identity = function(inputs) {
    return inputs[0];
  };

  describe('constructor', function() {
    it('creates a new processor', function() {
      const processor = new Processor({
        operation: identity
      });

      assert.instanceOf(processor, Processor);
    });
  });

  describe('#process()', function() {
    it('calls operation with input pixels', function(done) {
      const processor = new Processor({
        operation: function(inputs, meta) {
          ++meta.count;
          const pixel = inputs[0];
          for (let i = 0, ii = pixel.length; i < ii; ++i) {
            meta.sum += pixel[i];
          }
          return pixel;
        }
      });

      const array = new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]);
      const input = newImageData(array, 1, 2);

      processor.process([input], {count: 0, sum: 0}, function(err, output, m) {
        if (err) {
          done(err);
          return;
        }
        assert.equal(m.count, 2);
        assert.equal(m.sum, 36);
        done();
      });
    });

    it('calls callback with processed image data', function(done) {
      const processor = new Processor({
        operation: function(inputs) {
          const pixel = inputs[0];
          pixel[0] *= 2;
          pixel[1] *= 2;
          pixel[2] *= 2;
          pixel[3] *= 2;
          return pixel;
        }
      });

      const array = new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]);
      const input = newImageData(array, 1, 2);

      processor.process([input], {}, function(err, output, m) {
        if (err) {
          done(err);
          return;
        }
        assert.instanceOf(output, ImageData);
        assert.deepEqual(
          output.data,
          new Uint8ClampedArray([2, 4, 6, 8, 10, 12, 14, 16])
        );
        done();
      });
    });

    it('allows library functions to be called', function(done) {
      const lib = {
        sum: function(a, b) {
          return a + b;
        },
        diff: function(a, b) {
          return a - b;
        }
      };

      const normalizedDiff = function(pixels) {
        const pixel = pixels[0];
        const r = pixel[0];
        const g = pixel[1];
        const nd = diff(r, g) / sum(r, g); // eslint-disable-line no-undef
        const index = Math.round((255 * (nd + 1)) / 2);
        return [index, index, index, pixel[3]];
      };

      const processor = new Processor({
        operation: normalizedDiff,
        lib: lib
      });

      const array = new Uint8ClampedArray([10, 2, 0, 0, 5, 8, 0, 1]);
      const input = newImageData(array, 1, 2);

      processor.process([input], {}, function(err, output, m) {
        if (err) {
          done(err);
          return;
        }
        assert.instanceOf(output, ImageData);
        const v0 = Math.round((255 * (1 + 8 / 12)) / 2);
        const v1 = Math.round((255 * (1 + -3 / 13)) / 2);
        assert.deepEqual(
          output.data,
          new Uint8ClampedArray([v0, v0, v0, 0, v1, v1, v1, 1])
        );

        done();
      });
    });

    it('calls callbacks for each call', function(done) {
      const processor = new Processor({
        operation: identity
      });

      let calls = 0;

      function createCallback(index) {
        return function(err, output, meta) {
          if (err) {
            done(err);
            return;
          }
          assert.instanceOf(output, ImageData);
          ++calls;
        };
      }

      for (let i = 0; i < 5; ++i) {
        const input = newImageData(new Uint8ClampedArray([1, 2, 3, 4]), 1, 1);
        processor.process([input], {}, createCallback(i));
      }

      setTimeout(function() {
        assert.equal(calls, 5);
        done();
      }, 1000);
    });

    it('respects max queue length', function(done) {
      const processor = new Processor({
        queue: 1,
        operation: identity
      });

      const log = [];

      function createCallback(index) {
        return function(err, output, meta) {
          if (err) {
            done(err);
            return;
          }
          log.push(output);
        };
      }

      for (let i = 0; i < 5; ++i) {
        const input = newImageData(new Uint8ClampedArray([1, 2, 3, 4]), 1, 1);
        processor.process([input], {}, createCallback(i));
      }

      setTimeout(function() {
        assert.lengthOf(log, 5);
        assert.isNull(log[0], 'first call null');
        assert.isNull(log[1], 'second call null');
        assert.isNull(log[2], 'third call null');
        assert.instanceOf(log[3], ImageData);
        assert.instanceOf(log[4], ImageData);
        done();
      }, 1000);
    });
  });

  describe('#process() - faux worker', function() {
    let identitySpy;
    beforeEach(function() {
      identitySpy = chai.spy(identity);
    });

    it('calls operation with input pixels', function(done) {
      const processor = new Processor({
        threads: 0,
        operation: identitySpy
      });

      const array = new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]);
      const input = newImageData(array, 1, 2);

      processor.process([input], {}, function(err, output, m) {
        if (err) {
          done(err);
          return;
        }
        assert.lengthOf(identitySpy.__spy.calls, 2);
        const first = identitySpy.__spy.calls[0];
        assert.lengthOf(first, 2);
        done();
      });
    });

    it('passes meta object to operations', function(done) {
      const processor = new Processor({
        threads: 0,
        operation: identitySpy
      });

      const array = new Uint8ClampedArray([1, 2, 3, 4]);
      const input = newImageData(array, 1, 1);
      const meta = {foo: 'bar'};

      processor.process([input], meta, function(err, output, m) {
        if (err) {
          done(err);
          return;
        }
        assert.deepEqual(m, meta);
        assert.lengthOf(identitySpy.__spy.calls, 1);
        done();
      });
    });
  });

  describe('#destroy()', function() {
    it('stops callbacks from being called', function(done) {
      const processor = new Processor({
        operation: identity
      });

      const array = new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]);
      const input = newImageData(array, 1, 2);

      processor.process([input], {}, function() {
        done(new Error('Expected abort to stop callback from being called'));
      });

      processor.destroy();
      setTimeout(done, 500);
    });
  });

  describe('#destroy() - faux worker', function() {
    it('stops callbacks from being called', function(done) {
      const processor = new Processor({
        threads: 0,
        operation: identity
      });

      const array = new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]);
      const input = newImageData(array, 1, 2);

      processor.process([input], {}, function() {
        done(new Error('Expected abort to stop callback from being called'));
      });

      processor.destroy();
      setTimeout(done, 20);
    });
  });
});
