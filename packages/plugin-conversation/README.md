# SparkPlugin2

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# SparkPlugin2

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# decrypter

**Extends SparkPlugin2**

Encrypts Conversation objects

# encrypter

**Extends SparkPlugin2**

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

-   `key` **(Encryption~Key | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String))** key or keyUrl to use to encrypt
    `object[property]`
-   `property` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** name of the property to encrypt
-   `object` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** object containing `property` to be encrypted

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

# patterns

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# pick

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.

# config

!

Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
