/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AmpCollection = require('ampersand-collection');
var MediaClusterModel = require('./media-cluster-model');

var MediaClusterCollection = AmpCollection.extend({
  model: MediaClusterModel
});

module.exports = MediaClusterCollection;
