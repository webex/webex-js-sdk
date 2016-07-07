/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/**
 * @description Set of regex patterns to compile once and use throughout the
 * app. All non-prefixed patterns have start/end characters to ensure exact
 * matches. Patterns prefixed with "exec" are the same as their non-prefixed
 * counterparts but without the start/end characters so they can be used with
 * methods like `RegExp#exec`.
 * @memberof Util
 * @module patterns
 */
var patterns =
  /** @lends Util.patterns */
  {
  /**
   * Matches an email address by requiring an @ and excluding spaces
   * @todo add a better email address matcher
   * @type {RegExp}
   */
  email: /^[^\s]+?@[^\s]+?$/,

  /**
   * Matches a hexadecimal color code Ex: #1FE6D0 or #EEE
   * @type {RegExp}
   */
  hexColorCode: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,

  /**
   * Matches a UUID
   * @type {RegExp}
   */
  uuid: /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/,

  /**
   * Same as this.email, but allows for surrounding characters
   * @type {RegExp}
   */
  execEmail: /[^\s]+?@[^\s]+?/,

  /**
   * same as this.hexColorCode but allows for surrounding characters
   * @type {RegExp}
   */
  execHexColorCode: /#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/,

  /**
   * Same as this.uuid but allows for surrounding characters
   * @type {RegExp}
   */
  execUuid: /[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}/
};

// TODO generate the exec patterns programmatically to ensure they always match
// their non-exec versions

// Prevent changing patterns at runtime
if (Object.freeze) {
  Object.freeze(patterns);
}

module.exports = patterns;
