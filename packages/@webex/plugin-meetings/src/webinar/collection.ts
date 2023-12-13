/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */

import AmpCollection from 'ampersand-collection';

import {MEETINGS} from '../constants';

const WebinarCollection = AmpCollection.extend({
  namespace: MEETINGS,

  mainIndex: 'sessionId',
});

export default WebinarCollection;
