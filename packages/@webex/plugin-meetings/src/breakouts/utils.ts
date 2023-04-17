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
 * @param {string} position // position of the error occur
 * @returns {object}
 */
export const boServiceErrorHandler = (error: any, position: string): any => {
  const errorCode = error?.body?.errorCode;
  const {EDIT_LOCK_TOKEN_MISMATCH, EDIT_NOT_AUTHORIZED} = BREAKOUTS.ERROR_CODE;
  let throwError;
  switch (errorCode) {
    case EDIT_LOCK_TOKEN_MISMATCH:
      throwError = new BreakoutEditLockedError('Edit lock token mismatch', error);
      break;
    case EDIT_NOT_AUTHORIZED:
      throwError = new BreakoutEditLockedError('Not authorized to interact with edit lock', error);
      break;
    default:
      throwError = error;
  }
  LoggerProxy.logger.info(`${position} --> ${throwError?.message}`);

  return throwError;
};
