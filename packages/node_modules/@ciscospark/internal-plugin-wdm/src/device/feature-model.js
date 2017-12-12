/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import AmpState from 'ampersand-state';
import {defaults, isObject} from 'lodash';

const FeatureModel = AmpState.extend({
  props: {
    key: 'string',
    lastModified: 'date',
    mutable: 'boolean',
    type: 'string',
    val: 'string',
    value: 'any'
  },

  constructor(attrs, options) {
    options = options || {};
    defaults(options, {parse: true});
    return Reflect.apply(AmpState.prototype.constructor, this, [attrs, options]);
  },

  idAttribute: 'key',

  parse(attrs) {
    if (!attrs) {
      return {};
    }

    const num = Number(attrs.val);
    if (attrs.val && !Number.isNaN(num)) {
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

  serialize(...args) {
    const attrs = Reflect.apply(AmpState.prototype.serialize, this, args);
    if (attrs.lastModified) {
      attrs.lastModified = (new Date(attrs.lastModified)).toISOString();
    }

    return attrs;
  },

  // Override set to make sure we always run features through parse()
  // See https://github.com/AmpersandJS/ampersand-state/issues/146 for related
  // bug
  set(key, value, options) {
    let attrs;
    // Handle both `"key", value` and `{key: value}` -style arguments.
    // The next block is a direct copy from ampersand-state, so no need to test
    // both scenarios.
    /* istanbul ignore next */
    if (isObject(key) || key === null) {
      attrs = key;
      options = value;
    }
    else {
      attrs = {};
      attrs[key] = value;
    }

    attrs = this.parse(attrs, options);
    return Reflect.apply(AmpState.prototype.set, this, [attrs, options]);
  }
});

export default FeatureModel;
