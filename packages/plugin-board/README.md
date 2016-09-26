# addContent

Adds Content to a Channel
If contents length is greater than MAX_ALLOWED_INPUT_SIZE, this method
will break contents into chunks and make multiple GET request to the
board service

**Parameters**

-   `conversation` **Conversation** Contains the currently selected conversation
-   `channel` **Board~Channel** 
-   `contents` **[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)** Array of [Board~Content](Board~Content) objects

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Board~Content>** 

# addImage

Adds Image to a Channel
Uploads image to spark files and adds SCR + downalodUrl to the persistence
service

**Parameters**

-   `conversation` **Conversation** Contains the currently selected conversation
-   `channel` **Board~Channel** 
-   `image` **File** image to be uploaded

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Board~Content>** 

# createChannel

Creates a Channel

**Parameters**

-   `channel` **Board~Channel** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Board~Channel>** 

# decryptContents

Decrypts a collection of content objects

**Parameters**

-   `contents` **[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)** curves, text, and images

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)>** Resolves with an array of [Board~Content](Board~Content) objects.

# decryptSingleContent

Decryts a single STRING content object

**Parameters**

-   `encryptedData` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `encryptionKeyUrl` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Board~Content>** 

# decryptSingleFileContent

Decryts a single FILE content object

**Parameters**

-   `encryptedData` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `encryptionKeyUrl` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Board~Content>** 

# deleteAllContent

Deletes all Content from a Channel

**Parameters**

-   `channel` **Board~Channel** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with an content response

# deleteContent

Deletes a specified Content from a Channel

**Parameters**

-   `channel` **Board~Channel** 
-   `content` **Board~Content** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** Resolves with an content response

# encryptContents

Encrypts a collection of content

**Parameters**

-   `encryptionKeyUrl` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** conversation.defaultActivityEncryptionKeyUrl
-   `contents` **[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)** Array of [Board~Content](Board~Content) objects. (curves, text, and images)

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)>** Resolves with an array of encrypted [Board~Content](Board~Content) objects.

# encryptSingleContent

Encrypts a single STRING content object

**Parameters**

-   `encryptionKeyUrl` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `content` **Board~Content** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Board~Content>** 

# encryptSingleFileContent

Encrypts a single FILE content object

**Parameters**

-   `encryptionKeyUrl` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `content` **Board~Content** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Board~Content>** 

# getAllContent

Gets all Content from a Channel
It will make multiple GET requests if contents length are greater than
MAX_ALLOW_INPUT_SIZE, the number is currently determined and hard-coded
by the backend

**Parameters**

-   `channel` **Board~Channel** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)>** Resolves with an Array of [Board~Content](Board~Content) objects.

# getChannel

Gets a Channel

**Parameters**

-   `channel` **Board~Channel** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Board~Channel>** 

# ping

Pings persistence

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)>** ping response body

# register

Registers with Mercury

**Parameters**

-   `data` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** Mercury bindings

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Board~Registration>** 

# RealtimeService

**Extends **

## publish

Sends the message via the socket. Assumes that the message is already properly formatted

**Parameters**

-   `conversation` **Conversation** 
-   `message` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** Contains the un-encrypted message to send.

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Board~Content>** 

## publishEncrypted

Sends the message via the socket. The message should already have been
encrypted

**Parameters**

-   `encryptionKeyUrl` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `encryptedData` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `contentType` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** provides hint for decryption. Defaults to
    `STRING`, and could also be `FILE`

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Board~Content>** 
