
import LoggerProxy from '../logs/logger-proxy';
import LoggerConfig from '../logs/logger-config';
import ParameterError from '../errors/parameter';

import EventsUtil from './util';


const TriggerProxy = {};

TriggerProxy.trigger = (instance, scope, trigger, payload) => {
  if (!instance || !instance.trigger) {
    throw new ParameterError('Instance to trigger from must be defined and have a trigger function.');
  }

  LoggerProxy.logger.debug(`${EventsUtil.getScopeLog(scope)}event#${trigger}${LoggerConfig.verboseEvents ? ` -- ${EventsUtil.getEventLog(payload)}` : ''}`);

  return instance.trigger(trigger, payload);
};

export default TriggerProxy;
