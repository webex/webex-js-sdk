import {ERROR_DICTIONARY} from '../../constants';

/**
 * Extended Error object for Stats Errors
 */
export default class StatsError extends Error {
  /**
  *
  * @constructor
  * @param {String} [message]
  * @param {Object} [error]
  */
  constructor(message = ERROR_DICTIONARY.STATS.MESSAGE, error = null) {
    super(message);
    this.name = ERROR_DICTIONARY.STATS.NAME;
    this.sdkMessage = ERROR_DICTIONARY.STATS.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : (new Error()).stack;
    this.code = ERROR_DICTIONARY.STATS.CODE;
  }
}
