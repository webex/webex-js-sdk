/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var MercuryMetrics = require('../../../mercury/metrics');
var pick = require('lodash.pick');

/**
 * @class
 * @extends {MercuryMetrics}
 * @memberof Board.RealtimeService
 */
var BoardMetrics = MercuryMetrics.extend(
  /** @lends BoardMetrics.prototype */
  {
  _preparePayload: function _preparePayload(payload, event) {
    assign(payload, {
      deviceUrl: this.spark.device.url,
      userId: this.spark.device.userId,
      webSocketUrl: this.spark.board.realtime.get('boardWebSocketUrl'),
      service: 'board'
    }, pick(event, 'reason', 'code'));

    return payload;
  }
});

module.exports = BoardMetrics;
