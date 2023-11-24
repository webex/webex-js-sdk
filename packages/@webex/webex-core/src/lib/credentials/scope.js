/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {difference} from 'lodash';

/**
 * sorts a list of scopes
 * @param {string} scope
 * @returns {string}
 */
export function sortScope(scope) {
  if (!scope) {
    return '';
  }

  return scope.split(' ').sort().join(' ');
}

/**
 * sorts a list of scopes and filters the specified scope
 * @param {string} toFilter
 * @param {string} scope
 * @returns {string}
 */
export function filterScope(toFilter, scope) {
  if (!scope) {
    return '';
  }

  return scope
    .split(' ')
    .filter((item) => item !== toFilter)
    .sort()
    .join(' ');
}

/**
 * Returns the scopes not included in the other given scope
 *
 * @param {string} scopeA
 * @param {string} scopeB
 * @returns {string}
 */
export function diffScopes(scopeA, scopeB) {
  const a = scopeA?.split(' ') ?? [];
  const b = scopeB?.split(' ') ?? [];

  return difference(a, b).sort().join(' ');
}
