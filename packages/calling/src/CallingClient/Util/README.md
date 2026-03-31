# CallingClient Util

## MobiusWebSocket

`MobiusWebSocket` is a small utility wrapper around the internal Mercury plugin for
basic Mobius websocket usage inside the calling client layer.

### Purpose

This class is meant to keep the Mobius websocket integration simple:

- connect to a Mobius websocket URL
- disconnect from the active session
- listen for all incoming Mercury events
- listen for a specific event type
- send a payload on the active socket

### Non-goals

This utility does not add custom websocket lifecycle behavior on top of Mercury.
Mercury already handles socket concerns such as:

- reconnect behavior
- ping/pong handling
- socket state management
- event fan-out from incoming websocket messages

### Location

`packages/calling/src/CallingClient/Util/MobiusWebSocket.ts`

### Public API

- `connectToMobius(webSocketUrl?, sessionId?)`
- `disconnectFromMobius(sessionId?)`
- `onMobiusEvent(listener, sessionId?)`
- `offMobiusEvent(listener, sessionId?)`
- `onEventType(eventType, listener, sessionId?)`
- `offEventType(eventType, listener, sessionId?)`
- `sendEvent(payload, sessionId?)`
- `isConnected(sessionId?)`

### Notes

- The default session id is `mobius-websocket-session`
- Event listeners are scoped per Mercury session
- `sendEvent()` throws if the socket is not connected

### Unit tests

Unit coverage for this utility lives in:

`packages/calling/src/CallingClient/Util/MobiusWebSocket.test.ts`

The tests validate:

- connect delegation to Mercury
- disconnect delegation to Mercury
- generic event subscription and unsubscription
- event-type subscription and unsubscription
- sending payloads on an active socket
- connection state checks
