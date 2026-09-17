import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import {DEFAULT_LOG_LEVEL, createLogger, pickLogContext} from '../../../../src/core/logger';
import type {LogLevel, LogLevelSetting} from '../../../../src/core/logger';

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

  it('reports warn and error by default', () => {
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

  describe('logLevel threshold', () => {
    const LEVELS: readonly LogLevel[] = ['error', 'warn', 'info', 'debug'];

    // Each threshold and the complete set of levels it admits, so a level silently
    // moving across a boundary fails here rather than in a consumer's log.
    const ADMITTED: Readonly<Record<LogLevelSetting, readonly LogLevel[]>> = {
      silent: [],
      error: ['error'],
      warn: ['error', 'warn'],
      info: ['error', 'warn', 'info'],
      debug: ['error', 'warn', 'info', 'debug'],
    };

    Object.entries(ADMITTED).forEach(([logLevel, admitted]) => {
      it(`at '${logLevel}' emits ${admitted.length === 0 ? 'nothing' : admitted.join(', ')}`, () => {
        const target = sink();
        const logger = createLogger({logLevel: logLevel as LogLevelSetting, sink: target});

        LEVELS.forEach((level) => logger[level]('m'));

        LEVELS.forEach((level) => {
          if (admitted.includes(level)) {
            assert.calledOnceWithExactly(target[level], '[web-extension-bridge] m', undefined);
          } else {
            assert.notCalled(target[level]);
          }
        });
      });
    });

    it("'silent' suppresses warn and error without needing a no-op sink", () => {
      const target = sink();
      const logger = createLogger({logLevel: 'silent', sink: target});

      logger.warn('careful');
      logger.error('broken');

      assert.notCalled(target.warn);
      assert.notCalled(target.error);
    });
  });

  describe('the debug alias', () => {
    it('still means logLevel debug', () => {
      const target = sink();
      const logger = createLogger({debug: true, sink: target});

      logger.debug('a');

      assert.calledOnceWithExactly(target.debug, '[web-extension-bridge] a', undefined);
    });

    it('loses to an explicit logLevel, which is the more specific request', () => {
      const target = sink();
      const logger = createLogger({debug: true, logLevel: 'warn', sink: target});

      logger.debug('a');
      logger.warn('b');

      assert.notCalled(target.debug);
      assert.calledOnce(target.warn);
    });

    it('does not raise the threshold when false alongside a verbose logLevel', () => {
      const target = sink();
      const logger = createLogger({debug: false, logLevel: 'debug', sink: target});

      logger.debug('a');

      assert.calledOnce(target.debug);
    });
  });

  describe('an unrecognised logLevel', () => {
    it('falls back to the default rather than refusing to build a logger', () => {
      const target = sink();
      const logger = createLogger({logLevel: 'verbose' as LogLevelSetting, sink: target});

      logger.info('quiet');
      logger.warn('loud');

      assert.notCalled(target.info);
      assert.calledWith(target.warn, '[web-extension-bridge] loud');
    });

    it('says so, so it cannot be mistaken for logging that is merely quiet', () => {
      const target = sink();

      createLogger({logLevel: 'verbose' as LogLevelSetting, sink: target});

      assert.calledOnceWithExactly(
        target.warn,
        '[web-extension-bridge] unrecognised logLevel, falling back',
        {reason: DEFAULT_LOG_LEVEL}
      );
    });
  });

  describe('without a sink', () => {
    afterEach(() => sinon.restore());

    it('writes every admitted level to the console at its own level', () => {
      const stubs = {
        debug: sinon.stub(console, 'debug'),
        info: sinon.stub(console, 'info'),
        warn: sinon.stub(console, 'warn'),
        error: sinon.stub(console, 'error'),
      };
      const logger = createLogger({logLevel: 'debug'});

      logger.debug('a');
      logger.info('b');
      logger.warn('c');
      logger.error('d');

      assert.calledOnceWithExactly(stubs.debug, '[web-extension-bridge] a', '');
      assert.calledOnceWithExactly(stubs.info, '[web-extension-bridge] b', '');
      assert.calledOnceWithExactly(stubs.warn, '[web-extension-bridge] c', '');
      assert.calledOnceWithExactly(stubs.error, '[web-extension-bridge] d', '');
    });

    it('still honours the threshold', () => {
      const debugStub = sinon.stub(console, 'debug');
      const warnStub = sinon.stub(console, 'warn');

      createLogger().debug('a');

      assert.notCalled(debugStub);
      assert.notCalled(warnStub);
    });
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
