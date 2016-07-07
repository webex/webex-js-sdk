/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env browser */

import {curry, forEach, includes, reduce} from 'lodash';

export {escape, escapeSync} from './html-base';

/* istanbul ignore next */
if (!Element.prototype.remove) {
  Element.prototype.remove = function remove() {
    this.parentElement.removeChild(this);
  };
}

/* istanbul ignore next */
if (!NodeList.prototype.remove) {
  NodeList.prototype.remove = function remove() {
    for (let i = this.length - 1; i >= 0; i--) {
      if (this[i] && this[i].parentElement) {
        this[i].parentElement.removeChild(this[i]);
      }
    }
  };
}

/* istanbul ignore next */
if (!HTMLCollection.prototype.remove) {
  HTMLCollection.prototype.remove = function remove() {
    for (let i = this.length - 1; i >= 0; i--) {
      if (this[i] && this[i].parentElement) {
        this[i].parentElement.removeChild(this[i]);
      }
    }
  };
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
export const filter = curry(_filter, 4);

/**
 * @param {function} processCallback callback function to do additional
 * processing on node. of the form process(node)
 * @param {Object} allowedTags
 * @param {Array<string>} allowedStyles
 * @param {string} html
 * @private
 * @returns {string}
 */
function _filterSync(processCallback, allowedTags, allowedStyles, html) {
  if (!html || !allowedStyles || !allowedTags) {
    if (html.length === 0) {
      return html;
    }

    throw new Error(`\`allowedTags\`, \`allowedStyles\`, and \`html\` must be provided`);
  }

  const doc = (new DOMParser()).parseFromString(html, `text/html`);
  depthFirstForEach(doc.body.childNodes, filterNode);
  processCallback(doc.body);

  if (html.indexOf(`body`) === 1) {
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
        }
        else if (attrName === `href` || attrName === `src`) {
          const attrValue = node.attributes.getNamedItem(attrName).value;
          if (attrValue.indexOf(`javascript:`) === 0) {
            reparent(node);
          }
        }
        else if (attrName === `style`) {
          const styles = node
            .attributes
            .getNamedItem(`style`)
            .value
            .split(`;`)
            .map((style) => {
              const styleName = trim(style.split(`:`)[0]);
              if (includes(allowedStyles, styleName)) {
                return style;
              }
              return null;
            })
            .filter((style) => Boolean(style))
            .join(`;`);
          node.setAttribute(`style`, styles);
        }
      });
    }
    else {
      reparent(node);
    }
  }
}

const trimPattern = /^\s|\s$/g;
/**
 * @param {string} str
 * @returns {string}
 */
function trim(str) {
  return str.replace(trimPattern, ``);
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
  node.remove();
}

/**
 * @param {NamedNodeMap} attributes
 * @private
 * @returns {Array<string>}
 */
function listAttributeNames(attributes) {
  return reduce(attributes, (attrNames, attr) => {
    attrNames.push(attr.name);
    return attrNames;
  }, []);
}

/**
 * @param {Array} list
 * @param {Function} fn
 * @private
 * @returns {undefined}
 */
function depthFirstForEach(list, fn) {
  for (let i = list.length; i >= 0; i--) {
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

  if (typeof o.nodeName !== `string`) {
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
export const filterSync = curry(_filterSync, 4);
