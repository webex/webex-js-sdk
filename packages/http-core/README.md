# isString

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# isNumber

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# ProgressEvent

Object of the same shape as web browser ProgressEvents

**Parameters**

-   `loaded` **integer** 
-   `total` **integer** 

Returns **[ProgressEvent](https://developer.mozilla.org/en-US/docs/Web/API/ProgressEvent)** 

# interceptor

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# interceptor

# constructor

**Parameters**

-   `attrs` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **UrlInterceptor** 

# onRequest

Transform request options before sending them

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)>** 

# onRequestError

Handle request failures

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `reason` **[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)** 

Returns **RejectedPromise&lt;[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)>** 

# onResponse

Transform response before returning it

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `response` **HttpResponse** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;HttpResponse>** 

# onResponseError

Handle response errors

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `reason` **SparkHttpError** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;SparkHttpError>** 

# create

Returns **Interceptor** 

# extendError

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# extendError

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# HttpError

**Extends Error**

# HttpError

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# http-error-subtypes

**Parameters**

-   `Base` **[Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)** 

Returns **[undefined](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined)** 

# http-status

**Extends Interceptor**

# constructor

**Parameters**

-   `spark` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **HttpStatusInterceptor** 

# onResponse

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `response` **HttpResponse** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

# create

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **HttpStatusInterceptor** 

# fileType

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# detect

Determine mimeType for the specified buffer;

**Parameters**

-   `buffer` **[Buffer](https://nodejs.org/api/buffer.html)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)>** 

# detectSync

Synchronous implementation of [detect](#detect)

**Parameters**

-   `buffer` **[Buffer](https://nodejs.org/api/buffer.html)** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

# \_request

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# index

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

# pick

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# request

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 
