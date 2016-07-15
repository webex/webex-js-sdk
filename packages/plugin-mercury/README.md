# 

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# SparkPlugin

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# default

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# Socket

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

## constructor

constructor

Returns **[Socket](#socket)** 

## binaryType

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

## bufferedAmount

Returns **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 

## extensions

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

## protocol

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

## readyState

Returns **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 

## url

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

## close

Closes the socket

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.reason` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
    -   `options.code` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## open

Opens a WebSocket

**Parameters**

-   `url` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `options` **options** 
    -   `options.forceCloseDelay` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** (required)
    -   `options.pingInterval` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** (required)
    -   `options.pongTimeout` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** (required)
    -   `options.token` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** (required)
    -   `options.trackingId` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** (required)
    -   `options.logger` **Logger** (required)
    -   `options.logLevelToken` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## onclose

Handles incoming CloseEvents

**Parameters**

-   `event` **[CloseEvent](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent)** 

Returns **[undefined](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined)** 

## onmessage

Handles incoming message events

**Parameters**

-   `event` **[MessageEvent](https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent)** 

Returns **[undefined](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined)** 

## send

Sends a message up the socket

**Parameters**

-   `data` **mixed** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## \_acknowledge

Sends an acknowledgment for a specific event

**Parameters**

-   `event` **[MessageEvent](https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## getWebSocketConstructor

Provides the environmentally appropriate constructor (ws in NodeJS,
WebSocket in browsers)

Returns **[WebSocket](https://developer.mozilla.org/en-US/docs/WebSockets)** 

# EventEmitter

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# socket-base

**Extends EventEmitter**

Generalized socket abstraction

# config

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# pingInterval

Milliseconds between pings sent up the socket

# pongTimeout

Milliseconds to wait for a pong before declaring the connection dead

# backoffTimeMax

Maximum milliseconds between connection attempts

# backoffTimeReset

Initial milliseconds between connection attempts

# forceCloseDelay

Milliseconds to wait for a close frame before declaring the socket dead and
discarding it

# extendError

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
