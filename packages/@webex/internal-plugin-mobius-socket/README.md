# @webex/internal-plugin-mobius-socket

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Internal Mobius WebSocket plugin for Webex Calling

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our [developer api](https://developer.webex.com/) and stick to our public plugins.

- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Auth Protocol](#auth-protocol)
- [Events](#events)
- [Config Options](#config-options)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @webex/internal-plugin-mobius-socket
```

## Usage

```js
import {createMobiusSocket} from '@webex/internal-plugin-mobius-socket';

const mobiusSocket = createMobiusSocket(webex, {
  backoffTimeReset: 1000,
});

await mobiusSocket.connect('wss://mobius.example.com/ws');

if (mobiusSocket.isConnected()) {
  await mobiusSocket.send({type: 'register', deviceUrl: '...'});
}

mobiusSocket.on('event:async_event', (envelope) => {
  console.log('Received event:', envelope);
});

await mobiusSocket.disconnect();
```

## API

| Method | Signature | Description |
|---|---|---|
| `connect` | `connect(webSocketUrl?, sessionId?)` | Connect to Mobius. Falls back to device websocket URL if no URL provided. |
| `disconnect` | `disconnect(options?, sessionId?)` | Disconnect a session. `options` may include `{code, reason}`. |
| `disconnectAll` | `disconnectAll(options?)` | Disconnect all active sessions. |
| `send` | `send(payload, sessionId?)` | Send a JSON payload on the connected socket. |
| `isConnected` | `isConnected()` | Returns `true` if the plugin is connected. |
| `hasConnectedSockets` | `hasConnectedSockets(sessionId?)` | Check if a specific session socket is connected. |
| `hasConnectingSockets` | `hasConnectingSockets(sessionId?)` | Check if a specific session socket is connecting. |
| `getSocket` | `getSocket(sessionId?)` | Get the raw socket instance for a session. |
| `logout` | `logout()` | Disconnect all sockets using the configured close reason. |

## Auth Protocol

Mobius uses a token-based auth handshake:

1. Client opens WebSocket and sends: `{type: 'auth', data: {token: '<access_token>'}}`
2. Server responds with: `{type: 'response_event', subtype: 'auth', statusCode: 200}`
3. Connection is established after a successful auth `response_event`.

Non-200 status codes are handled as auth failures with automatic retry via exponential backoff.

## Events

| Event | Description |
|---|---|
| `online` | Fired when the socket connects and auth succeeds. |
| `offline` | Fired when the socket disconnects for any reason. Payload includes `{code, reason, sessionId}`. |
| `offline.transient` | Fired on a recoverable disconnect (socket will auto-reconnect). |
| `offline.permanent` | Fired on a non-recoverable disconnect. |
| `offline.replaced` | Fired when the socket is replaced (close code `4000`). |
| `event:<eventType>` | Fired for each incoming message, keyed by `data.eventType` (e.g., `event:async_event`). |
| `event:<type>` | Fired for typed messages, keyed by `type` (e.g., `event:shutdown`). |

## Config Options

### Using a Proxy Agent to Open a WebSocket Connection

For consumers who are not using the SDK via the browser it may be necessary to configure a proxy agent in order to connect and open a websocket in a proxy environment.

This can be done by configuring an agent as part of a `defaultMobiusSocketOptions` config object as shown below. The agent object will then be injected into the SDK and used during WebSocket construction as an option property, allowing a connection to be established via the specified proxy URL.

```js
const webex = require('webex');
const HttpsProxyAgent = require('https-proxy-agent');

const httpsProxyAgent = new HttpsProxyAgent(url.parse(proxyUrl));

webex.init({
  config: {
    defaultMobiusSocketOptions: {
      agent: httpsProxyAgent,
    },
  },
});
```

### Retries

Initial `connect()` attempts retry with exponential back-off and reject after a limited number of retries by default. Reconnect behavior can still be configured separately. This behavior can be adjusted with the following config params:

| Config Key | Default | Env Override | Description |
|---|---|---|---|
| `backoffTimeMax` | `32000` | `MOBIUS_SOCKET_BACKOFF_TIME_MAX` | Maximum milliseconds between connection attempts. |
| `backoffTimeReset` | `1000` | `MOBIUS_SOCKET_BACKOFF_TIME_RESET` | Initial milliseconds between connection attempts. |
| `initialConnectionMaxRetries` | `2` | `MOBIUS_SOCKET_INITIAL_CONNECTION_MAX_RETRIES` | Maximum retries before the initial `connect()` promise rejects. |
| `maxRetries` | `0` | `MOBIUS_SOCKET_MAX_RETRIES` | Maximum retries for reconnect attempts after the socket has connected once. |
| `forceCloseDelay` | `2000` | `MOBIUS_SOCKET_FORCE_CLOSE_DELAY` | Milliseconds to wait for a close frame before forcing socket closure. |
| `wssResponseTimeout` | `10000` | `MOBIUS_SOCKET_RESPONSE_TIMEOUT` | Milliseconds to wait for websocket request/response messages, including auth, before timing out. |
| `beforeLogoutOptionsCloseReason` | `done (forced)` | `MOBIUS_SOCKET_LOGOUT_REASON` | Close reason sent on logout. Set to a non-reconnectable reason to prevent reconnect on logout. |

## Contribute

PRs accepted.

## Maintainers

Cisco Webex

## License

MIT
