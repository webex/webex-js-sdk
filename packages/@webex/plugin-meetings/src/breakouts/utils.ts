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
  const {EDIT_LOCK_TOKEN_MISMATCH, EDIT_NOT_AUTHORIZED} = BREAKOUTS.ERROR_CODE;
  LoggerProxy.logger.info(message);
  switch (errorCode) {
    case EDIT_LOCK_TOKEN_MISMATCH:
      return new BreakoutEditLockedError('Edit lock token mismatch', error);
    case EDIT_NOT_AUTHORIZED:
      return new BreakoutEditLockedError('Not authorized to interact with edit lock', error);
    default:
      return error;
  }
};
