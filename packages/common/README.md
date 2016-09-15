# default

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# atob

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# fromBase64url

**Parameters**

-   `str` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

# toBase64Url

Converts a string to a base64url-encoded string

**Parameters**

-   `str` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

# encode

Converts a string to a base64url-encoded string

**Parameters**

-   `str` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

# decode

Converts a string from a base64url-encoded string

**Parameters**

-   `str` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

# atob.shim

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# btoa.shim

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# capped-debounce

Behaves like debounce, but additionally executes after a number of calls are
attempted, rather than just time

**Parameters**

-   `fn` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 
-   `wait` **[Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

# check-required

Check object for the specified keys

**Parameters**

-   `keys` **[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)>** 
-   `object` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 


-   Throws **Any** Error

Returns **[undefined](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined)** 

# check-required

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

**Parameters**

-   `keys`  
-   `object`  

# defer

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# defer

Creates a new `Defer`red object,

Returns **Defer** 

# resolve

# reject

# make-state-datatype

Creates an ampersand state object that wires its event handlers like a an
ampersand child

**Parameters**

-   `Constructor` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 
-   `name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

Returns **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

# make-state-datatype

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

**Parameters**

-   `Constructor`  
-   `name`  

# test

This is a really unfortunate hack to deal with ampersand\`s decision to
make the dateType#set function pure. The only function called with the
scope of the parent at set time seems to be test

**Parameters**

-   `newVal` **AmpersandState** 

Returns **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 

# make

Factory which produces a multi-keyed container based on the provided set of
constructors

**Parameters**

-   `containers` **mixed** 

Returns **[Container](#container)** 

# Container

Container that wraps an arbitrary set of tupples to their values

## constructor

**Parameters**

-   `args` **...Any** 

## size

getter for .size

Returns **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 

## add

Identical to Container#set() but leads slightly more intuitive code when
the container is based on a Set rather than a Map.

**Parameters**

-   `args` **...Any** 

Returns **[Container](#container)** 

## clear

Removes all items from the container

Returns **[undefined](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined)** 

## delete

Removes the specified item to the container

**Parameters**

-   `key` **mixed** 
-   `keys` **[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;mixed>** 

Returns **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 

## get

Retrieves the specified item from the container

**Parameters**

-   `key` **mixed** 
-   `keys` **[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;mixed>** 

Returns **mixed** 

## has

Indicates whether the container holds the specified item

**Parameters**

-   `key` **mixed** 
-   `keys` **[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;mixed>** 
-   `args` **...Any** 

Returns **[Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 

## set

Stores the specified item in the container

**Parameters**

-   `key` **mixed** 
-   `args` **[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;mixed>** 
-   `value` **mixed** 

Returns **[Container](#container)** 

# wrap

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# wrap

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# one-flight

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.keyFactory` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 
    -   `options.cacheFailures` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 
    -   `options.cacheSuccesses` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 
-   `params` **...Any** 

Returns **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

# patterns

Set of regex patterns to compile once and use throughout the
app. All non-prefixed patterns have start/end characters to ensure exact
matches. Patterns prefixed with "exec" are the same as their non-prefixed
counterparts but without the start/end characters so they can be used with
methods like `RegExp#exec`.

# email

Matches an email address by requiring an @ and excluding spaces

# uuid

Matches a UUID

# execEmail

Same as this.email, but allows for surrounding characters

# execUuid

Same as this.uuid but allows for surrounding characters

# isArray

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# proxyEvents

Proxies the event binding methods of emitter onto proxy

**Parameters**

-   `emitter` **(EventEmitter | EventEmitterProxy)** 
-   `proxy` **mixed** (probably a promise)

Returns **EventEmitter** Returns the source emitter to ease use in promise chains

# transferEvents

Given a list of events, fires them on drain when they're emitted from source

**Parameters**

-   `events` **([Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) \| [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** 
-   `source` **EventEmitter** 
-   `drain` **EventEmitter** 

Returns **[undefined](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined)** 

# emit

Emits an event

**Parameters**

-   `target` **EventEmitter** The EventEmitter from which to emit an event
-   `rest` **...Any** 

Returns **mixed** 

# resolve-with

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

**Parameters**

-   `object`  

# resolve-with

Sugar method for returning the desired object at the end of a promise chain

**Parameters**

-   `object` **any** the item with which to resolve the promise chain

**Examples**

```javascript
var item = {
  prop: 2
};
Promise
 .resolve(item.prop)
 .then(resolveWith(item))
 .then(function(res) {
   require('assert').deepEqual(res, {prop:2});
   return 'success'
 })
 // => success
```

Returns **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

# retry

Makes a promise-returning method retryable according to the specified backoff
pattern

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.backoff` **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** 
    -   `options.delay` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 
    -   `options.initialDelay` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 
    -   `options.maxAttempts` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 
    -   `options.maxDelay` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 

Returns **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

# tap

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

**Parameters**

-   `fn`  

# tap

Injects code into a promise chain without modifying the promise chain's result

**Parameters**

-   `fn` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

**Examples**

```javascript
function f() {
  return Promise.resolve(5);
}

f()
  .then(tap(() => 12))
  // => 5
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 
