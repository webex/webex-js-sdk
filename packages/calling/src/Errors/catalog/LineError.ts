/* eslint-disable valid-jsdoc */
import {RegistrationStatus} from '../../common/types';
import {ErrorMessage, ERROR_TYPE, LineErrorObject, ErrorContext} from '../types';
import ExtendedError from './ExtendedError';

/**
 * Any error reported from Line class should be stored here.
 */
export class LineError extends ExtendedError {
  public status: RegistrationStatus = RegistrationStatus.INACTIVE;

  /**
   * Instantiate the Error class with these parameters.
   *
   * @param msg - Custom error message.
   * @param context - Error context.
   * @param type - Error Type.
   * @param status - Line Status, should be inactive.
   */
  constructor(
    msg: ErrorMessage,
    context: ErrorContext,
    type: ERROR_TYPE,
    status: RegistrationStatus
  ) {
    super(msg, context, type);
    this.status = status;
  }

  /**
   *  Class method exposed to allow storing of error object.
   *
   * @param error - Error Object.
   */
  public setError(error: LineErrorObject) {
    this.message = error.message;
    this.context = error.context;
    this.type = error.type;
    this.status = error.status;
  }

  /**
   *  Class method exposed to retrieve error object.
   *
   * @returns Error.
   */
  public getError(): LineErrorObject {
    return <LineErrorObject>{
      message: this.message,
      context: this.context,
      type: this.type,
      status: this.status,
    };
  }
}

/**
 * Instantiate LineError.
 *
 * @param msg - Custom error message.
 * @param context - Error context.
 * @param type - Error Type.
 * @param status - Line Status, should be inactive.
 * @returns LineError instance.
 */
export const createLineError = (
  msg: ErrorMessage,
  context: ErrorContext,
  type: ERROR_TYPE,
  status: RegistrationStatus
) => new LineError(msg, context, type, status);
