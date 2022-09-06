import {inspect} from 'util';

import LoggerProxy from '../logs/logger-proxy';

const EventsUtil = {};

EventsUtil.getEventLog = (args) => {
  let argString = '';

  try {
    argString = inspect(args);
  }
  catch (e) {
    LoggerProxy.logger.warn(`Events:util#getEventLog --> ${e}`);
  }

  return argString;
};

EventsUtil.getScopeLog = (scope) => {
  let scopeString = '';

  if (scope) {
    if (scope.file && scope.function) {
      scopeString += `${scope.file}:${scope.function}->`;

      return scopeString;
    }
    if (scope.file) {
      scopeString += `${scope.file}->`;
    }
    if (scope.function) {
      scopeString += `${scope.function}->`;
    }
  }

  return scopeString;
};

export default EventsUtil;
