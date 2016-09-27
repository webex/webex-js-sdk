# AvatarUrlBatcher

# retrieveAvatarUrl

Retrieves an Avatar from a cache or the api on misses.

Avatars are square images with sides of 1600, 640, 192, 135, 110, 80, 50,
or 40 pixels. If no size is specified, 80px will be retrieved. If a
non-standard size is requested, the server will return the closest-but-
greater size (or 1600 if request is larger).

**Parameters**

-   `user` **(UserObject | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** The user, Spark user uuid, or email
-   `options` **\[[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)]** 
    -   `options.size` **\[integer]** In {1600, 640, 192, 135, 110, 80, 50, 40}
                                        Defaults to 80 if falsy

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)>** A promise that resolves to the avatar

# setAvatar

Upload a new avatar for the current user

**Parameters**

-   `file` **([Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) | File | [Buffer](https://nodejs.org/api/buffer.html))** The new avatar

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with the URL of the full-sized avatar

# handleHttpSuccess

Munge the response into items that can be uniquely
identified by uuid + size and process success or failures

**Parameters**

-   `res` **HttpResponseObject** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

# didItemFail

Item must have a response. Warn if avatar service changed request size

**Parameters**

-   `item` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)>** 

# handleItemSuccess

Copy response url into item to keep response object opaque later

**Parameters**

-   `item` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)>** 

# fingerprintRequest

Fingerprint each request's defered promise. The avatar API requires a
user uuid and size getting an avatar, and each get eventually calls
this method. Thus the request fingerprint is uuid + size.

**Parameters**

-   `item` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** the request params
    -   `item.uuid` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The uuid of the requested contact
    -   `item.size` **integer** the size of the requested avatar URL

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)>** 

# fingerprintResponse

Fingerprint each item in an avatar response. This finger print is expected
to match to a request fingerprint so that the defered request promise
can be resolved. handleHTTPSuccess guarentees the item passed here will be
comparable to the original request item

**Parameters**

-   `item` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `item.uuid` **striing** 
    -   `item.size` **integer** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)>** 

# submitHttpRequest

**Parameters**

-   `payload` **[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)** array of {uuid, sizes\[]} request objects

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;HttpResponseObject>** 

# urlByUuid

&lt;uuid+size, {uuid, size, url}> map

# AvatarUrlStore

## constructor

## get

Get the URL associated with the given uuid and size.

**Parameters**

-   `item` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `item.uuid` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** A user uuid
    -   `item.size` **integer** the requested size

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** resolves to the URL or rejects if not mapped

## add

Adds the given item to the store

**Parameters**

-   `item` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `item.uuid` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
    -   `item.size` **integer** 
    -   `item.url` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;item>** 

## remove

Remove the URL associated with the uuid and size
Remove urls of all sizes if size is not given

**Parameters**

-   `item` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `item.uuid` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The user unique id
    -   `item.size` **integer** The size of the avatar to remove

Returns **[boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** true

# cacheExpiration

Milliseconds a cached avatar url is considered valid

# defaultAvatarSize

default avatar size to retrieve if no size is specified
