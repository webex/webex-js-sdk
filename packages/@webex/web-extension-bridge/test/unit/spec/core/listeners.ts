import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import {ListenerSet} from '../../../../src/core/listeners';

describe('core/listeners', () => {
  it('delivers to every listener in order', () => {
    const set = new ListenerSet<(value: string) => void>();
    const calls: string[] = [];

    set.add(() => calls.push('first'));
    set.add(() => calls.push('second'));
    set.emit('x');

    assert.deepEqual(calls, ['first', 'second']);
  });

  it('unsubscribes, idempotently', () => {
    const set = new ListenerSet<() => void>();
    const listener = sinon.stub();
    const off = set.add(listener);

    off();
    off();
    set.emit();

    assert.notCalled(listener);
    assert.equal(set.size, 0);
  });

  it('adding the same listener twice registers it once', () => {
    const set = new ListenerSet<() => void>();
    const listener = sinon.stub();

    set.add(listener);
    set.add(listener);
    set.emit();

    assert.calledOnce(listener);
  });

  it('isolates a throwing listener so the others still receive the event', () => {
    const onError = sinon.stub();
    const set = new ListenerSet<() => void>({onError});
    const after = sinon.stub();

    set.add(() => {
      throw new Error('listener blew up');
    });
    set.add(after);

    assert.doesNotThrow(() => set.emit());
    assert.calledOnce(after);
    assert.calledOnce(onError);
    assert.instanceOf(onError.firstCall.args[0], Error);
  });

  it('survives a listener that unsubscribes during delivery', () => {
    const set = new ListenerSet<() => void>();
    const second = sinon.stub();
    let offSecond = () => undefined as void;

    set.add(() => offSecond());
    offSecond = set.add(second);

    assert.doesNotThrow(() => set.emit());
    assert.calledOnce(second);

    set.emit();
    assert.calledOnce(second);
  });

  it('refuses to grow past the cap', () => {
    const set = new ListenerSet<() => void>({maxListeners: 2});

    set.add(() => undefined);
    set.add(() => undefined);

    assert.throws(() => set.add(() => undefined), RangeError);
    assert.equal(set.size, 2);
  });

  it('still allows re-adding an existing listener at the cap', () => {
    const set = new ListenerSet<() => void>({maxListeners: 1});
    const listener = sinon.stub();

    set.add(listener);

    assert.doesNotThrow(() => set.add(listener));
  });

  it('clears', () => {
    const set = new ListenerSet<() => void>();
    const listener = sinon.stub();

    set.add(listener);
    set.clear();
    set.emit();

    assert.notCalled(listener);
    assert.equal(set.size, 0);
  });
});
