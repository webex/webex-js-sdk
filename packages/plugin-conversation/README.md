# muteMentions

Mutes the mentions of a conversation

**Parameters**

-   `conversation` **Conversation~ConversationObject** 
-   `activity` **Conversation~ActivityObject** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with the created activity

# muteMessages

Mutes the messages of a conversation

**Parameters**

-   `conversation` **Conversation~ConversationObject** 
-   `activity` **Conversation~ActivityObject** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with the created activity

# removeAllMuteTags

Removes all mute-related tags

**Parameters**

-   `conversation` **Conversation~ConversationObject** 
-   `activity` **Conversation~ActivityObject** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with the created activity

# unmuteMentions

Mutes the mentions of a conversation

**Parameters**

-   `conversation` **Conversation~ConversationObject** 
-   `activity` **Conversation~ActivityObject** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with the created activity

# unmuteMessages

Mutes the messages of a conversation

**Parameters**

-   `conversation` **Conversation~ConversationObject** 
-   `activity` **Conversation~ActivityObject** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with the created activity

# Decrypter

Encrypts Conversation objects

# Encrypter

Encrypts Conversation objects

# encryptObject

Encrypts an Object

**Parameters**

-   `key` **(Encryption~Key | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** [Encryption~Key](Encryption~Key) or keyUrl to encrypt the object (not required
    if `object.objectType === 'conversation'`)
-   `object` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** object to encrypt. Must include an objectType
    property

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

# encryptProperty

Encrypts a property of an object

**Parameters**

-   `property` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** name of the property to encrypt
-   `key` **(Encryption~Key | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** key or keyUrl to use to encrypt
    `object[property]`
-   `object` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** object containing `property` to be encrypted

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

# computeDimensions

Determins the dimensions of an image

**Parameters**

-   `constraints` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `constraints.width` **[Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 
    -   `constraints.height` **[Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 
-   `$0` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `$0.width`  
    -   `$0.height`  
-   `maxWidth` **[Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 
-   `maxHeight` **[Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 

Returns **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

# process-image.browser

Measures an image file and produces a thumbnail for it

**Parameters**

-   `file` **([Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) \| [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer))** 
-   `thumbnailMaxWidth` **[Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 
-   `thumbnailMaxHeight` **[Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)>** Buffer, Dimensions, thumbnailDimensions

# interceptor

**Extends Interceptor**

Encrypts, Normalizes, and Decrypts conversation service payloads

# onRequest

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)>** 

# onResponse

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `response` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)>** 

# shouldDecrypt

Determines if the specified response contains encrypted values

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `response` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)>** 

# create

Returns **EncryptionInterceptor** 
