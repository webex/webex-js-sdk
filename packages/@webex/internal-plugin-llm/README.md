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

const webex = new WebexCore();

// Create a new LLM connection (each meeting owns its own channel)
const llmChannel = webex.internal.llm.createConnection();

// locusUrl and datachannelUrl are from meeting.locusInfo
const locusUrl = meeting.locusInfo.url;
const datachannelUrl = meeting.locusInfo.info.datachannelUrl;

// Optional: set up token refresh handler before connecting
llmChannel.setRefreshHandler(async () => {
  // Return shape must match plugin expectation
  return {
    body: {
      datachannelToken: '<refreshed-jwt-token>',
      datachannelTokenType: 'llm-default-session', // or 'llm-practice-session'
    },
  };
});

// Connect (with optional JWT token for data channel auth)
const datachannelToken = '<jwt-token>';
await llmChannel.registerAndConnect(locusUrl, datachannelUrl, datachannelToken);

// Subscribe to events directly on the channel
llmChannel.on('online', () => {
  console.log('LLM connected');
});

llmChannel.on('event:relay.event', (envelope) => {
  console.log('LLM event', envelope.data?.eventType);
});

// Channel status and metadata
llmChannel.isConnected();
llmChannel.isConnecting();
llmChannel.getBinding();
llmChannel.getLocusUrl();
llmChannel.getDatachannelUrl();
llmChannel.getSocket();

// Token management
llmChannel.setDatachannelToken(datachannelToken);
llmChannel.getDatachannelToken();
llmChannel.clearDatachannelToken();

// Manually trigger token refresh (if needed by your flow)
await llmChannel.refreshDataChannelToken();

// Disconnect when done (owner is responsible for cleanup)
await llmChannel.disconnect({code: 1000, reason: 'done'});

// --- Plugin-level methods ---

// Check if data channel token feature flag is enabled
await webex.internal.llm.isDataChannelTokenEnabled();

// Get all active connections (useful for diagnostics)
webex.internal.llm.getAllConnections();

// Find a channel by datachannel URL (used by interceptors)
webex.internal.llm.getConnectionByDatachannelUrl(datachannelUrl);

// Disconnect all connections (useful for cleanup on logout)
await webex.internal.llm.disconnectAll({code: 1000, reason: 'shutdown'});
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2022 Cisco and/or its affiliates. All Rights Reserved.
