/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

 'use strict';

var AmpCollection = require('ampersand-collection');
var MediaClusterUrlModel = require('./media-cluster-url-model');

var MediaClusterUrlCollection = AmpCollection.extend({
  mainIndex: 'url',
  model: MediaClusterUrlModel
});

module.exports = MediaClusterUrlCollection;
