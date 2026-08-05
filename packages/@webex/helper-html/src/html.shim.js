/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env browser */

import {curry, forEach, includes, reduce} from 'lodash';

export {escape, escapeSync} from './html-base';

/**
 * Some browsers don't implement {@link Element#remove()} or
 * {@link NodeList#remove()} or {@link HTMLCollection#remove()}. This wrapper
 * calls the appropriate `#remove()` method if available, or falls back to a
 * non-global-polluting polyfill.
 * @param {Element|NodeList|HTMLCollection} node
 * @returns {undefined}
 */
function removeNode(node) {
  if (node.remove) {
    node.remove();

    return;
  }

  if (node.parentElement) {
    node.parentElement.removeChild(node);

    return;
  }

  if ('length' in node) {
    for (let i = node.length - 1; i >= 0; i -= 1) {
      removeNode(node[i]);
    }

    return;
  }

  throw new Error('Could not find a way to remove node');
}

/**
 * @param {Object} allowedTags
 * @param {Array<string>} allowedStyles
 * @param {string} html
 * @private
 * @returns {string}
 */
function _filter(...args) {
  return new Promise((resolve) => {
    resolve(_filterSync(...args));
  });
}

/**
 * Curried async HTML filter.
 * @param {Object} allowedTags Map of tagName -> array of allowed attributes
 * @param {Array<string>} allowedStyles Array of allowed styles
 * @param {string} html html to filter
 * @returns {string}
 */
export const filter = curry(_filter, 5);

/**
 * @param {function} processCallback callback function to do additional
 * processing on node. of the form process(node)
 * @param {Object} allowedTags
 * @param {Array<string>} allowedStyles
 * @param {string} html
 * @param {Array<string>} [additionalAllowedUrlSchemes]
 * @private
 * @returns {string}
 */
function _filterSync(
  processCallback,
  allowedTags,
  allowedStyles,
  html,
  additionalAllowedUrlSchemes
) {
  if (!html || !allowedStyles || !allowedTags) {
    if (html.length === 0) {
      return html;
    }

    throw new Error('`allowedTags`, `allowedStyles`, and `html` must be provided');
  }

  const allowedUrlSchemes = buildAllowedUrlSchemes(additionalAllowedUrlSchemes);
  const doc = new DOMParser().parseFromString(html, 'text/html');

  depthFirstForEach(doc.body.childNodes, filterNode);
  processCallback(doc.body);

  if (html.indexOf('body') === 1) {
    return `<body>${doc.body.innerHTML}</body>`;
  }

  return doc.body.innerHTML;

  /**
   * @param {Node} node
   * @private
   * @returns {undefined}
   */
  function filterNode(node) {
    if (!isElement(node)) {
      return;
    }

    const nodeName = node.nodeName.toLowerCase();
    const allowedTagNames = Object.keys(allowedTags);

    depthFirstForEach(node.childNodes, filterNode);

    if (includes(allowedTagNames, nodeName)) {
      const allowedAttributes = allowedTags[nodeName];

      forEach(listAttributeNames(node.attributes), (attrName) => {
        if (!includes(allowedAttributes, attrName)) {
          node.removeAttribute(attrName);
        } else if (attrName === 'href' || attrName === 'src') {
          const attrValue = node.attributes.getNamedItem(attrName).value;

          if (!isAllowedUrlAttribute(attrValue, allowedUrlSchemes)) {
            reparent(node);
          }
        } else if (attrName === 'style') {
          const styles = node.attributes
            .getNamedItem('style')
            .value.split(';')
            .map((style) => {
              const styleName = trim(style.split(':')[0]);

              if (includes(allowedStyles, styleName)) {
                return style;
              }

              return null;
            })
            .filter((style) => Boolean(style))
            .join(';');

          node.setAttribute('style', styles);
        }
      });
    } else {
      reparent(node);
    }
  }
}

/**
 * Same as _filter, but escapes rather than removes disallowed values
 * @param {Function} processCallback
 * @param {Object} allowedTags
 * @param {Array<string>} allowedStyles
 * @param {string} html
 * @returns {Promise<string>}
 */
function _filterEscape(...args) {
  return new Promise((resolve) => {
    resolve(_filterEscapeSync(...args));
  });
}

