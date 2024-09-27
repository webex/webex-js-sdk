/* eslint-disable valid-jsdoc */
//import {RegistrationStatus} from '../../common/types';

import {ErrorContext, ErrorMessage, ErrorObject, ERROR_TYPE} from '../types';
import ExtendedError from './ExtendedError';

/**
 * Any error reported from Calling client should be stored here.
 */
export class BYODSError extends ExtendedError {
  // public status: RegistrationStatus = RegistrationStatus.INACTIVE;

  /**
   * Instantiate the Error class with these parameters.
   *
   * @param {ErrorMessage} msg - Custom error message.
   * @param {ErrorContext} context - The context in which the error occurred.
   * @param {ERROR_TYPE} type - The type of the error.
   * @param {RegistrationStatus} status - Mobius status, should be default.
   */
  constructor(
    msg: ErrorMessage,
    // context: ErrorContext,
    type: ERROR_TYPE,
   // status: RegistrationStatus
  ) {
    super(msg,type);
   // this.context = context;
   // this.status = status;
  }



  /**
   *  Class method exposed to callers to allow storing of error object.
   *
   * @param error - Error Object.
   */
  public setError(error: ErrorObject) {
    this.message = error.message;
    // this.context = error.context;
    this.type = error.type;
  }

  /**
   *  Class method exposed to callers to retrieve error object.
   *
   * @returns Error.
   */
  public getError(): ErrorObject {
    return <ErrorObject>{ message: this.message, type: this.type };
  }
}

/**
 * Instantiate CallingClientError.
 *
 * @param msg - Custom error message.
 * @param context - Error context.
 * @param type - Error Type.
 * @param status - Mobius Status, should be default.
 * @returns CallingClientError instance.
 */
export const createClientError = (
  msg: ErrorMessage,
   context: ErrorContext,
  type: ERROR_TYPE,
  // status: RegistrationStatus
  // ) => new CallingClientError(msg, context, type, status);
) => new BYODSError(msg,type);
