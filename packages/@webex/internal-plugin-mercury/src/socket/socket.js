/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import WS from 'ws';

import Socket from './socket-base';

Socket.getWebSocketConstructor = function getWebSocketConstructor() {
  return WS;
};

export default Socket;
