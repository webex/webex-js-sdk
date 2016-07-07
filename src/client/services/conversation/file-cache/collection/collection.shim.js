'use strict';

var FileCacheBase = require('./collection-base');

var FileCache = FileCacheBase.extend({
  getObjectURL: function getObjectURL(url) {
    return this._getModel(url)
      .then(function getObjectURL(model) {
        return model.objectURL;
      });
  }
});

module.exports = FileCache;
