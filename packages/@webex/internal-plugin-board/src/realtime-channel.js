/** !
 *
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Mercury} from '@webex/internal-plugin-mercury';

const RealtimeChannel = Mercury.extend({
  namespace: 'Board',

  props: {
    channelId: {
      type: 'string',
      required: true
    },
    socketUrl: {
      type: 'string'
    },
    binding: {
      type: 'string'
    }
  },

  session: {
    isSharingMercury: {
      type: 'boolean',
      default: false
    },
    socket: {
      type: 'object'
    }
  },

  send(data) {
    return this.socket.send(data);
  }
});

export default RealtimeChannel;

