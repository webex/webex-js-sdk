/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env browser */
'use strict';

var assign = require('lodash.assign');
var curry = require('lodash.curry');
var htmlBase = require('./html-base');
var includes = require('lodash.includes');
var reduce = require('lodash.reduce');
var forEach = require('lodash.foreach');

/* istanbul ignore next */
if (!Element.prototype.remove) {
  Element.prototype.remove = function remove() {
    this.parentElement.removeChild(this);
  };
}

/* istanbul ignore next */
if (!NodeList.prototype.remove) {
  NodeList.prototype.remove = function remove() {
    for (var i = this.length - 1; i >= 0; i--) {
      if (this[i] && this[i].parentElement) {
        this[i].parentElement.removeChild(this[i]);
      }
    }
  };
}

/* istanbul ignore next */
if (!HTMLCollection.prototype.remove) {
  HTMLCollection.prototype.remove = function remove() {
    for (var i = this.length - 1; i >= 0; i--) {
      if (this[i] && this[i].parentElement) {
        this[i].parentElement.removeChild(this[i]);
      }
    }
  };
}

// filter is currently just a Promise wrapping the sync implementation, but I
// can see how an async version makes more sense in Node.

/**
 * Curried async function for removing all but the specified attributes and
 * styles from the specified HTML.
 * @param {Function} processCallback
 * @param {Object} allowedTags e.g. {div: ['class']}
 * @param {Array} allowedStyles
 * @param {string} html
 * @returns {Promise<string>}
 */
function filter(processCallback, allowedTags, allowedStyles, html) {
  return new Promise(function executor(resolve) {
    resolve(filterSync(processCallback, allowedTags, allowedStyles, html));
  });
}

/**
 * Curried function for removing all but the specified attributes and styles
 * from the specified HTML.
 * @param {Function} processCallback callback function to do additional
 * processing on node. of the form process(node)
 * @param {Object} allowedTags e.g. {div: ['class']}
 * @param {Array} allowedStyles
 * @param {string} html
 * @returns {string}
 */
function filterSync(processCallback, allowedTags, allowedStyles, html) {
  if (arguments.length < 4) {
    throw new Error('`processCallback`, `allowedTags`, `allowedStyles`, and `html` must be specified');
  }

  if (html.length === 0) {
    return html;
  }

  var doc = (new DOMParser()).parseFromString(html, 'text/html');
  _depthFirstForEach(doc.body.childNodes, _filterNode);
  processCallback(doc.body);

  if (html.indexOf('body') === 1) {
    return '<body>' + doc.body.innerHTML + '</body>';
  }
  else {
    return doc.body.innerHTML;
  }

  function _filterNode(node) {
    if (!_isElement(node)) {
      return;
    }

    _depthFirstForEach(node.childNodes, _filterNode);

    var nodeName = node.nodeName.toLowerCase();
    var allowedTagNames = Object.keys(allowedTags);

    if (!includes(allowedTagNames, nodeName)) {
      _reparent(node);
    }
    else {
      var allowedAttributes = allowedTags[nodeName];
      forEach(_listAttributeNames(node.attributes), function _filterAttributes(attrName) {
        if (!includes(allowedAttributes, attrName)) {
          node.removeAttribute(attrName);
        }
        else if (attrName === 'href' || attrName === 'src') {
          var attrValue = node.attributes.getNamedItem(attrName).value;
          if (attrValue.indexOf('javascript:') === 0) {
            _reparent(node);
          }
        }
        else if (attrName === 'style') {
          var styles = node.attributes.getNamedItem('style').value;
          styles = styles
            .split(';')
            .map(function filterStyles(style) {
              var styleName = style.split(':')[0].replace(/^\s|\s$/g, '');
              var ret = includes(allowedStyles, styleName) ? style : null;
              return ret;
            })
            .filter(function filterNulls(style) {
              return Boolean(style);
            })
            .join(';');
          node.setAttribute('style', styles);
        }
      });
    }
  }
}

