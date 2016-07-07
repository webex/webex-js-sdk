/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var Normalizer = require('./normalizer');
var html = require('../../../util/html');

function noop() {}

var OutboundNormalizer = Normalizer.extend(
  /** @lends Conversation.OutboundNormalizer.prototype */
  {
  _normalizePropContent: function _normalizePropContent(content) {
    var config = this.config || {};
    return html.filterEscape(noop, config.allowedOutboundTags || {}, config.allowedOutboundStyles || [], content);
  }
});

module.exports = OutboundNormalizer;
