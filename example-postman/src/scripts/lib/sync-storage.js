/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import parse from './parse';
export function load(key) {
  return parse(sessionStorage.getItem(key));
}

export function store(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value, null, 2));
}
