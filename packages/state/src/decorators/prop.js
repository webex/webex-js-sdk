/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint require-jsdoc: [0] */
/* eslint no-warning-comments: [0] */

import {isEqual} from 'lodash';
import WeakKeyedMap from '../lib/weak-keyed-map';
import evented from './evented';

/* eslint no-invalid-this: [0] */

const data = new WeakKeyedMap();
export const initializers = new WeakKeyedMap();

const prepared = new WeakKeyedMap();

const silent = new WeakSet();
export function silence(context) {
  silent.add(context);
}

export function unsilence(context) {
  silent.delete(context);
}

const previous = new WeakMap();
const changing = new WeakMap();
export function startChanging(context) {
  if (!changing.has(context)) {
    changing.set(context, []);
    previous.set(context, new Map(data.get(context)));
  }
}

export function finishChanging(context) {
  while (isPending(context)) {
    const events = changing.get(context);
    changing.set(context, []);
    events.forEach((event) => context.trigger(...event));
  }
  changing.delete(context);
}

export function trigger(context, ...args) {
  if (silent.has(context)) {
    return;
  }

  if (changing.has(context)) {
    const events = changing.get(context);
    events.push(args);
    return;
  }

  context.trigger(...args);
}

export function getChangedAttributes(context) {

}

export function getPreviousAttributes(context) {
  // TODO convert to object?
  return previous.get(context);
}

export function hasChanged(context) {
  // FIXME this isn't quite the right comparison, but it gets most of the way
  // their during development.
  return isPending(context);
}

export function isChanging(context) {
  return changing.has(context);
}

export function isPending(context) {
  return changing.has(context) && changing.get(context).length > 0;
}

/**
 * @param {Constructor} target
 * @param {string} property
 * @param {object} descriptor
 * @private
 * @returns {undefined}
 */
export function prop(target, property, descriptor) {
  evented(target);

  if (!prepared.has(target, property)) {
    const initializer = descriptor.initializer;
    initializers.set(target, property, initializer);
    Reflect.deleteProperty(descriptor, `initializer`);
    Reflect.deleteProperty(descriptor, `writable`);

    descriptor.set = function set(newValue) {
      const currentVal = this[property];
      if (!isEqual(currentVal, newValue)) {
        data.set(this, property, newValue);
        trigger(this, `change:${property}`, this, newValue);
      }
    };

    descriptor.get = function get() {
      const ret = data.get(this, property);
      if (ret === undefined) {
        if (initializers.has(target, property)) {
          return Reflect.apply(initializers.get(target, property), this, []);
        }
      }

      return ret;
    };

    prepared.set(target, property, true);
  }
}
