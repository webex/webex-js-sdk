import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import withDecorators from '@webex/common/src/with-decorators';

describe('withDecorators()', () => {
  it('applies the decorators in order', () => {
    const method = sinon.stub().returns('original-result');

    // ES2015-style decorators that take target, prop, and descriptor
    const decorator1 = (target, prop, descriptor) => {
      const originalFn = descriptor.value;
      descriptor.value = function decorated1(...args) {
        return originalFn.call(this, ...args, 'decorated1');
      };
      return descriptor;
    };

    const decorator2 = (target, prop, descriptor) => {
      const originalFn = descriptor.value;
      descriptor.value = function decorated2(...args) {
        return originalFn.call(this, ...args, 'decorated2');
      };
      return descriptor;
    };

    const result = withDecorators([decorator1, decorator2], method);

    const returnValue = result('arg');

    assert.calledOnce(method);
    assert.calledWithExactly(method, 'arg', 'decorated2', 'decorated1');
    assert.equal(returnValue, 'original-result');
  });

  it('preserves function context and returns value', () => {
    const context = {name: 'test-context'};
    const method = sinon.stub().returns('test-return');

    const decorator = (target, prop, descriptor) => {
      const originalFn = descriptor.value;
      descriptor.value = function decoratedMethod(...args) {
        // Ensure context is preserved
        assert.equal(this, context);
        return originalFn.call(this, ...args, 'decorator-arg');
      };
      return descriptor;
    };

    const result = withDecorators([decorator], method);
    const returnValue = result.call(context, 'original-arg');

    assert.calledOnce(method);
    assert.calledWithExactly(method, 'original-arg', 'decorator-arg');
    assert.equal(returnValue, 'test-return');
  });

  it('handles empty decorator array', () => {
    const method = sinon.stub().returns('unchanged');

    const result = withDecorators([], method);
    const returnValue = result('test-arg');

    assert.calledOnce(method);
    assert.calledWithExactly(method, 'test-arg');
    assert.equal(returnValue, 'unchanged');
    assert.equal(result, method); // Should return the original method
  });
});
