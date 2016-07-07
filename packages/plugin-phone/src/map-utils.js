/**!
 *
 * Copyright (c) 2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {curry} from 'lodash';

export const addToSet = curry((set, value) => {
  set.add(value);
});

export const getMapFromMap = curry((map, key) => {
  let childMap = map.get(key);
  if (!childMap) {
    childMap = new Map();
    map.set(key, childMap);
  }
  return childMap;
});

export const getSetFromMap = curry((map, key) => {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  return set;
});

export const getWeakMapFromMap = curry((map, key) => {
  let childMap = map.get(key);
  if (!childMap) {
    childMap = new WeakMap();
    map.set(key, childMap);
  }
  return childMap;
});

// I'm pretty sure there should be a functional way to chain the following
// functions, but I can't figure out what it is.

export const getMappedWeakMappedSet = curry((m, mk, wk) => {
  const map = getWeakMapFromMap(m, mk);
  const set = getSetFromMap(map, wk);
  return set;
});

export const addToMappedWeakMappedSet = curry((m, mk, wk, v) => {
  const map = getWeakMapFromMap(m, mk);
  const set = getSetFromMap(map, wk);
  addToSet(set, v);
});
