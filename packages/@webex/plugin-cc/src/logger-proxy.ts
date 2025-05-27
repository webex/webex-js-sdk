import {Logger, LogContext, LOGGING_LEVEL} from './types';
import {LOG_PREFIX} from './constants';

/**
 * LoggerProxy acts as a static proxy to route logging calls to an injected logger implementation.
 * Ensures a consistent log format and centralizes logging behavior for the SDK.
 */
export default class LoggerProxy {
  /**
   * The static logger instance to be used by the proxy.
   */
  public static logger: Logger;

  /**
   * Initializes the logger proxy with a provided logger implementation.
   *
   * @param {Logger} logger - A logger object implementing standard logging methods.
   */
  public static initialize(logger: Logger): void {
    LoggerProxy.logger = logger;
  }

  /**
   * Logs a generic message using the default log level.
   *
   * @param {string} message - The log message.
   * @param {LogContext} [context={}] - Optional context providing module and method names.
   */
  public static log(message: string, context: LogContext = {}): void {
    if (LoggerProxy.logger) {
      LoggerProxy.logger.log(LoggerProxy.format(LOGGING_LEVEL.log, message, context));
    }
  }

  /**
   * Logs an informational message.
   *
   * @param {string} message - The log message.
   * @param {LogContext} [context={}] - Optional context providing module and method names.
   */
  public static info(message: string, context: LogContext = {}): void {
    if (LoggerProxy.logger) {
      LoggerProxy.logger.info(LoggerProxy.format(LOGGING_LEVEL.info, message, context));
    }
  }

  /**
   * Logs a warning message.
   *
   * @param {string} message - The warning message.
   * @param {LogContext} [context={}] - Optional context providing module and method names.
   */
  public static warn(message: string, context: LogContext = {}): void {
    if (LoggerProxy.logger) {
      LoggerProxy.logger.warn(LoggerProxy.format(LOGGING_LEVEL.warn, message, context));
    }
  }

  /**
   * Logs a trace-level message, useful for debugging.
   *
   * @param {string} message - The trace message.
   * @param {LogContext} [context={}] - Optional context providing module and method names.
   */
  public static trace(message: string, context: LogContext = {}): void {
    if (LoggerProxy.logger) {
      LoggerProxy.logger.trace(LoggerProxy.format(LOGGING_LEVEL.trace, message, context));
    }
  }

  /**
   * Logs an error message.
   *
   * @param {string} message - The error message.
   * @param {LogContext} [context={}] - Optional context providing module and method names.
   */
  public static error(message: string, context: LogContext = {}): void {
    if (LoggerProxy.logger) {
      LoggerProxy.logger.error(LoggerProxy.format(LOGGING_LEVEL.error, message, context));
    }
  }

  /**
   * Formats a log message with timestamp, log level, and context details.
   *
   * @private
   * @param {LOGGING_LEVEL} level - Logging level (e.g., info, error).
   * @param {string} message - The message to be logged.
   * @param {LogContext} context - Context containing module and method metadata.
   * @returns {string} The formatted log string.
   */
  private static format(level: LOGGING_LEVEL, message: string, context: LogContext): string {
    const timestamp = new Date().toISOString();
    const moduleName = context.module || 'unknown';
    const methodName = context.method || 'unknown';

    return `${timestamp} ${LOG_PREFIX} - [${level}]: module:${moduleName} - method:${methodName} - ${message}`;
  }
}
