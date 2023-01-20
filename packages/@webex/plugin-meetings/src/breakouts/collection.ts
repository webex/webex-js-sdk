/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */

import AmpCollection from 'ampersand-collection';

import {MEETINGS} from '../constants';

import Breakout from './breakout';

const BreakoutCollection = AmpCollection.extend({
  model: Breakout,

  namespace: MEETINGS,

  mainIndex: 'sessionId',
});

export default BreakoutCollection;
