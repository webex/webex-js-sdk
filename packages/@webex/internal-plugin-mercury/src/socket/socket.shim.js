/* eslint-disable no-restricted-globals */

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env browser */

import Socket from './socket-base';

Socket.getWebSocketConstructor = function getWebSocketConstructor() {
  // Grabed from https://github.com/heineiuo/isomorphic-ws/blob/9b977394ac875638c045fd9cf774ed418484b394/browser.js
  let ws;

  if (typeof WebSocket !== 'undefined') {
    ws = WebSocket;
  } else if (typeof MozWebSocket !== 'undefined') {
    // eslint-disable-next-line no-undef
    ws = MozWebSocket;
  } else if (typeof global !== 'undefined') {
    ws = global.WebSocket || global.MozWebSocket;
  } else if (typeof window !== 'undefined') {
    ws = window.WebSocket || window.MozWebSocket;
  } else if (typeof self !== 'undefined') {
    ws = self.WebSocket || self.MozWebSocket;
  }

  return ws;
};

export default Socket;
