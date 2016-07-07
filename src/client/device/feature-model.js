/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AmpState = require('ampersand-state');
var defaults = require('lodash.defaults');
var isObject = require('lodash.isobject');

var FeatureModel = AmpState.extend({
  props: {
    key: 'string',
    lastModified: 'date',
    mutable: 'boolean',
    type: 'string',
    val: 'string',
    value: 'any'
  },

  constructor: function constructor(attrs, options) {
    options = options || {};
    defaults(options, {parse: true});
    return AmpState.prototype.constructor.call(this, attrs, options);
  },

  idAttribute: 'key',

  parse: function parse(attrs) {
    if (!attrs) {
      return {};
    }

    var num = Number(attrs.val);
    if (attrs.val && !isNaN(num)) {
      // Handle numbers.
      attrs.value = num;
      attrs.type = 'number';
    }
    // Handle booleans.
    else if (attrs.val === 'true') {
      attrs.value = true;
      attrs.type = 'boolean';
    }
    else if (attrs.val === 'false') {
      attrs.value = false;
      attrs.type = 'boolean';
    }
    // It must be a string, so return it.
    else {
      attrs.value = attrs.val;
      attrs.type = 'string';
    }

    return attrs;
  },

  serialize: function serialize() {
    var attrs = AmpState.prototype.serialize.apply(this, arguments);
    if (attrs.lastModified) {
      attrs.lastModified = (new Date(attrs.lastModified)).toISOString();
    }

    return attrs;
  },

  // Override set to make sure we always run features through parse()
  // See https://github.com/AmpersandJS/ampersand-state/issues/146 for related
  // bug
  set: function set(key, value, options) {
    var attrs;
    // Handle both `"key", value` and `{key: value}` -style arguments.
    if (isObject(key) || key === null) {
      attrs = key;
      options = value;
    }
    else {
      attrs = {};
      attrs[key] = value;
    }

    attrs = this.parse(attrs, options);
    return AmpState.prototype.set.call(this, attrs, options);
  }
});

module.exports = FeatureModel;
