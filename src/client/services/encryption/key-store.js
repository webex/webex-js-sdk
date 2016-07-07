/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var find = require('lodash.find');
var isArray = require('lodash.isarray');
var merge = require('lodash.merge');

function KeyStore() {
  KeyStore.init.apply(this, arguments);
}

assign(KeyStore.prototype, {
  add: function add(key) {
    if (isArray(key)) {
      key.forEach(this.add, this);
      return Promise.resolve();
    }

    if (!key || !key.keyUrl) {
      return Promise.reject(new Error('`key` does not appear to be a valid Key'));
    }

    var existing = this.keys[key.keyUrl];
    if (existing) {
      merge(existing, key);
    }
    else {
      this.keys[key.keyUrl] = key;
    }

    return Promise.resolve();
  },

  addUnused: function addUnused(key) {
    if (isArray(key)) {
      key.forEach(this.addUnused, this);
      return Promise.resolve();
    }

    if (!key || !key.keyUrl) {
      return Promise.reject(new Error('`key` does not appear to be a valid Key'));
    }

    // Reminder: `this.keys` contains all keys, not just bound keys. Do not
    // exclude a key from `this.unusedKeys` just because it's in `this.keys`.

    // Only add the key if it hasn't already been added (we might get it
    // more than once if create is called twice before a particular key is
    // used).
    if (!find(this.unusedKeys, {keyUrl: key.keyUrl})) {
      this.unusedKeys.push(key);
    }

    return Promise.resolve();
  },

  clear: function clear() {
    this.keys = {};
    this.unusedKeys = [];
    return Promise.resolve();
  },

  get: function get(keyUrl) {
    if (!keyUrl) {
      return Promise.reject(new Error('`keyUrl` is a required parameter'));
    }

    if (keyUrl.indexOf('http') !== 0 && keyUrl.indexOf('kms') !== 0) {
      return Promise.reject(new Error('`keyUrl` does not appear to be a URL'));
    }

    var key = this.keys[keyUrl];
    if (!key) {
      return Promise.reject(new Error('No key matches "' + keyUrl + '"'));
    }

    return Promise.resolve(key);
  },

  getUnused: function getUnused() {
    var key = this.unusedKeys.shift();

    if (!key) {
      return Promise.reject(new Error('No unused keys available'));
    }

    return Promise.resolve(key);
  }
});

assign(KeyStore, {
  init: function init() {
    this.keys = {};
    this.unusedKeys = [];
  }
});

module.exports = KeyStore;
