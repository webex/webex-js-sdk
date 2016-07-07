/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

 'use strict';

var SparkBase = require('../../lib/spark-base');

var MediaClusterUrlModel = SparkBase.extend({
  idAttribute: 'url',

  props: {
    url: 'string'
  },

  session: {
    reachable: 'boolean',
    latency: 'number'
  },

  initialize: function initialize() {
    SparkBase.prototype.initialize.apply(this, arguments);
    this.listenToAndRun(this, 'change:url', this.check.bind(this));
  },

  check: function checkUrl() {
    // ignore undefined or urls that don't start with http, which is a possibility
    if (!this.url || (this.url.indexOf('http') !== 0)) {
      this.reachable = false;
      return Promise.resolve();
    }
    var startTime = Date.now();
    return this.request({
      uri: this.url,
      method: 'GET'})
      .then(function processResponse(res) {
          this.reachable = true;
          this.latency = Date.now() - startTime;
          this.logger.info('media cluster: able to reach media server @ ' + this.url);
          return res.body;
        }.bind(this))
      .catch(function processErrorResponse(res) {
          this.reachable = false;
          this.logger.warn('media cluster: failed to reach media server @' + this.url, res.statusCode, res.body);
        }.bind(this));
  }
});

module.exports = MediaClusterUrlModel;