/**
 * Same as _filterSync, but escapes rather than removes disallowed values
 * @param {Function} processCallback
 * @param {Object} allowedTags
 * @param {Array<string>} allowedStyles
 * @param {string} html
 * @param {Array<string>} [additionalAllowedUrlSchemes]
 * @returns {string}
 */
function _filterEscapeSync(
  processCallback,
  allowedTags,
  allowedStyles,
  html,
  additionalAllowedUrlSchemes
) {
  if (!html || !allowedStyles || !allowedTags) {
    if (html.length === 0) {
      return html;
    }

    throw new Error('`allowedTags`, `allowedStyles`, and `html` must be provided');
  }

  const allowedUrlSchemes = buildAllowedUrlSchemes(additionalAllowedUrlSchemes);
  const doc = new DOMParser().parseFromString(html, 'text/html');

  depthFirstForEach(doc.body.childNodes, filterNode);
  processCallback(doc.body);

  if (html.indexOf('body') === 1) {
    return `<body>${doc.body.innerHTML}</body>`;
  }

  return doc.body.innerHTML;

  /**
   * @param {Node} node
   * @private
   * @returns {undefined}
   */
  function filterNode(node) {
    if (!isElement(node)) {
      return;
    }

    depthFirstForEach(node.childNodes, filterNode);

    const nodeName = node.nodeName.toLowerCase();
    const allowedTagNames = Object.keys(allowedTags);

    if (includes(allowedTagNames, nodeName)) {
      const allowedAttributes = allowedTags[nodeName];

      forEach(listAttributeNames(node.attributes), (attrName) => {
        if (!includes(allowedAttributes, attrName)) {
          node.removeAttribute(attrName);
        } else if (attrName === 'href' || attrName === 'src') {
          const attrValue = node.attributes.getNamedItem(attrName).value;

          if (!isAllowedUrlAttribute(attrValue, allowedUrlSchemes)) {
            reparent(node);
          }
        } else if (attrName === 'style') {
          const styles = node.attributes
            .getNamedItem('style')
            .value.split(';')
            .map((style) => {
              const styleName = trim(style.split(':')[0]);

              if (includes(allowedStyles, styleName)) {
                return style;
              }

              return null;
            })
            .filter((style) => Boolean(style))
            .join(';');

          node.setAttribute('style', styles);
        }
      });
    } else {
      escapeNode(node);
    }
  }
}

/**
 * Escapes a given html node
 * @param {Node} node
 * @returns {undefined}
 */
function escapeNode(node) {
  const before = document.createTextNode(`<${node.nodeName.toLowerCase()}>`);
  const after = document.createTextNode(`</${node.nodeName.toLowerCase()}>`);

  node.parentNode.insertBefore(before, node);
  while (node.childNodes.length > 0) {
    node.parentNode.insertBefore(node.childNodes[0], node);
  }
  node.parentNode.insertBefore(after, node);

  removeNode(node);
}

const trimPattern = /^\s|\s$/g;

export const DEFAULT_ALLOWED_URL_SCHEMES = ['http', 'https', 'mailto', 'tel', 'sip', 'webexteams'];

const BLOCKED_URL_SCHEMES = new Set(['javascript', 'vbscript', 'data']);

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*$/;

/**
 * Builds the effective URL scheme allow-list by merging defaults with optional
 * additional schemes from SDK config. Dangerous schemes are always excluded.
 * @param {Array<string>} [additionalAllowedUrlSchemes]
 * @returns {Set<string>}
 */
function buildAllowedUrlSchemes(additionalAllowedUrlSchemes) {
  const schemes = new Set(DEFAULT_ALLOWED_URL_SCHEMES);

  if (!additionalAllowedUrlSchemes) {
    return schemes;
  }

  forEach(additionalAllowedUrlSchemes, (scheme) => {
    if (typeof scheme !== 'string') {
      return;
    }

    const normalized = scheme.toLowerCase();

    if (BLOCKED_URL_SCHEMES.has(normalized)) {
      return;
    }

    if (SCHEME_PATTERN.test(normalized)) {
      schemes.add(normalized);
    }
  });

  return schemes;
}

/**
 * Strips ASCII control characters and whitespace (U+0000 through U+0020) from the
 * start and end of a URL attribute value. Browsers discard this range at the ends
 * before resolving a scheme, but trim() alone does not remove characters like U+001F.
 * @param {string} value
 * @returns {string}
 */
