/* eslint-disable valid-jsdoc */
import {ErrorContext, ErrorMessage, ERROR_TYPE} from '../types';

/**
 *
 */
export default class ExtendedError extends Error {
  public type: ERROR_TYPE;

 // public context: ErrorContext;

  /**
   * @param msg - TODO.
   * @param context - TODO.
   * @param type - TODO.
   */
  constructor(msg: ErrorMessage,type: ERROR_TYPE) {
    super(msg);
    this.type = type || ERROR_TYPE.DEFAULT;
   // this.context = context;
  }
}
