'use strict';

/* eslint-env browser */

var FileCacheModelBase = require('./model-base');

var FileCacheModel = FileCacheModelBase.extend({
  derived: {
    objectURL: {
      deps: ['file'],
      fn: function objectURL() {
        return URL.createObjectURL(this.file);
      }
    }
  }
});

module.exports = FileCacheModel;
