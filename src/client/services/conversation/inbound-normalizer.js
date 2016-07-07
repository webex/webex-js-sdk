/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var Normalizer = require('./normalizer');
var html = require('../../../util/html');

function noop() {}

var InboundNormalizer = Normalizer.extend(
  /** @lends Conversation.InboundNormalizer.prototype */
  {
  _normalizePropContent: function _normalizePropContent(content) {
    var config = this.config || {};
    return html.filter(config.processContent || noop, config.allowedInboundTags || {}, config.allowedInboundStyles || [], content);
  }
});

module.exports = InboundNormalizer;
