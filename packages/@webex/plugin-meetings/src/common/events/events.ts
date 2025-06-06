import EventEmitter from 'events';

import LoggerProxy from '../logs/logger-proxy';
import LoggerConfig from '../logs/logger-config';

import EventsUtil from './util';

/**
 * Events
 * plugin-meetings global
 * Used to emit events internally between modules
 */
class Events extends EventEmitter {
  /**
   *
   * @param {string} scope - scope of the event, used for logging
   * @param {string} eventName - name of the event to emit
   * @param {any} args - arguments to pass with the event
   * @returns {EventEmitter} - returns the EventEmitter instance for chaining
   */
  emit(scope: string, eventName: string, args: any) {
    LoggerProxy.logger.debug(
      `${EventsUtil.getScopeLog(scope)}event#${eventName}${
        LoggerConfig.verboseEvents ? ` -- ${EventsUtil.getEventLog(args)}` : ''
      }`
    );

    return super.emit(eventName, args);
  }
}

export default new Events();
