/** !
 *
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import AmpCollection from 'ampersand-collection';

import RealtimeChannel from './realtime-channel.js';

const RealtimeChannelCollection = AmpCollection.extend({
  mainIndex: 'channelId',
  model: RealtimeChannel,

  namespace: 'Board'
});

export default RealtimeChannelCollection;
