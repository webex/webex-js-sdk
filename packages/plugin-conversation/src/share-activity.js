/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {proxyEvents, transferEvents} from '@ciscospark/common';
import {SparkPlugin} from '@ciscospark/spark-core';
import {contains, filter, map} from 'lodash';
import {EventEmitter} from 'events';

const EMITTER_SYMBOL = Symbol(`EMITTER_SYMBOL`);
const PROMISE_SYMBOL = Symbol(`PROMISE_SYMBOL`);

import processImage from './process-image';

const ShareActivity = SparkPlugin.extend({
  namespace: `Conversation`,

  session: {
    conversation: {
      required: true,
      type: `object`
    },

    content: `string`,

    clientTempId: `string`,

    displayName: `string`,

    hiddenSpaceUrl: `object`,

    mentions: `object`,

    spaceUrl: `object`,

    uploads: {
      type: `object`,
      default() {
        return new Map();
      }
    }
  },

  initialize(attrs, options) {
    Reflect.apply(SparkPlugin.prototype.initialize, this, [attrs, options]);

    this.spaceUrl = Promise.resolve(attrs.conversation._spaceUrl || this._retrieveSpaceUrl(`${attrs.conversation.url}/space`)
      .then((url) => {
        attrs.conversation._spaceUrl = url;
        return url;
      }));

    this.hiddenSpaceUrl = Promise.resolve(attrs.conversation._hiddenSpaceUrl || this._retrieveSpaceUrl(`${attrs.conversation.url}/space/hidden`)
      .then((url) => {
        attrs.conversation._hiddenSpaceUrl = url;
        return url;
      }));
  },

  add(file) {
    let upload = this.uploads.get(file);
    if (upload) {
      return upload[PROMISE_SYMBOL];
    }

    const emitter = new EventEmitter();

    upload = {
      displayName: file.name,
      fileSize: file.size || file.byteLength || file.length,
      mimeType: file.type,
      objectType: `file`,
      [EMITTER_SYMBOL]: emitter
    };

    this.uploads.set(file, upload);

    const promise = processImage(file, this.config.thumbnailMaxWidth, this.config.thumbnailMaxHeight, this.logger)
      .then((imageData) => {
        const main = this.spark.encryption.encryptBinary(file)
          .then(({scr, cdata}) => {
            upload.scr = scr;
            return Promise.all([cdata, this.spaceUrl]);
          })
          .then(([cdata, spaceUrl]) => {
            const uploadPromise = this._upload(cdata, `${spaceUrl}/upload_sessions`);
            transferEvents(`progress`, uploadPromise, emitter);
            return uploadPromise;
          })
          .then((metadata) => {
            upload.url = upload.scr.loc = metadata.downloadUrl;
          });


        let thumb;
        if (imageData) {
          const [thumbnail, fileDimensions, thumbnailDimensions] = imageData;
          Object.assign(upload, fileDimensions);

          upload.image = thumbnailDimensions;
          thumb = this.spark.encryption.encryptBinary(thumbnail)
            .then(({scr, cdata}) => {
              upload.image.scr = scr;
              return Promise.all([cdata, this.hiddenSpaceUrl]);
            })
            .then(([cdata, spaceUrl]) => this._upload(cdata, `${spaceUrl}/upload_sessions`))
            .then((metadata) => {
              upload.image.url = upload.image.scr.loc = metadata.downloadUrl;
            });
        }

        return Promise.all([main, thumb]);
      });


    upload[PROMISE_SYMBOL] = promise;

    proxyEvents(emitter, promise);
    return promise;
  },

  _upload(file, uri) {
    const fileSize = file.length || file.size || file.byteLength;

    return this.spark.upload({
      uri,
      file,
      qs: {
        transcode: true
      },
      phases: {
        initialize: {fileSize},
        upload: {
          $url(session) {
            return session.uploadUrl;
          }
        },
        finalize: {
          $uri(session) {
            return session.finishUploadUrl;
          },
          body: {fileSize}
        }
      }
    });
  },

  remove(file) {
    this.uploads.delete(file);
  },

  prepare() {
    const activity = {
      verb: `share`,
      object: {
        objectType: `content`,
        displayName: this.displayName,
        content: this.content,
        mentions: this.mentions,
        files: {
          items: []
        }
      },
      clientTempId: this.clientTempId
    };

    const promises = [];
    this.uploads.forEach((item) => {
      activity.object.files.items.push(item);
      promises.push(item[PROMISE_SYMBOL]);
    });

    activity.object.contentCategory = this._determineContentCategory(activity.object.files.items);

    return Promise.all(promises)
      .then(() => activity);
  },

  _determineContentCategory(items) {
    const mimeTypes = filter(map(items, `mimeType`));
    if (mimeTypes.length !== items.length) {
      return `documents`;
    }

    const contentCategory = mimeTypes[0].split(`/`).shift();
    if (!contains([`image`, `video`], contentCategory)) {
      return `documents`;
    }

    for (const mimeType of mimeTypes) {
      if (mimeType.split(`/`).shift() !== contentCategory) {
        return `documents`;
      }
    }

    return `${contentCategory}s`;
  },

  _retrieveSpaceUrl(uri) {
    return this.spark.request({
      method: `PUT`,
      uri
    })
      .then((res) => res.body.spaceUrl);
  }
});

ShareActivity.create = function create(conversation, object, spark) {
  if (object instanceof ShareActivity) {
    return object;
  }

  let files;
  if (object && object.object && object.object.files) {
    files = object.object.files;
    Reflect.deleteProperty(object.object, `files`);
  }

  const share = new ShareActivity(Object.assign({
    conversation
  }, object), {
    parent: spark
  });

  if (files) {
    files.forEach((file) => share.add(file));
  }

  return share;
};

export default ShareActivity;
