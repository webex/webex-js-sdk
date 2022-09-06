import ChildEmitter from 'events';

import LoggerProxy from '../logs/logger-proxy';
import LoggerConfig from '../logs/logger-config';

import EventsUtil from './util';

/**
 * Events
 * plugin-meetings local
 * Used to emit events internally between modules specific to an object
 */
export default class EventsScope extends ChildEmitter {
  /**
   * Emits and logs an event
   * @param {*} scope
   * @param {*} eventName
   * @param {*} args
   * @returns {Function}
   */
  emit(scope, eventName, args) {
    LoggerProxy.logger.debug(`${EventsUtil.getScopeLog(scope)}event#${eventName}${LoggerConfig.verboseEvents ? ` -- ${EventsUtil.getEventLog(args)}` : ''}`);

    return super.emit(eventName, args);
  }
}
