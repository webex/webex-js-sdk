// eslint-disable-next-line import/prefer-default-export
import LoggerProxy from '../common/logs/logger-proxy';
import BreakoutEditLockedError from './edit-lock-error';
import {BREAKOUTS} from '../constants';

export const getBroadcastRoles = (options): string[] => {
  const recipientRoles = [];
  if (!options || (!options.cohosts && !options.presenters)) {
    return recipientRoles;
  }
  if (options.cohosts) {
    recipientRoles.push('COHOST');
  }
  if (options.presenters) {
    recipientRoles.push('PRESENTER');
  }

  return recipientRoles;
};

/**
 * Deals with all kinds of errors of breakout service
 * @param {object} error // one of the breakout service error
 * @param {string} message // message to log
 * @returns {object}
 */
export const boServiceErrorHandler = (error: any, message: string): any => {
  const errorCode = error?.body?.errorCode;
  const {EDIT_LOCK_TOKEN_MISMATCH} = BREAKOUTS.ERROR_CODE;
  switch (errorCode) {
    case EDIT_LOCK_TOKEN_MISMATCH:
      LoggerProxy.logger.info(message);

      return new BreakoutEditLockedError('Edit lock token mismatch', error);

    default:
      return error;
  }
};
