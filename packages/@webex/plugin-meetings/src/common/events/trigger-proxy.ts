import LoggerProxy from '../logs/logger-proxy';
import LoggerConfig from '../logs/logger-config';

import EventsUtil from './util';
import ParameterError from '../errors/parameter';

type Scope = string;
type EventName = string;
type Payload = any;

interface TriggerableInstance {
  trigger: (event: EventName, payload: Payload) => void;
}

const TriggerProxy = {
  /**
   * Triggers an event on the given instance with strong typing.
   *
   * @param {TriggerableInstance} instance - The instance to trigger the event from.
   * @param {Scope} scope - The scope of the event.
   * @param {EventName} eventName - The name of the event to trigger.
   * @param {Payload} payload - The payload to pass with the event.
   * @returns {void}
   * @throws {ParameterError} If the instance or its trigger function is not defined.
   */
  trigger(instance: TriggerableInstance, scope: Scope, eventName: EventName, payload: Payload) {
    // TODO: Remove this check once all instances are properly typed
    if (!instance || typeof instance.trigger !== 'function') {
      throw new ParameterError(
        'Instance to trigger from must be defined and have a trigger function.'
      );
    }

    LoggerProxy.logger.debug(
      `${EventsUtil.getScopeLog(scope)}event#${eventName}${
        LoggerConfig.verboseEvents ? ` -- ${EventsUtil.getEventLog(payload)}` : ''
      }`
    );

    return instance.trigger(eventName, payload);
  },
};

export default TriggerProxy;
