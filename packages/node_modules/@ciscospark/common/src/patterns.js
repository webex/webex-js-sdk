/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * @description Set of regex patterns to compile once and use throughout the
 * app. All non-prefixed patterns have start/end characters to ensure exact
 * matches. Patterns prefixed with "exec" are the same as their non-prefixed
 * counterparts but without the start/end characters so they can be used with
 * methods like `RegExp#exec`.
 */
export default {
  /**
   * Matches an email address by requiring an @ and excluding spaces
   * @todo add a better email address matcher
   * @type {RegExp}
   */
  email: /^[^\s]+?@[^\s]+?$/,

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
   * Same as this.uuid but allows for surrounding characters
   * @type {RegExp}
   */
  execUuid: /[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}/
};
