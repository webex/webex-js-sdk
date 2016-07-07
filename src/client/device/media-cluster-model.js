/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AmpState = require('ampersand-state');
var MediaClusterUrlCollection = require('./media-cluster-url-collection');

var MediaClusterModel = AmpState.extend({
  props: {
    id: 'string'
  },
  collections: {
    urls: MediaClusterUrlCollection
  },
  derived: {
    reachable: {
      deps: ['urls'],
      fn: function getReachable() {
        if (this.urls) {
          for (var i = 0; i < this.urls.length; ++i) {
            var url = this.urls.at(i);
            if (url.reachable) {
              return true;
            }
          }
        }
        return false;
      }
    },
    latency: {
      deps: ['urls'],
      fn: function getLatency() {
        var latency;
        if (this.urls) {
          for (var i = 0; i < this.urls.length; ++i) {
            var url = this.urls.at(i);
            latency = (latency || url.latency);
            latency = Math.min(latency, url.latency);
          }
        }
        return latency;
      }
    }
  }
});

module.exports = MediaClusterModel;
