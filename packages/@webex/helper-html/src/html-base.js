/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

const escapeMe = /(<|>|&)/g;

// escape and escapeSync probably don't both need to exist, but it seemed like a
// good idea in case we ever want to for the future.

/**
 * Escapes HTML
 * @param {[type]} html
 * @returns {[type]}
 */
export function escape(html) {
  return new Promise((resolve) => resolve(escapeSync(html)));
}

/**
 * Synchronously escape HTML
 * @param {[type]} html
 * @returns {[type]}
 */
export function escapeSync(html) {
  return html.replace(escapeMe, entityReplacer);
}

/**
 * @param {string} char
 * @private
 * @returns {string}
 */
function entityReplacer(char) {
  switch (char) {
    case '<':
      return '&lt;';
    case '>':
      return '&gt;';
    case '&':
      return '&amp;';
    default:
      return char;
  }
}
