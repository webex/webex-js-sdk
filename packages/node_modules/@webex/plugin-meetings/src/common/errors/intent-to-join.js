import {ERROR_DICTIONARY} from '../../constants';

/**
 * Extended Error object to signify the intent to join for unclaimed PMR scenarios
 */
export default class IntentToJoinError extends Error {
  /**
  *
  * @constructor
  * @param {String} [message]
  * @param {Object} [error]
  */
  constructor(message = ERROR_DICTIONARY.INTENT_TO_JOIN.MESSAGE, error = null) {
    super(message);
    this.name = ERROR_DICTIONARY.INTENT_TO_JOIN.NAME;
    this.sdkMessage = ERROR_DICTIONARY.INTENT_TO_JOIN.MESSAGE;
    this.error = error;
    this.stack = error ? error.stack : (new Error()).stack;
    this.joinIntentRequired = true;
    this.code = ERROR_DICTIONARY.INTENT_TO_JOIN.CODE;
  }
}
