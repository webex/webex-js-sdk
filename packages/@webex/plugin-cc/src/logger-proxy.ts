import {Logger, LogContext, LOGGING_LEVEL} from './types';
import {LOG_PREFIX} from './constants';

export default class LoggerProxy {
  public static logger: Logger;

  public static initialize(logger: Logger): void {
    LoggerProxy.logger = logger;
  }

  public static log(message: string, context: LogContext = {}): void {
    if (LoggerProxy.logger) {
      LoggerProxy.logger.log(LoggerProxy.format(LOGGING_LEVEL.log, message, context));
    }
  }

  public static info(message: string, context: LogContext = {}): void {
    if (LoggerProxy.logger) {
      LoggerProxy.logger.info(LoggerProxy.format(LOGGING_LEVEL.info, message, context));
    }
  }

  public static warn(message: string, context: LogContext = {}): void {
    if (LoggerProxy.logger) {
      LoggerProxy.logger.warn(LoggerProxy.format(LOGGING_LEVEL.warn, message, context));
    }
  }

  public static trace(message: string, context: LogContext = {}): void {
    if (LoggerProxy.logger) {
      LoggerProxy.logger.trace(LoggerProxy.format(LOGGING_LEVEL.trace, message, context));
    }
  }

  public static error(message: string, context: LogContext = {}): void {
    if (LoggerProxy.logger) {
      LoggerProxy.logger.error(LoggerProxy.format(LOGGING_LEVEL.error, message, context));
    }
  }

  private static format(level: LOGGING_LEVEL, message: string, context: LogContext): string {
    const timestamp = new Date().toISOString();
    const moduleName = context.module || 'unknown';
    const methodName = context.method || 'unknown';

    return `${timestamp} ${LOG_PREFIX} - [${level}]: module:${moduleName} - method:${methodName} - ${message}`;
  }
}
