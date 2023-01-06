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
  emit(scope, eventName, args) {
    LoggerProxy.logger.debug(`${EventsUtil.getScopeLog(scope)}event#${eventName}${LoggerConfig.verboseEvents ? ` -- ${EventsUtil.getEventLog(args)}` : ''}`);

    return super.emit(eventName, args);
  }
}

export default new Events();
