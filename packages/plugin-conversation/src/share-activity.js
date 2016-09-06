/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin2} from '@ciscospark/spark-core';
import {contains, filter, map} from 'lodash';
import {EventEmitter} from 'events';

const uploads = new WeakMap();
const spaceUrls = new WeakMap();
const hiddenSpaceUrls = new WeakMap();

const allmentions = new WeakMap();
const alldisplayName = new WeakMap();
const allcontent = new WeakMap();

const EMITTER_SYMBOL = Symbol(`EMITTER_SYMBOL`);
const PROMISE_SYMBOL = Symbol(`PROMISE_SYMBOL`);

import processImage from './process-image';

export default class ShareActivity extends SparkPlugin2 {
  get uploads() {
    return uploads.get(this);
  }

  get mentions() {
    return allmentions.get(this);
  }

  set mentions(val) {
    return allmentions.set(this, val);
  }

  get namespace() {
    return `Conversation`;
  }

  get displayName() {
    return alldisplayName.get(this);
  }

  set displayName(val) {
    return alldisplayName.set(this, val);
  }

  get content() {
    return allcontent.get(this);
  }

  set content(val) {
    return allcontent.set(this, val);
  }

  static create(conversation, object, spark) {
    if (object instanceof ShareActivity) {
      return object;
    }

    const share = new ShareActivity(Object.assign({
      conversation
    }), {
      parent: spark
    });

    if (object.files) {
      object.files.forEach((file) => share.add(file));
    }

    return share;
  }

  constructor(attrs, options) {
    super(attrs, options);
    if (!attrs.conversation) {
      throw new Error(`\`attrs.conversation\` is required`);
    }
    uploads.set(this, new Map());

    this.mentions = attrs.mentions;
    this.displayName = attrs.displayName;
    this.content = attrs.content;

    // TODO can we use symbols instead of _?
    const spaceUrl = Promise.resolve(attrs.conversation._spaceUrl || this._retrieveSpaceUrl(`${attrs.conversation.url}/space`)
      .then((url) => {
        attrs.conversation._spaceUrl = url;
        return url;
      }));

    const hiddenSpaceUrl = Promise.resolve(attrs.conversation._hiddenSpaceUrl || this._retrieveSpaceUrl(`${attrs.conversation.url}/space/hidden`)
      .then((url) => {
        attrs.conversation._hiddenSpaceUrl = url;
        return url;
      }));

    spaceUrls.set(this, spaceUrl);
    hiddenSpaceUrls.set(this, hiddenSpaceUrl);
  }

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
            return Promise.all([cdata, spaceUrls.get(this)]);
          })
          .then(([cdata, spaceUrl]) => this._upload(cdata, `${spaceUrl}/upload_sessions`))
          .then((metadata) => {
            upload.url = upload.scr.loc = metadata.downloadUrl;
          });

        // TODO transferEvents(main, promise);

        let thumb;
        if (imageData) {
          const [thumbnail, fileDimensions, thumbnailDimensions] = imageData;
          Object.assign(upload, fileDimensions);

          upload.image = thumbnailDimensions;
          thumb = this.spark.encryption.encryptBinary(thumbnail)
            .then(({scr, cdata}) => {
              upload.image.scr = scr;
              return Promise.all([cdata, hiddenSpaceUrls.get(this)]);
            })
            .then(([cdata, spaceUrl]) => this._upload(cdata, `${spaceUrl}/upload_sessions`))
            .then((metadata) => {
              upload.image.url = upload.image.scr.loc = metadata.downloadUrl;
            });
        }

        return Promise.all([main, thumb]);
      });


    upload[PROMISE_SYMBOL] = promise;

    return promise;
  }

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
  }

  remove(file) {
    this.uploads.remove(file);
  }

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
      }
    };

    const promises = [];
    this.uploads.forEach((item) => {
      activity.object.files.items.push(item);
      promises.push(item[PROMISE_SYMBOL]);
    });

    activity.object.contentCategory = this._determineContentCategory(activity.object.files.items);

    return Promise.all(promises)
      .then(() => activity);
  }

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
  }

  _retrieveSpaceUrl(uri) {
    return this.spark.request({
      method: `PUT`,
      uri
    })
      .then((res) => res.body.spaceUrl);
  }
}
