/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env browser */

import Socket from './socket-base';

Socket.getWebSocketConstructor = function getWebSocketConstructor() {
  return WebSocket;
};

export default Socket;
