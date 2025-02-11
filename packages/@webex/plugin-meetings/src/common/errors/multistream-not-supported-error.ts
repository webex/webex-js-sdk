import {ERROR_DICTIONARY} from '../../constants';

/**
 * Error thrown when we try to do multistream, but fail. This error
 * is not exported outside of plugin-meetings, because it's handled
 * internally.
 */
export default class MultistreamNotSupportedError extends Error {
  code: any;
  error: any;
  sdkMessage: any;

  /**
   *
   * @constructor
   * @param {String} [message]
   * @param {Object} [error]
   */
  constructor(
    message: string = ERROR_DICTIONARY.MULTISTREAM_NOT_SUPPORTED.MESSAGE,
    error: any = null
  ) {
    super(message);
    this.name = ERROR_DICTIONARY.MULTISTREAM_NOT_SUPPORTED.NAME;
    this.sdkMessage = ERROR_DICTIONARY.MULTISTREAM_NOT_SUPPORTED.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : new Error().stack;
    this.code = ERROR_DICTIONARY.MULTISTREAM_NOT_SUPPORTED.CODE;
  }
}
