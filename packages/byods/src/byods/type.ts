import {LOGGER} from '../Logger/types';
import {BYODSError} from '../Errors';

export interface LoggerConfig {
  level: LOGGER;
}

export interface BYODSConfig {
  logger?: LoggerConfig;
}

export type BYODSErrorEmitterCallback = (err: BYODSError, finalError?: boolean) => void;

function getLoggingLevel() {
  throw new Error('Function not implemented.');
}
getLoggingLevel();
