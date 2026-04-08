# CallingClient Util Agent Spec

This document is the source-of-truth spec for recreating the Mobius websocket utility in the calling package.

The goal is to regenerate the same implementation shape, public API, and unit tests found in this folder without adding broader product behavior.

## Scope

Implement a minimal `MobiusWebSocket` utility for the calling package that:

- extends Mercury directly
- connects to a Mobius websocket URL through Mercury
- disconnects a Mobius websocket session through Mercury
- sends a payload on the active socket
- exposes a simple `isConnected()` helper

Do not add reconnection logic, ping/pong handling, host-catalog overrides, registration logic, or sample-app code. Mercury already owns those concerns.

## Files To Generate

Create exactly these files and exports:

1. `packages/calling/src/CallingClient/Util/MobiusWebSocket.ts`
2. `packages/calling/src/CallingClient/Util/MobiusWebSocket.test.ts`

Include the direct `@webex/internal-plugin-mercury` dependency in `packages/calling/package.json`.

## Implementation Requirements

### `MobiusWebSocket.ts`

Export this constant:

```ts
export const DEFAULT_MOBIUS_WEBSOCKET_SESSION = 'mobius-websocket-session';
```

Implement a default-exported class:

```ts
export default class MobiusWebSocket
```

Constructor requirements:

- extend Mercury directly
- use the single internal constant `DEFAULT_MOBIUS_WEBSOCKET_SESSION`
- do not accept or expose custom session ids
- allow the existing Mercury/WebexPlugin `{parent: this.webex.internal}` construction path

Required methods:

```ts
connect(webSocketUrl?: string): Promise<void>
disconnect(): Promise<void>
send(payload: string | Record<string, unknown>): Promise<void>
isConnected(): boolean
```

Required behavior:

- `connect()` delegates to `super.connect(webSocketUrl, DEFAULT_MOBIUS_WEBSOCKET_SESSION)`
- `disconnect()` delegates to `super.disconnect(undefined, DEFAULT_MOBIUS_WEBSOCKET_SESSION)`
- consumers use inherited Mercury `on()` / `off()` directly for event subscriptions
- consumers use event names like `'event'` and `'event:mobius.call'`
- `send()` must:
  - read the socket with `this.getSocket(DEFAULT_MOBIUS_WEBSOCKET_SESSION)`
  - throw when the socket is missing or not connected
  - throw this exact message:
    - `Mobius socket is not connected for session mobius-websocket-session`
  - otherwise return `socket.send(payload)`
- `isConnected()` returns a boolean using `this.getSocket(DEFAULT_MOBIUS_WEBSOCKET_SESSION)?.connected`

Implementation style requirements:

- use inheritance, not composition
- import Mercury directly
- keep the file intentionally small and focused
- keep the existing short doc comments

## Unit Test Requirements

Create `MobiusWebSocket.test.ts` with Jest tests that validate the wrapper behavior only.

Mock the direct Mercury module import in the test file.

The test suite must cover exactly these behaviors:

1. connects through Mercury
2. disconnects through Mercury
3. uses inherited Mercury on/off methods directly for event subscriptions
4. sends payload on the active connected socket
5. throws when sending without an active connected socket
6. reports socket connection state for the default session

Important test details:

- use `DEFAULT_MOBIUS_WEBSOCKET_SESSION`
- keep `sockets` as a `Map`
- verify direct Mercury event usage with `'event'`
- verify the exact thrown error string:
  - `Mobius socket is not connected for session mobius-websocket-session`

## Expected Usage

The intended usage is:

```ts
const mobiusWebSocket = new MobiusWebSocket({}, {
  parent: webex.internal,
});

await mobiusWebSocket.connect('wss://mobius.example.com/socket');
mobiusWebSocket.on('event:mobius.call', listener);
await mobiusWebSocket.send({type: 'ack'});
```

This utility is a thin Mercury-based helper that binds one session id per `MobiusWebSocket` instance.

## Verification

After generating the files, verify with:

```bash
yarn workspace @webex/calling build
yarn workspace @webex/calling jest --config=jest.config.js --runInBand src/CallingClient/utils/MobiusWebSocket.test.ts --coverage=false
```

Both commands must pass with the direct Mercury package dependency present in `@webex/calling`.
