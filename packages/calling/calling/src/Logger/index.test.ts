import ExtendedError from 'Errors/catalog/ExtendedError';
import {LOGGER} from '../index';
import log from '.';

describe('Coverage tests for logger', () => {
  let logLevel: LOGGER;

  const logSpy = jest.spyOn(console, 'log');
  const traceSpy = jest.spyOn(console, 'trace');
  const warnSpy = jest.spyOn(console, 'warn');
  const errorSpy = jest.spyOn(console, 'error');

  beforeEach(() => {
    logLevel = LOGGER.ERROR;
  });

  const fakePrint = 'Example log statement';
  const dummyContext = {
    file: 'logger.test.ts',
    method: 'dummy',
  };

  it('Set the log level to error  and verify that all levels are not executed except error', () => {
    log.info(fakePrint, dummyContext);
    expect(logSpy).not.toHaveBeenCalledTimes(1);

    log.log(fakePrint, dummyContext);
    expect(logSpy).not.toHaveBeenCalledTimes(1);

    log.warn(fakePrint, dummyContext);
    expect(warnSpy).not.toHaveBeenCalledTimes(1);

    log.trace(fakePrint, dummyContext);
    expect(traceSpy).not.toHaveBeenCalledTimes(1);

    log.error(new Error(fakePrint) as ExtendedError, dummyContext);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('Set the logger and verify the level', () => {
    expect(logLevel).toStrictEqual(LOGGER.ERROR);
    log.setLogger(LOGGER.TRACE);
    expect(log.getLogLevel()).toStrictEqual(LOGGER.TRACE);
  });

  it('Set the log level to  Info and verify levels below info are executed or not', () => {
    log.setLogger(LOGGER.INFO);

    log.info(fakePrint, dummyContext);
    expect(logSpy).toHaveBeenCalledTimes(2);

    log.log(fakePrint, dummyContext);
    expect(logSpy).toHaveBeenCalledTimes(3);

    log.warn(fakePrint, dummyContext);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    log.trace(fakePrint, dummyContext);
    expect(traceSpy).not.toHaveBeenCalledTimes(1);
  });

  it('Set the log level to Trace  and verify that all levels are executed', () => {
    log.setLogger(LOGGER.TRACE);

    log.info(fakePrint, dummyContext);
    expect(logSpy).toHaveBeenCalledTimes(2); // one during initialization and one with the statement

    log.log(fakePrint, dummyContext);
    expect(logSpy).toHaveBeenCalledTimes(3); // +1 because both info and log internally use console.log

    log.warn(fakePrint, dummyContext);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    log.trace(fakePrint, dummyContext);
    expect(traceSpy).toHaveBeenCalledTimes(1);
  });
});
