/* eslint-disable no-restricted-globals */

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env browser */

import Socket from './socket-base';

type BrowserWebSocketConstructor = typeof WebSocket;
type ShimGlobalScope = {
  MozWebSocket?: BrowserWebSocketConstructor;
  WebSocket?: BrowserWebSocketConstructor;
};

Socket.getWebSocketConstructor = function getWebSocketConstructor() {
  if (typeof WebSocket !== 'undefined') {
    return WebSocket;
  }

  // Based on https://github.com/heineiuo/isomorphic-ws/blob/9b977394ac875638c045fd9cf774ed418484b394/browser.js
  const scope = typeof globalThis !== 'undefined' ? (globalThis as ShimGlobalScope) : undefined;

  return scope?.MozWebSocket || scope?.WebSocket;
};

export default Socket;
