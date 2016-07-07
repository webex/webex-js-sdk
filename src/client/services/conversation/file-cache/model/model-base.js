'use strict';

var AmpState = require('ampersand-state');

var FileCacheModelBase = AmpState.extend({
  idAttribute: 'url',

  props: {
    file: {
      required: true,
      type: 'object'
    },
    url: {
      required: true,
      type: 'string'
    }
  }
});

module.exports = FileCacheModelBase;
