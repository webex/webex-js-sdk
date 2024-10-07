import {BYODSError} from '../Errors';

export type BYODSErrorEmitterCallback = (err: BYODSError, finalError?: boolean) => void;

function getLoggingLevel() {
  throw new Error('Function not implemented.');
}
getLoggingLevel();
