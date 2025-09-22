import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {withDecorators} from '@webex/common/src/with-decorators';

describe('withDecorators()', () => {
  it('applies the decorators in order', () => {
    const method = sinon.stub();

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

    const result = withDecorators([decorator1, decorator2], method);

    result('arg');

    assert.calledOnce(method);

    assert.calledWithExactly(method, 'arg', 'decorated2', 'decorated1');
  });
});
