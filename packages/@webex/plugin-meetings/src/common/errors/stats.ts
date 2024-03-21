import {ERROR_DICTIONARY} from '../../constants';

/**
 * Extended Error object for Stats Errors
 */
export default class StatsError extends Error {
  code: any;
  error: any;
  sdkMessage: any;

  /**
   *
   * @constructor
   * @param {String} [message]
   * @param {Object} [error]
   */
  constructor(message: string = ERROR_DICTIONARY.STATS.MESSAGE, error: any = null) {
    super(message);
    this.name = ERROR_DICTIONARY.STATS.NAME;
    this.sdkMessage = ERROR_DICTIONARY.STATS.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : new Error().stack;
    this.code = ERROR_DICTIONARY.STATS.CODE;
  }
}
