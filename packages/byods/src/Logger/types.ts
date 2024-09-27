/* eslint-disable @typescript-eslint/no-empty-interface */
// import {IMetaContext} from '../common/types';
export interface IMetaContext {
  file?: string;
  method?: string;
}

export interface LogContext extends IMetaContext {}

export enum LOG_PREFIX {
  MAIN = 'CALLING_SDK',
  FILE = 'file',
  METHOD = 'method',
  EVENT = 'event',
  MESSAGE = 'message',
  ERROR = 'error',
}

export enum LOGGING_LEVEL {
  error = 1,
  warn = 2,
  log = 3,
  info = 4,
  trace = 5,
}

export enum LOGGER {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  LOG = 'log',
  TRACE = 'trace',
}
