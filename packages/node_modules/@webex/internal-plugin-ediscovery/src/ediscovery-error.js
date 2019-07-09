import {Exception} from '@webex/common';

/**
 * General ediscovery error
 */
export class EdiscoveryError extends Exception {}

/**
 * InvalidEmailAddressError is thrown when an email address has been supplied as a parameter and cannot be found in CI
 */
export class InvalidEmailAddressError extends EdiscoveryError {
  // This value correspondes to the ediscovery error code INVALID_USER_EMAILS_LIST_IN_MESSAGE
  static getErrorCode() {
    return 14400001;
  }
}
