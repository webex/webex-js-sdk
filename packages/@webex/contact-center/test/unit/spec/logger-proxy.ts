import LoggerProxy from '../../../src/logger-proxy';

describe('LoggerProxy', () => {
  beforeEach(() => {
    // Reset between tests
    (LoggerProxy as any).logger = undefined;
  });

  it('no-ops when logger is not initialized', () => {
    expect(() => {
      LoggerProxy.log('msg');
      LoggerProxy.info('msg');
      LoggerProxy.warn('msg');
      LoggerProxy.trace('msg');
      LoggerProxy.error('msg');
    }).not.toThrow();
  });

  it('routes calls to the injected logger with formatted context', () => {
    const logger = {
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      trace: jest.fn(),
      error: jest.fn(),
    };

    LoggerProxy.initialize(logger as any);

    LoggerProxy.log('hello', {module: 'm', method: 'fn', interactionId: 'i', trackingId: 't'});
    expect(logger.log).toHaveBeenCalled();
    expect(String(logger.log.mock.calls[0][0])).toContain('module:m - method:fn');
    expect(String(logger.log.mock.calls[0][0])).toContain('interactionId:i');
    expect(String(logger.log.mock.calls[0][0])).toContain('trackingId:t');

    LoggerProxy.info('hello', {module: 'm', method: 'fn'});
    LoggerProxy.warn('hello', {module: 'm', method: 'fn'});
    LoggerProxy.trace('hello', {module: 'm', method: 'fn'});
    LoggerProxy.error('hello', {module: 'm', method: 'fn'});
    expect(logger.info).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('handles unserializable data and different error shapes', () => {
    const logger = {
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      trace: jest.fn(),
      error: jest.fn(),
    };
    LoggerProxy.initialize(logger as any);

    const circular: any = {};
    circular.self = circular;

    LoggerProxy.info('msg', {module: 'm', method: 'fn', data: circular, error: 'oops'});
    expect(String(logger.info.mock.calls[0][0])).toContain('data:[object]');
    expect(String(logger.info.mock.calls[0][0])).toContain('error:oops');

    const err = new Error('boom');
    LoggerProxy.error('msg', {module: 'm', method: 'fn', error: err});
    const errorLine = String(logger.error.mock.calls[0][0]);
    expect(errorLine).toContain('error:Error:boom');
    expect(errorLine).toContain('stack:');
  });
});

