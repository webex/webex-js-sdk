# @webex/internal-plugin-llm

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Plugin for the LLM service

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our [developer api](https://developer.webex.com/) and stick to our public plugins.

- [@webex/internal-plugin-llm](#webexinternal-plugin-llm)
  - [Install](#install)
  - [Usage](#usage)
  - [Maintainers](#maintainers)
  - [Contribute](#contribute)
  - [License](#license)

## Install

```bash
npm install --save @webex/internal-plugin-llm
```

## Usage

```js
import '@webex/internal-plugin-llm';
import WebexCore from '@webex/webex-core';
// Optional: import enum from package internals if needed in your app setup
// import {DataChannelTokenType} from '@webex/internal-plugin-llm/src/llm.types';

const webex = new WebexCore();

// locusUrl and datachannelUrl are from meeting.locusInfo
const locusUrl = meeting.locusInfo.url;
const datachannelUrl = meeting.locusInfo.info.datachannelUrl;

// Optional JWT token for data channel auth
const datachannelToken = '<jwt-token>';

// Default session (no token)
await webex.internal.llm.registerAndConnect(locusUrl, datachannelUrl);

// Default session (with JWT token)
await webex.internal.llm.registerAndConnect(locusUrl, datachannelUrl, datachannelToken);

// Multiple named sessions
await webex.internal.llm.registerAndConnect(locusUrlA, datachannelUrlA, undefined, 'session-a');
await webex.internal.llm.registerAndConnect(
  locusUrlB,
  datachannelUrlB,
  datachannelToken,
  'session-b'
);

// Listen across multiple connections
const llm = webex.internal.llm;
const sessionA = 'session-a';
const sessionB = 'session-b';

// Default session events use the base event name.
llm.on('online', () => {
  console.log('[default] connected');
});

llm.on('event', (envelope) => {
  console.log('[default] event', envelope.data?.eventType, envelope.sessionId);
});

// Non-default sessions emit events with :<sessionId> suffix.
llm.on(`online:${sessionA}`, () => {
  console.log(`[${sessionA}] connected`);
});

llm.on(`event:${sessionA}`, (envelope) => {
  console.log(`[${sessionA}] event`, envelope.data?.eventType, envelope.sessionId);
});

llm.on(`event:${sessionB}`, (envelope) => {
  console.log(`[${sessionB}] event`, envelope.data?.eventType, envelope.sessionId);
});

// Optional: store/retrieve token by token type
webex.internal.llm.setDatachannelToken(datachannelToken, 'llm-default-session');
webex.internal.llm.getDatachannelToken('llm-default-session');

// Optional: inject token refresh handler
webex.internal.llm.setRefreshHandler(async () => {
  // Return shape must match plugin expectation
  return {
    body: {
      datachannelToken: '<refreshed-jwt-token>',
      datachannelTokenType: 'llm-default-session',
    },
  };
});

// Optional: manually trigger refresh (if needed by your flow)
await webex.internal.llm.refreshDataChannelToken();

// Per-session status and metadata
webex.internal.llm.isConnected('session-a');
webex.internal.llm.getBinding('session-a');
webex.internal.llm.getLocusUrl('session-a');
webex.internal.llm.getDatachannelUrl('session-a');

// All active sessions
webex.internal.llm.getAllConnections();

// Disconnect one session
await webex.internal.llm.disconnectLLM({code: 1000, reason: 'done'}, 'session-a');

// Disconnect all sessions
await webex.internal.llm.disconnectAllLLM({code: 1000, reason: 'shutdown'});
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2022 Cisco and/or its affiliates. All Rights Reserved.
