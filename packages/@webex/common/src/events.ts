import {EventEmitter} from 'events';
import {isArray} from 'lodash';

/**
 * A modern, typed event emitter that serves as a replacement for
 * ampersand-events. It provides a consistent event interface
 * across the SDK.
 */
export class WebexEventEmitter extends EventEmitter {
  /**
   * Fires when the object has been destroyed.
   * @returns {void}
   */
  destroy() {
    this.emit('destroy');
    this.removeAllListeners();
  }
}

/**
 * Proxies the event binding methods of emitter onto proxy
 * @param {EventEmitter|EventEmitterProxy} emitter
 * @param {mixed} proxy (probably a promise)
 * @returns {EventEmitter} Returns the source emitter to ease use in promise chains
 */
export function proxyEvents(emitter: any, proxy: any): any {
  ['on', 'once'].forEach((key) => {
    proxy[key] = (...args: any[]) => {
      emitter[key](...args);

      return proxy;
    };
  });

  return emitter;
}

/**
 * Given a list of events, fires them on drain when they're emitted from source
 * @param {Array|string} events
 * @param {EventEmitter} source
 * @param {EventEmitter} drain
 * @returns {undefined}
 */
export function transferEvents(events: string | string[], source: any, drain: any): void {
  const eventArray = isArray(events) ? events : [events];
  eventArray.forEach((event) => {
    if (source.on) {
      source.on(event, (...args: any[]) => emit(drain, event, ...args));
    }
  });
}

/**
 * Emits an event
 * @param {EventEmitter} target The EventEmitter from which to emit an event
 * @returns {mixed}
 */
function emit(target: any, ...rest: any[]): any {
  const method = target.trigger || target.emit;

  /* istanbul ignore if */
  if (!method) {
    throw new Error('count not determine emit method');
  }

  return Reflect.apply(method, target, rest);
}
