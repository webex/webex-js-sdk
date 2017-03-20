/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var has = require('lodash.has');
var Magic = require('mmmagic');
var ShareActivityBase = require('./share-activity-base');

/**
 * @class
 * @extends {Conversation.ShareActivityBase}
 * @memberof Conversation
 */
var ShareActivity = ShareActivityBase.extend({
  addFile: function addFile(file, options) {
    if (!file.type) {
      return new Promise(function executor(resolve, reject) {
        var magic = new Magic.Magic(Magic.MAGIC_MIME_TYPE);
        magic.detect(has(file, 'file') ? file.file : file, function magicCallback(err, res) {
          if (err) {
            reject(err);
          }
          else {
            file.type = res;
            resolve(file);
          }
        });
      })
        .then(function addFileBase(file) {
          return ShareActivityBase.prototype.addFile(file, options).bind(this);
        });
    }
    else {
      return ShareActivityBase.prototype.addFile.apply(this, arguments);
    }
  },

  _processImage: function _processImage() {
    return ShareActivityBase.prototype._processImage.apply(this, arguments)
      .catch(function handleMissingLibrary(err) {
        var errorString = err.toString();
        if (errorString.indexOf('EPIPE') !== -1) {
          this.logger.warn(err, 'Is GraphicsMagick installed?');
          return Promise.resolve();
        }

        if (errorString.indexOf('No decode delegate for this image format') !== -1) {
          this.logger.debug(err, 'File does not appear to be an image');
          return Promise.resolve();
        }

        if (errorString.indexOf('Stream yields empty buffer')) {
          this.logger.debug(err, 'File does not appear to be an image');
          return Promise.resolve();
        }

        return Promise.reject(err);
      }.bind(this));
  }
});

module.exports = ShareActivity;
