/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {difference} from 'lodash';

const SCOPE_SEPARATOR = ' ';

/**
 * sorts a list of scopes
 * @param {string} scope
 * @returns {string}
 */
export function sortScope(scope) {
  if (!scope) {
    return '';
  }

  return scope.split(SCOPE_SEPARATOR).sort().join(SCOPE_SEPARATOR);
}

/**
 * sorts a list of scopes and filters the specified scope
 * @param {string|string[]} toFilter
 * @param {string} scope
 * @returns {string}
 */
export function filterScope(toFilter, scope) {
  if (!scope) {
    return '';
  }
  const toFilterArr = Array.isArray(toFilter) ? toFilter : [toFilter];

  return scope
    .split(SCOPE_SEPARATOR)
    .filter((item) => !toFilterArr.includes(item))
    .sort()
    .join(SCOPE_SEPARATOR);
}

/**
 * Returns a string containing all items in scopeA that are not in scopeB, or an empty string if there are none.
 *
 * @param {string} scopeA
 * @param {string} scopeB
 * @returns {string}
 */
export function diffScopes(scopeA, scopeB) {
  const a = scopeA?.split(SCOPE_SEPARATOR) ?? [];
  const b = scopeB?.split(SCOPE_SEPARATOR) ?? [];

  return difference(a, b).sort().join(SCOPE_SEPARATOR);
}