function stripLeadingTrailingUrlPadding(value) {
  let start = 0;
  let end = value.length;

  while (start < end && value.charCodeAt(start) <= 0x20) {
    start += 1;
  }

  while (end > start && value.charCodeAt(end - 1) <= 0x20) {
    end -= 1;
  }

  return value.slice(start, end);
}

/**
 * Normalizes a URL attribute for scheme validation. Leading/trailing C0 controls and
 * whitespace are removed; TAB/LF/CR are removed only within the scheme portion.
 * Embedded controls elsewhere in relative URLs are preserved.
 * @param {string} value
 * @returns {string}
 */
function normalizeForSchemeCheck(value) {
  const trimmed = stripLeadingTrailingUrlPadding(value).toLowerCase();
  const colonIndex = trimmed.indexOf(':');

  if (colonIndex === -1) {
    return trimmed;
  }

  const schemePart = trimmed.slice(0, colonIndex).replace(/\t|\n|\r/g, '');

  return schemePart + trimmed.slice(colonIndex);
}

/**
 * Returns true when href/src is safe to keep after stripping control characters
 * and validating the URL scheme against an allow-list.
 * @param {string} value
 * @param {Set<string>} allowedSchemes
 * @returns {boolean}
 */
function isAllowedUrlAttribute(value, allowedSchemes) {
  if (value === '') {
    return true;
  }

  if (!value) {
    return false;
  }

  const normalized = normalizeForSchemeCheck(value);

  if (normalized === '') {
    return true;
  }

  if (/^[/?#]/.test(normalized)) {
    return true;
  }

  const schemeMatch = normalized.match(/^([a-z][a-z0-9+.-]*):/);

  if (!schemeMatch) {
    return true;
  }

  return allowedSchemes.has(schemeMatch[1]);
}

/**
 * @param {string} str
 * @returns {string}
 */
function trim(str) {
  return str.replace(trimPattern, '');
}

/**
 * @param {Node} node
 * @private
 * @returns {undefined}
 */
function reparent(node) {
  while (node.childNodes.length > 0) {
    node.parentNode.insertBefore(node.childNodes[0], node);
  }
  removeNode(node);
}

/**
 * @param {NamedNodeMap} attributes
 * @private
 * @returns {Array<string>}
 */
function listAttributeNames(attributes) {
  return reduce(
    attributes,
    (attrNames, attr) => {
      attrNames.push(attr.name);

      return attrNames;
    },
    []
  );
}

/**
 * @param {Array} list
 * @param {Function} fn
 * @private
 * @returns {undefined}
 */
function depthFirstForEach(list, fn) {
  for (let i = list.length; i >= 0; i -= 1) {
    fn(list[i]);
  }
}

/**
 * @param {Node} o
 * @private
 * @returns {Boolean}
 */
function isElement(o) {
  if (!o) {
    return false;
  }

  if (o.ownerDocument === undefined) {
    return false;
  }

  if (o.nodeType !== 1) {
    return false;
  }

  if (typeof o.nodeName !== 'string') {
    return false;
  }

  return true;
}

/**
 * Curried HTML filter.
 * @param {Object} allowedTags Map of tagName -> array of allowed attributes
 * @param {Array<string>} allowedStyles Array of allowed styles
 * @param {string} html html to filter
 * @returns {string}
 */
export const filterSync = curry(_filterSync, 5);

/**
 * Curried HTML filter that escapes rather than removes disallowed tags
 * @param {Object} allowedTags Map of tagName -> array of allowed attributes
 * @param {Array<string>} allowedStyles Array of allowed styles
 * @param {string} html html to filter
 * @param {Array<string>} [additionalAllowedUrlSchemes] extra URL schemes to allow
 * @returns {Promise<string>}
 */
export const filterEscape = curry(_filterEscape, 5);

/**
 * Curried HTML filter that escapes rather than removes disallowed tags
 * @param {Object} allowedTags Map of tagName -> array of allowed attributes
 * @param {Array<string>} allowedStyles Array of allowed styles
 * @param {string} html html to filter
 * @param {Array<string>} [additionalAllowedUrlSchemes] extra URL schemes to allow
 * @returns {string}
 */
export const filterEscapeSync = curry(_filterEscapeSync, 5);
