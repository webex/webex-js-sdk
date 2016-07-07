'use strict';

var AmpCollection = require('ampersand-collection');
var FileCacheModel = require('../model');

var FileCacheBase = AmpCollection.extend({
  mainIndex: 'url',

  model: FileCacheModel,

  getFile: function getFile(url) {
    return this._getModel(url)
      .then(function getFile(model) {
        return model.file;
      });
  },

  _getModel: function _getModel(url) {
    var model = this.get(url);
    if (model) {
      return Promise.resolve(model);
    }
    else {
      return Promise.reject(new Error('no model found for `url`'));
    }
  }
});

module.exports = FileCacheBase;
