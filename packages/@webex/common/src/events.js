/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {isArray} from 'lodash';

/**
 * Proxies the event binding methods of emitter onto proxy
 * @param {EventEmitter|EventEmitterProxy} emitter
 * @param {mixed} proxy (probably a promise)
 * @returns {EventEmitter} Returns the source emitter to ease use in promise chains
 */
export function proxyEvents(emitter, proxy) {
  ['on', 'once'].forEach((key) => {
    proxy[key] = (...args) => {
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
export function transferEvents(events, source, drain) {
  events = isArray(events) ? events : [events];
  events.forEach((event) => {
    if (source.on) {
      source.on(event, (...args) => emit(drain, event, ...args));
    }
  });
}

/**
 * Emits an event
 * @param {EventEmitter} target The EventEmitter from which to emit an event
 * @returns {mixed}
 */
function emit(target, ...rest) {
  const method = target.trigger || target.emit;

  /* istanbul ignore if */
  if (!method) {
    throw new Error('count not determine emit method');
  }

  return Reflect.apply(method, target, rest);
}
