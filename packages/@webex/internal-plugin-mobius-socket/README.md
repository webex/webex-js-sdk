# @webex/internal-plugin-mercury

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Plugin for the Mercury service

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our [developer api](https://developer.webex.com/) and stick to our public plugins.

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @webex/internal-plugin-mercury
```

## Usage

```js
import '@webex/internal-plugin-mercury';

import WebexCore from '@webex/webex-core';

const webex = new WebexCore();
webex.internal.mercury.WHATEVER;
```

### Multiple Connections

Mercury now supports multiple simultaneous websocket connections scoped by `sessionId`.

```js
const mercury = webex.internal.mercury;

// Default session
await mercury.connect();

// Additional session
await mercury.connect(undefined, 'secondary-session');

// Disconnect only one session
await mercury.disconnect(undefined, 'secondary-session');

// Disconnect everything
await mercury.disconnectAll();
```

#### Listening to multiple connections

```js
const mercury = webex.internal.mercury;
const secondarySessionId = 'secondary-session';

// Connect both sessions first.
await mercury.connect();
await mercury.connect(undefined, secondarySessionId);

// Default session listeners use the base event name.
mercury.on('online', () => {
  console.log('[default] online');
});

mercury.on('event:conversation.activity', (envelope) => {
  console.log('[default] activity', envelope.data?.eventType);
});

// Non-default sessions use :<sessionId> suffix.
mercury.on(`online:${secondarySessionId}`, () => {
  console.log(`[${secondarySessionId}] online`);
});

mercury.on(`event:conversation.activity:${secondarySessionId}`, (envelope) => {
  console.log(`[${secondarySessionId}] activity`, envelope.data?.eventType);
});
```

Notes:
- `connect(webSocketUrl, sessionId)` and `disconnect(options, sessionId)` are session-aware.
- Non-default sessions emit events with a `:<sessionId>` suffix (for example, `online:secondary-session`).
- `getSocket(sessionId)` returns the socket for a specific session.

## Config Options

### Using A Proxy Agent To Open A Websocket Connection

For consumers who are not using the SDK via the browser it may be necessary to configure a proxy agent in order to connect with Mercury and open a Websocket in a proxy environment.

This can be done by configuring an agent as part of a DefaultMercuryOptions config object as shown below. The agent object will then be injected into the SDK and used in the Mercury plugin during WebSocket construction as an option property, allowing a connection to be established via the specified proxy url.

```js
const webex = require(`webex`);
const HttpsProxyAgent = require('https-proxy-agent');

let httpsProxyAgent = new HttpsProxyAgent(url.parse(proxyUrl));

webex.init({
	config: {
	  defaultMercuryOptions: {
		agent: httpsProxyAgent
	  },
	 ...
	}
});
```

### Retries


The default behaviour is for Mercury to continue to try to connect with an exponential back-off. This behavior can be adjusted with the following config params:

- `maxRetries` - the number of times it will retry before error. Default: 0
- `initialConnectionMaxRetries` - the number of times it will retry before error on the first connection. Once a connection has been established, any further connection attempts will use `maxRetries`. Default: 0
- `backoffTimeMax` - The maximum time between connection attempts in ms. Default: 32000
- `backoffTimeReset` - The time before the first retry in ms. Default: 1000


## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
