export interface IMetaContext {
  file?: string;
  method?: string;
}

export type LogContext = IMetaContext;

export enum LOG_PREFIX {
  MAIN = 'BYODOS_SDK',
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
