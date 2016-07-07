# 

!

Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.

# locusEventKeys

!

Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.

# SparkHttpError

!

Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.

# alert

Alert the specified locus that the local user has been notified of the
locus's active state

**Parameters**

-   `locus` **Types~Locus** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

# create

Calls the specified invitee and offers the specified media via
options.localSdp

**Parameters**

-   `invitee` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.localSdp` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Locus>** 

# list

Lists active loci

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;[Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;Types~Locus>>** 

# get

Retrieves a single Locus

**Parameters**

-   `locus` **Types~Locus** 

Returns **Types~Locus** 

# join

Join the specified Locus and offer to send it media

**Parameters**

-   `locus` **Types~Locus** 
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.localSdp` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **Types~Locus** 

# leave

Leave the specified Locus

**Parameters**

-   `locus` **Types~Locus** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Locus>** 

# decline

Decline to join the specified Locus

**Parameters**

-   `locus` **Types~Locus** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Locus>** 

# updateMedia

Send a new sdp to Linus via the Locus API to update media state (e.g. to
start or stop sending audio or video)

**Parameters**

-   `locus` **Types~Locus** 
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.localSdp` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.mediaId` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;Types~Locus>** 

# compare

Compares two loci to determine which one contains the most recent state

**Parameters**

-   `current` **Types~Locus** 
-   `incoming` **Types~Locus** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** one of USE_INCOMING, USE_CURRENT, EQUAL, or FETCH
