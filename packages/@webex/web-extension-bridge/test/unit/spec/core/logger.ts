import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import {createLogger, pickLogContext} from '../../../../src/core/logger';

describe('core/logger', () => {
  const sink = () => ({
    debug: sinon.stub(),
    info: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
  });

  it('is silent below warn by default', () => {
    const target = sink();
    const logger = createLogger({sink: target});

    logger.debug('a');
    logger.info('b');

    assert.notCalled(target.debug);
    assert.notCalled(target.info);
  });

  it('always reports warn and error', () => {
    const target = sink();
    const logger = createLogger({sink: target});

    logger.warn('careful');
    logger.error('broken');

    assert.calledOnce(target.warn);
    assert.calledOnce(target.error);
  });

  it('reports debug and info once enabled', () => {
    const target = sink();
    const logger = createLogger({debug: true, sink: target});

    logger.debug('a');
    logger.info('b');

    assert.calledOnce(target.debug);
    assert.calledOnce(target.info);
  });

  it('prefixes messages so bridge lines are greppable', () => {
    const target = sink();

    createLogger({sink: target, prefix: '[te]'}).warn('hello');

    assert.calledWith(target.warn, '[te] hello');
  });

  describe('pickLogContext', () => {
    it('keeps only allow-listed metadata', () => {
      const picked = pickLogContext({
        channel: 'webex-bridge',
        topic: 'demo',
        tabId: 4,
        // Not part of LogContext. Present because context values often come off the
        // wire, and the allow-list is what keeps a payload out of a log sink.
        payload: {secret: 'do not log me'},
        session: 'token',
      } as never);

      assert.deepEqual(picked, {channel: 'webex-bridge', topic: 'demo', tabId: 4});
    });

    it('returns undefined when there is nothing to report', () => {
      assert.isUndefined(pickLogContext(undefined));
      assert.isUndefined(pickLogContext({}));
      assert.isUndefined(pickLogContext({topic: undefined}));
    });

    it('keeps a null correlation id, which is meaningful', () => {
      assert.deepEqual(pickLogContext({correlationId: null}), {correlationId: null});
    });
  });

  it('never passes a payload through to the sink', () => {
    const target = sink();
    const logger = createLogger({sink: target});

    logger.warn('dropped', {topic: 'demo', payload: {card: '4111111111111111'}} as never);

    assert.notInclude(JSON.stringify(target.warn.firstCall.args), '4111111111111111');
  });
});
