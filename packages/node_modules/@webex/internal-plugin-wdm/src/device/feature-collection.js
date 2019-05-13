/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import AmpCollection from 'ampersand-collection';
import FeatureModel from './feature-model';

const FeatureCollection = AmpCollection.extend({
  mainIndex: 'key',
  model: FeatureModel
});

export default FeatureCollection;
