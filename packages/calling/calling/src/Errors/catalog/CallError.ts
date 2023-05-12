import {CallErrorObject, ErrorContext, ErrorMessage, ERROR_LAYER, ERROR_TYPE} from '../types';
import ExtendedError from './ExtendedError';
import {CorrelationId} from '../../common/types';

/**
 *
 */
export class CallError extends ExtendedError {
  private correlationId: CorrelationId;

  private errorLayer: ERROR_LAYER;

  /**
   * Instantiate the Error class with these parameters.
   *
   * @param msg - Custom error message.
   * @param context - Error context.
   * @param type - Error Type.
   * @param correlationId - Unique identifier for a call.
   * @param errorLayer - Call control or media layer.
   */
  constructor(
    msg: ErrorMessage,
    context: ErrorContext,
    type: ERROR_TYPE,
    correlationId: CorrelationId,
    errorLayer: ERROR_LAYER
  ) {
    super(msg, context, type);
    this.correlationId = correlationId;
    this.errorLayer = errorLayer;
  }

  /**
   *  Class method exposed to callers to allow storing of error object.
   *
   * @param error - Error Object.
   */
  public setCallError(error: CallErrorObject) {
    this.message = error.message;
    this.correlationId = error.correlationId;
    this.context = error.context;
    this.type = error.type;
  }

  /**
   *  Class method exposed to callers to retrieve error object.
   *
   * @returns Error.
   */
  public getCallError(): CallErrorObject {
    return <CallErrorObject>{
      message: this.message,
      context: this.context,
      type: this.type,
      correlationId: this.correlationId,
      errorLayer: this.errorLayer,
    };
  }
}

/**
 * Instantiate CallingClientError.
 *
 * @param msg - Custom error message.
 * @param context - Error context.
 * @param type - Error Type.
 * @param  correlationId - Unique identifier for a call.
 * @param errorLayer - Call control or media layer.
 * @returns CallingClientError instance.
 */
export const createCallError = (
  msg: ErrorMessage,
  context: ErrorContext,
  type: ERROR_TYPE,
  correlationId: CorrelationId,
  errorLayer: ERROR_LAYER
) => new CallError(msg, context, type, correlationId, errorLayer);
