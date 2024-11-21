import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {applyDecorators} from '@webex/common/src/apply-decorators';

describe('applyDecorators()', () => {
  it('applies the decorators in order', () => {
    const method = sinon.stub();

    const obj = {
      method
    }

    const decorator1 = (fn) => {
      return function decorated1() {
        fn.apply(this, [...arguments, 'decorated1']);
      };
    }

    const decorator2 = (fn) => {
      return function decorated2() {
        fn.apply(this, [...arguments, 'decorated2']);
      };
    }

    applyDecorators(obj, {
      method: [decorator1, decorator2]
    });

    obj.method('arg');

    assert.calledOnce(method);

    assert.calledWithExactly(method, 'arg', 'decorated2', 'decorated1');
  });
});
