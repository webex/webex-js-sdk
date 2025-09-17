import LoggerProxy from '../../../src/logger-proxy';

describe('LoggerProxy sessionInstance formatting', () => {
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
    };
  });

  it('includes provided sessionInstance value in formatted logs', () => {
    LoggerProxy.initialize(mockLogger, 'tab2');

    LoggerProxy.info('world', {module: 'test', method: 'info'});

    expect(mockLogger.info).toHaveBeenCalled();
    const payload = mockLogger.info.mock.calls[0][0] as string;
    expect(payload.includes(' - session:tab2')).toBe(true);
  });
});

