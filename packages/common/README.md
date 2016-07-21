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

# check-required

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

**Parameters**

-   `keys`  
-   `object`  

# check-required

Check object for the specified keys

**Parameters**

-   `keys` **[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)>** 
-   `object` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 


-   Throws **Any** Error

Returns **[undefined](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined)** 

# isFunction

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# isFunction

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# one-flight

**Parameters**

-   `name` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `fn` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

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

# resolve-with

Sugar method for returning the desired object at the end of a promise chain

**Parameters**

-   `object` **any** the item with which to resolve the promise chain

**Examples**

```javascript
var item = {
  prop: 2
};
return Promise
 .resolve(item.prop)
 .then(resolveWith(item));
```

Returns **[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 

# resolve-with

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

**Parameters**

-   `object`  

# retry

Makes a promise-returning method retryable according to the specified backoff
pattern

**Parameters**

-   `fn` **[Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function)** 
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

return f()
  .then(tap(() => return 12)
  .then((res) => assert(res === 5);
```

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 
