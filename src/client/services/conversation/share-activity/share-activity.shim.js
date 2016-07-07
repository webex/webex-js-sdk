/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint-env browser */
var ShareActivityBase = require('./share-activity-base');

/**
  * @class
  * @extends {Conversation.ShareActivityBase}
  * @memberof ShareActivity
  */
var ShareActivity = ShareActivityBase.extend({
  /** @lends Conversation.ShareActivity.prototype */

  _processImage: function _processImage() {
    return ShareActivityBase.prototype._processImage.apply(this, arguments)
      .catch(function handleNonImage() {
        // resolve gracefully when not an image
        return Promise.resolve();
      });
  }
});

module.exports = ShareActivity;
