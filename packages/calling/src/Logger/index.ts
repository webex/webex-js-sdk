/* eslint-disable valid-jsdoc */
import {Logger} from '../SDKConnector/types';
import {REPO_NAME} from '../CallingClient/constants';
import {IMetaContext} from '../common/types';
import ExtendedError from '../Errors/catalog/ExtendedError';
import {LOGGING_LEVEL, LogContext, LOGGER, LOG_PREFIX} from './types';

/*
 * These are the order of log levels :-
 *  error - 1
 *  warn -  2
 *  log -   3
 *  info -  4
 *  trace - 5
 *
 *  Where log level n denotes that level 1 -> level n will be logged.
 */

let currentLogLevel = LOGGING_LEVEL.error;

let webexLogger: Logger = console; // Default to console logger

/**
 * A wrapper around console which prints to stderr or stdout
 * based on the level defined.
 *
 * @param message - Log Message to print.
 * @param level -  Log level.
 */
const writeToLogger = (message: string, level: LOGGER) => {
  switch (level) {
    case LOGGER.INFO:
      webexLogger.info(message);
      break;
    case LOGGER.LOG: {
      webexLogger.log(message);
      break;
    }
    case LOGGER.WARN: {
      webexLogger.warn(message);
      break;
    }
    case LOGGER.ERROR: {
      webexLogger.error(message);
      break;
    }
    case LOGGER.TRACE: {
      webexLogger.trace(message);
      break;
    }
    default: {
      // Since this is internal , we shouldn't reach here
    }
  }
};

/**
 * Format the Log message  as 'timestamp Calling SDK - [level]: file:example.ts - method:methodName - Actual log message'.
 *
 * @param  context - File and method.
 * @param level - Log level.
 * @returns - Formatted string.
 */
const format = (context: IMetaContext, level: string): string => {
  const timestamp = new Date().toUTCString();

  return `${REPO_NAME}: ${timestamp}: ${level}: ${LOG_PREFIX.FILE}:${context.file} - ${LOG_PREFIX.METHOD}:${context.method}`;
};

/**
 * Used by the Calling Client to initialize the logger module
 * with a certain level.
 *
 * @param level - Log Level.
 */
const setLogger = (level: string, module: string) => {
  switch (level) {
    case LOGGER.WARN: {
      currentLogLevel = LOGGING_LEVEL.warn;
      break;
    }
    case LOGGER.LOG: {
      currentLogLevel = LOGGING_LEVEL.log;
      break;
    }
    case LOGGER.INFO: {
      currentLogLevel = LOGGING_LEVEL.info;
      break;
    }
    case LOGGER.TRACE: {
      currentLogLevel = LOGGING_LEVEL.trace;
      break;
    }
    default: {
      currentLogLevel = LOGGING_LEVEL.error;
    }
  }

  const message = `Logger initialized for module: ${module} with level: ${currentLogLevel}`;

  writeToLogger(
    `${format({file: 'logger.ts', method: 'setLogger'}, '')}  - ${LOG_PREFIX.MESSAGE}:${message}`,
    LOGGER.INFO
  );
};

/**
 * To retrieve the current log level.
 *
 * @returns - Log level.
 */
const getLogLevel = (): LOGGER => {
  let level;

  switch (currentLogLevel) {
    case LOGGING_LEVEL.warn: {
      level = LOGGER.WARN;
      break;
    }
    case LOGGING_LEVEL.log: {
      level = LOGGER.LOG;
      break;
    }
    case LOGGING_LEVEL.info: {
      level = LOGGER.INFO;
      break;
    }
    case LOGGING_LEVEL.trace: {
      level = LOGGER.TRACE;
      break;
    }
    default: {
      level = LOGGER.ERROR;
    }
  }

  return level;
};

/**
 * Can be used to print only useful information.
 *
 * @param message - Caller emitted string.
 * @param context - File and method which called.
 */
const logMessage = (message: string, context: LogContext) => {
  if (currentLogLevel >= LOGGING_LEVEL.log) {
    writeToLogger(`${format(context, '[LOG]')} - ${LOG_PREFIX.MESSAGE}:${message}`, LOGGER.LOG);
  }
};

/**
 * Can be used to print informational messages.
 *
 * @param message - Caller emitted string.
 * @param context - File and method which called.
 */
const logInfo = (message: string, context: LogContext) => {
  if (currentLogLevel >= LOGGING_LEVEL.info) {
    writeToLogger(`${format(context, '[INFO]')} - ${LOG_PREFIX.MESSAGE}:${message}`, LOGGER.INFO);
  }
};

/**
 * Can be used to print warning messages.
 *
 * @param message - Caller emitted string.
 * @param context - File and method which called.
 */
const logWarn = (message: string, context: LogContext) => {
  if (currentLogLevel >= LOGGING_LEVEL.warn) {
    writeToLogger(`${format(context, '[WARN]')} - ${LOG_PREFIX.MESSAGE}:${message}`, LOGGER.WARN);
  }
};

/**
 * Can be used to print the stack trace of the entire call path.
 *
 * @param message - Caller emitted string.
 * @param context - File and method which called.
 */
const logTrace = (message: string, context: LogContext) => {
  if (currentLogLevel >= LOGGING_LEVEL.trace) {
    writeToLogger(`${format(context, '[TRACE]')} - ${LOG_PREFIX.MESSAGE}:${message}`, LOGGER.TRACE);
  }
};

/**
 * Can be used to print only errors.
 *
 * @param error - Error string .
 * @param context - File and method which called.
 */
const logError = (error: ExtendedError, context: LogContext) => {
  if (currentLogLevel >= LOGGING_LEVEL.error) {
    writeToLogger(
      `${format(context, '[ERROR]')} - !${LOG_PREFIX.ERROR}!${LOG_PREFIX.MESSAGE}:${error.message}`,
      LOGGER.ERROR
    );
  }
};

const setWebexLogger = (logger: Logger) => {
  if (logger) {
    // if logger is not passed, defaults to console
    webexLogger = logger;
  }
};

export default {
  log: logMessage,
  error: logError,
  info: logInfo,
  warn: logWarn,
  trace: logTrace,
  setLogger,
  getLogLevel,
  setWebexLogger,
};