/**
 * Curried async function for removing all but the specified attributes and
 * styles from the specified HTML.
 * @param {Function} processCallback
 * @param {Object} allowedTags e.g. {div: ['class']}
 * @param {Array} allowedStyles
 * @param {string} html
 * @returns {Promise<string>}
 */
function filterEscape(processCallback, allowedTags, allowedStyles, html) {
  return new Promise(function executor(resolve) {
    resolve(filterEscapeSync(processCallback, allowedTags, allowedStyles, html));
  });
}

/**
 * Curried sync function for removing all but the specified attributes and
 * styles from the specified HTML.
 * @param {Function} processCallback
 * @param {Object} allowedTags e.g. {div: ['class']}
 * @param {Array} allowedStyles
 * @param {string} html
 * @returns {Promise<string>}
 */
function filterEscapeSync(processCallback, allowedTags, allowedStyles, html) {
  if (arguments.length < 4) {
    throw new Error('`processCallback`, `allowedTags`, `allowedStyles`,  and `html` must be specified');
  }

  if (html.length === 0) {
    return html;
  }

  var doc = (new DOMParser()).parseFromString(html, 'text/html');
  _depthFirstForEach(doc.body.childNodes, _filterNode);
  processCallback(doc.body);

  if (html.indexOf('body') === 1) {
    return '<body>' + doc.body.innerHTML + '</body>';
  }
  else {
    return doc.body.innerHTML;
  }

  function _filterNode(node) {
    if (!_isElement(node)) {
      return;
    }

    _depthFirstForEach(node.childNodes, _filterNode);

    var nodeName = node.nodeName.toLowerCase();
    var allowedTagNames = Object.keys(allowedTags);

    if (!includes(allowedTagNames, nodeName)) {
      _escapeNode(node);
    }
    else {
      var allowedAttributes = allowedTags[nodeName];
      forEach(_listAttributeNames(node.attributes), function _filterAttributes(attrName) {
        if (!includes(allowedAttributes, attrName)) {
          node.removeAttribute(attrName);
        }
        else if (attrName === 'href' || attrName === 'src') {
          var attrValue = node.attributes.getNamedItem(attrName).value;
          if (attrValue.indexOf('javascript:') === 0) {
            _reparent(node);
          }
        }
        else if (attrName === 'style') {
          var styles = node.attributes.getNamedItem('style').value;
          styles = styles
            .split(';')
            .map(function filterStyles(style) {
              var styleName = style.split(':')[0].replace(/^\s|\s$/g, '');
              var ret = includes(allowedStyles, styleName) ? style : null;
              return ret;
            })
            .filter(function filterNulls(style) {
              return Boolean(style);
            })
            .join(';');
          node.setAttribute('style', styles);
        }
      });
    }

  }
}

function _reparent(node) {
  while (node.childNodes.length > 0) {
    node.parentNode.insertBefore(node.childNodes[0], node);
  }

  node.remove();
}

function _escapeNode(node) {
  var before = document.createTextNode('<' + node.nodeName.toLowerCase() + '>');
  var after = document.createTextNode('</' + node.nodeName.toLowerCase() + '>');

  node.parentNode.insertBefore(before, node);
  while (node.childNodes.length > 0) {
    node.parentNode.insertBefore(node.childNodes[0], node);
  }
  node.parentNode.insertBefore(after, node);

  node.remove();
}

function _listAttributeNames(attributes) {
  return reduce(attributes, function selectAttribute(attrNames, attr) {
    attrNames.push(attr.name);
    return attrNames;
  }, []);
}

function _depthFirstForEach(list, fn) {
  for (var i = list.length - 1; i >= 0; i--) {
    fn(list[i]);
  }
}

function _isElement(o) {
  return (
    o &&
    (o.ownerDocument !== undefined) &&
    (o.nodeType === 1) &&
    (typeof o.nodeName === 'string')
  );
}

module.exports = assign({
  filterEscape: curry(filterEscape),
  filter: curry(filter),
  filterEscapeSync: curry(filterEscapeSync),
  filterSync: curry(filterSync)
}, htmlBase);
