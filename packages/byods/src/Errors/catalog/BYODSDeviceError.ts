/* eslint-disable valid-jsdoc */
import {ErrorMessage, ErrorObject, ERROR_TYPE} from '../types';
import ExtendedError from './ExtendedError';

/**
 * Any error reported from Calling client should be stored here.
 */
export class BYODSError extends ExtendedError {
  /**
   * Class method exposed to callers to allow storing of error object.
   *
   * @param error - Error Object.
   */
  public setError(error: ErrorObject) {
    this.message = error.message;
    this.type = error.type;
  }

  /**
   * Class method exposed to callers to retrieve error object.
   *
   * @returns Error.
   */
  public getError(): ErrorObject {
    return <ErrorObject>{message: this.message, type: this.type};
  }
}

/**
 * Instantiate BYODSError.
 *
 * @param msg - Custom error message.
 * @param type - Error Type.
 * @returns BYODSError instance.
 */
export const createClientError = (msg: ErrorMessage, type: ERROR_TYPE) => new BYODSError(msg, type);
