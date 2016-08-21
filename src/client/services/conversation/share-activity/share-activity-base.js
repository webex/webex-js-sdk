/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var contains = require('lodash.contains');
var defaults = require('lodash.defaults');
var EventEmitter = require('events').EventEmitter;
var filter = require('lodash.filter');
var findIndex = require('lodash.findindex');
var merge = require('lodash.merge');
var oneFlight = require('../../../../util/one-flight');
var pick = require('lodash.pick');
var pluck = require('lodash.pluck');
var imageUtil = require('../../../../lib/image');
var remove = require('lodash.remove');
var resolveWith = require('../../../../util/resolve-with');
var SparkBase = require('../../../../lib/spark-base');
var uuid = require('uuid');
var values = require('lodash.values');

function makeOneFlightKeyGenerator(prefix) {
  return function generateKey(conversation) {
    return prefix + conversation.url;
  };
}

/**
 * @class
 * @extends {SparkBase}
 * @memberof Conversation
 */
var ShareActivityBase = SparkBase.extend(
  /** @lends Conversation.ShareActivityBase.prototype */
  {
  namespace: 'Conversation',

  extraProperties: 'allow',

  props: {
    actor: {
      type: 'object'
    },
    clientTempId: {
      type: 'string',
      default: function clientTempId() {
        return uuid.v4();
      }
    },
    encryptionKeyUrl: 'string',
    id: 'string',
    object: {
      type: 'object',
      default: function object() {
        return {
          files: {
            items: []
          },
          objectType: 'content'
        };
      }
    },
    objectType: {
      type: 'string',
      default: 'activity'
    },
    published: 'string',
    target: {
      type: 'object',
      required: true
    },
    url: 'string',
    verb: {
      type: 'string',
      default: 'share'
    }
  },

  session: {
    files: {
      type: 'array',
      default: function files() {
        return [];
      }
    },
    uploads: {
      type: 'object',
      default: function uploads() {
        return {};
      }
    }
  },

  parse: function parse(attrs) {
    if (attrs.object) {
      attrs.object = assign({
          files: {
            items: []
          }
        },
        pick(attrs.object, 'displayName', 'content', 'mentions', 'objectType')
      );
    }

    return attrs;
  },

  /**
   * Uploads a file to the target conversation
   * and stores the result in _files array on
   * the activity. If the upload completes and the
   * file is no longer in the files array, then the
   * upload is discarded.
   * @param {FileObject} file
   * @returns {Promise} Resolves with the updated activity
   */
  addFile: function addFile(file) {
    // Give the file a temp id and push it on as while the upload is pending
    file.clientTempId = file.clientTempId || uuid.v4();

    var index = findIndex(this.files, {clientTempId: file.clientTempId});

    if (index === -1) {
      this.files.push(file);
    }
    else {
      merge(this.files[index], file);

      // If we have an upload for this file, return that promise, otherwise
      // make a new one.
      if (this.uploads[file.clientTempId]) {
        return this.uploads[file.clientTempId];
      }
    }

    var emitter = new EventEmitter();
    var uploadPromise;
    this.target._spaceUrl = this.target._spaceUrl || this._retrieveSpaceUrl(this.target);
    this.target._hiddenSpaceUrl = this.target._hiddenSpaceUrl || this._retrieveHiddenSpaceUrl(this.target);

    uploadPromise = Promise.all([
      this.target._spaceUrl,
      this.target._hiddenSpaceUrl,
      file,
      this.spark.encryption.encryptBinary(file),
      this._processImage(file)
    ])
      .then(function resizeAndUploadFiles(args) {
        this.target._spaceUrl = args[0];
        this.target._hiddenSpaceUrl = args[1];
        var file = args[2];
        var cblob = args[3].cblob;
        var scr = args[3].scr;
        var imageData = args[4];

        var item = {};

        var promises = [];

        var fileSize = cblob.length || cblob.size || cblob.byteLength;

        var filePromise = this.upload({
          uri: this.target._spaceUrl + '/upload_sessions',
          file: cblob,
          qs: {
            transcode: true
          },
          phases: {
            initialize: {
              fileSize: fileSize
            },
            upload: {
              $uri: function $uri(session) {
                return session.uploadUrl;
              }
            },
            finalize: {
              $uri: function $uri(session) {
                return session.finishUploadUrl;
              },
              body: {
                fileSize: fileSize
              }
            }
          }
        })
          .on('progress', emitter.emit.bind(emitter, 'upload-progress'))
          .then(function assignFileMetadata(data) {
            scr.loc = data.downloadUrl;
            assign(item, {
              clientTempId: file.clientTempId,
              displayName: file.name,
              fileSize: file.size || file.byteLength || file.length,
              mimeType: file.type,
              objectType: 'file',
              scr: scr,
              url: data.downloadUrl
            });
          });

        promises.push(filePromise);

        if (imageData) {
          assign(item, imageData.dimensions);
          item.image = imageData.image;

          if (imageData.thumbnailBlob) {
            var thumbnailFileSize = imageData.thumbnailBlob.length || imageData.thumbnailBlob.size || imageData.thumbnailBlob.byteLength;

            var thumbnailPromise = this.upload({
              uri: this.target._hiddenSpaceUrl + '/upload_sessions',
              file: imageData.thumbnailBlob,
              phases: {
                initialize: {
                  fileSize: thumbnailFileSize
                },
                upload: {
                  $uri: function $uri(session) {
                    return session.uploadUrl;
                  }
                },
                finalize: {
                  $uri: function $uri(session) {
                    return session.finishUploadUrl;
                  },
                  body: {
                    fileSize: thumbnailFileSize
                  }
                }
              }
            })
              .then(function assignThumbnailUrl(data) {
                item.image.url = data.downloadUrl;
                item.image.scr.loc = data.downloadUrl;
              });

            promises.push(thumbnailPromise);
          }
        }

        return Promise.all(promises)
          .then(resolveWith(item))
          .then(function storeFiles(item) {
            var pendingIndex = findIndex(this.files, {clientTempId: item.clientTempId});
            if (pendingIndex > -1) {
              this.object.files.items.splice(pendingIndex, 0, item);
            }
            return this;
          }.bind(this));
      }.bind(this));

    uploadPromise.on = function on() {
      emitter.on.apply(emitter, arguments);
      return uploadPromise;
    };

    this.uploads[file.clientTempId] = uploadPromise;
    return uploadPromise;
  },

  addAvatarFile: function addAvatarFile(file) {
    // Give the file a temp id and push it on as while the upload is pending
    file.clientTempId = file.clientTempId || uuid.v4();

    var index = findIndex(this.files, {clientTempId: file.clientTempId});

    if (index === -1) {
      this.files.push(file);
    }
    else {
      merge(this.files[index], file);

      // If we have an upload for this file, return that promise, otherwise
      // make a new one.
      if (this.uploads[file.clientTempId]) {
        return this.uploads[file.clientTempId];
      }
    }

    var emitter = new EventEmitter();
    var uploadPromise;
    var scr;
    this.target._spaceUrl = this.target._spaceUrl || this._retrieveSpaceUrl(this.target);
    uploadPromise = Promise.all([
      this.target._spaceUrl,
      this.spark.encryption.encryptBinary(file)
    ])
      .then(function uploadEncryptedBinary(args) {
        this.target._spaceUrl = args[0];
        var cblob = args[1].cblob;
        scr = args[1].scr;

        var fileSize = cblob.length || cblob.size || cblob.byteLength;

        return this.upload({
          uri: this.target._spaceUrl + '/upload_sessions',
          file: cblob,
          qs: {
            transcode: true
          },
          phases: {
            initialize: {
              fileSize: fileSize
            },
            upload: {
              $uri: function $uri(session) {
                return session.uploadUrl;
              }
            },
            finalize: {
              $uri: function $uri(session) {
                return session.finishUploadUrl;
              },
              body: {
                fileSize: fileSize
              }
            }
          }
        })
          .then(function returnActivity(data) {
            scr.loc = data.downloadUrl;
            var item = {
              clientTempId: file.clientTempId,
              fileSize: file.size || file.byteLength || file.length,
              mimeType: file.type,
              objectType: 'file',
              scr: scr,
              url: data.downloadUrl
            };
            var pendingIndex = findIndex(this.files, {clientTempId: item.clientTempId});
            if (pendingIndex > -1) {
              this.object.files.items.splice(pendingIndex, 0, item);
            }
            return item;
          }.bind(this));
      }.bind(this));

    uploadPromise.on = function on() {
      emitter.on.apply(emitter, arguments);
      return uploadPromise;
    };

    this.uploads[file.clientTempId] = uploadPromise;
    return uploadPromise;
  },

  /**
   * Prepares a version of the share activity for the API
   * that contains only necessary fields.
   * @param {Object} properties
   * @returns {Promise} Resolves with activity
   */
  prepare: function prepare(properties) {
    return Promise.all(values(this.uploads))
      .then(function prepareActivity() {

        if (!this.object.files.items || !this.object.files.items.length) {
          return Promise.reject(new Error('Cannot submit share activity without files'));
        }

        var activity = {
          verb: this.verb,
          target: defaults({}, pick(this.target, 'id', 'objectType', 'url'), {
            objectType: 'conversation'
          }),
          object: {
            objectType: 'content',
            displayName: this.object.displayName || properties.displayName,
            content: this.object.content || properties.content,
            mentions: this.object.mentions || properties.mentions,
            files: {
              items: this.object.files.items.map(function prepareFile(file) {
                var item = pick(file, 'displayName', 'fileSize', 'mimeType', 'objectType', 'scr', 'url', 'clientTempId');
                if (file.image && file.image.scr) {
                  item.image = file.image;
                }
                return item;
              })
            }
          },
          actor: this.actor
        };

        activity.object.contentCategory = this._determineContentCategory(activity.object.files.items);
        activity.clientTempId = this.clientTempId || uuid.v4();

        return activity;
      }.bind(this));
  },

  /**
   * Removes a file from lists or provisional files and
   * the list of files that have completed uploading.
   * @param {FileObject} file to be removed from the pending ShareActivity
   */
  removeFile: function removeFile(file) {
    remove(this.files, {clientTempId: file.clientTempId});
    delete this.uploads[file.clientTempId];
    remove(this.object.files.items, {clientTempId: file.clientTempId});
    return this;
  },

  /**
   * Determines the content category for the items
   * @param {Array} items
   * @returns {string}
   * @private
   */
  _determineContentCategory: function _determineContentCategory(items) {
    var mimeTypes = filter(pluck(items, 'mimeType'));
    if (mimeTypes.length !== items.length) {
      return 'documents';
    }

    var contentCategory = mimeTypes[0].split('/').shift();
    if (!contains(['image', 'video'], contentCategory)) {
      return 'documents';
    }

    for (var i = 1; i < mimeTypes.length; i++) {
      if (mimeTypes[i].split('/').shift() !== contentCategory) {
        return 'documents';
      }
    }

    return contentCategory + 's';
  },

  /**
   * Creates a thumbnail and detects other image data
   * @private
   */
  _processImage: function _processImage(file, options) {
    var metadata = {};
    return imageUtil.processImage(file, metadata, options)
      .then(function encryptThumbnail(thumbnail) {
        return this.spark.encryption.encryptBinary(thumbnail);
      }.bind(this))
      .then(function assignThumbnailData(data) {
        metadata.thumbnailBlob = data.cblob;
        metadata.image.scr = data.scr;
        return metadata;
      });
  },

  /**
   * Retrieves the space url for the specified conversation
   * @param {Object} conversation
   * @returns {Promise} Resolves with the conversation's space url
   * @private
   */
  _retrieveSpaceUrl: oneFlight(makeOneFlightKeyGenerator('retrieve-space-url-'), function _retrieveSpaceUrl(conversation) {
    return this.request({
      method: 'PUT',
      uri: conversation.url + '/space'
    })
      .then(function processResponse(res) {
        return res.body.spaceUrl;
      });
  }),

  /**
   * Retrieves the hidden space url for the specified conversation
   * @param {Object} conversation
   * @returns {Promise} Resolves with the conversation's hidden space url
   * @private
   */
  _retrieveHiddenSpaceUrl: oneFlight(makeOneFlightKeyGenerator('retrieve-hidden-space-url'), function _retrieveHiddenSpaceUrl(conversation) {
    return this.request({
      method: 'PUT',
      uri: conversation.url + '/space/hidden'
    })
      .then(function processResponse(res) {
        return res.body.spaceUrl;
      });
  })
});

module.exports = ShareActivityBase;
