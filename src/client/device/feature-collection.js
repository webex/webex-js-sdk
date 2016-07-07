/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AmpCollection = require('ampersand-collection');
var FeatureModel = require('./feature-model');

var FeatureCollection = AmpCollection.extend({
  mainIndex: 'key',
  model: FeatureModel
});

module.exports = FeatureCollection;
