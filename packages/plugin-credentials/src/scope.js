/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/**
 * sorts a list of scopes
 * @param {string} scope
 * @returns {string}
 */
export function sortScope(scope) {
  if (!scope) {
    return ``;
  }

  return scope
    .split(` `)
    .sort()
    .join(` `);
}

/**
 * sorts a list of scopes and filters the specified scope
 * @param {string} toFilter
 * @param {string} scope
 * @returns {string}
 */
export function filterScope(toFilter, scope) {
  if (!scope) {
    return ``;
  }

  return scope
    .split(` `)
    .filter((item) => item !== `spark:kms`)
    .sort()
    .join(` `);
}
