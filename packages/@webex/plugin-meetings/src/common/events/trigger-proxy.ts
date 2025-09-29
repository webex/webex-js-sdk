import LoggerProxy from '../logs/logger-proxy';
import LoggerConfig from '../logs/logger-config';
import ParameterError from '../errors/parameter';

import EventsUtil from './util';

const TriggerProxy: any = {};

TriggerProxy.trigger = (instance, scope, trigger, payload) => {
  if (!instance || !instance.emit) {
    throw new ParameterError('Instance to trigger from must be defined and have an emit function.');
  }

  LoggerProxy.logger.debug(
    `${EventsUtil.getScopeLog(scope)}event#${trigger}${
      LoggerConfig.verboseEvents ? ` -- ${EventsUtil.getEventLog(payload)}` : ''
    }`
  );

  return instance.emit(trigger, payload);
};

export default TriggerProxy;
