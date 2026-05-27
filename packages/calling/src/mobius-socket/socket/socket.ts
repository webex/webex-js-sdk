/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import WS from 'ws';

import Socket from './socket-base';
import type {SocketTransportConstructor} from './types';

Socket.getWebSocketConstructor = function getWebSocketConstructor() {
  return WS as unknown as SocketTransportConstructor;
};

export default Socket;
