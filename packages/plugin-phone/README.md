# Call

**Extends SparkPlugin**

## localMediaStream

Returns the local MediaStream for the call. May initially be `null`
between the time @{Phone#dial is invoked and the  media stream is
acquired if [Phone#dial](#phonedial) is invoked without a `localMediaStream`
option.

This property can also be set mid-call in which case the streams sent to
the remote party are replaced by this stream. On success, the
[Call](#call)'s <localMediaStream:change> event fires, notifying any
listeners that we are now sending media from a new source.

## localMediaStreamUrl

Object URL that refers to [Call#localMediaStream](#calllocalmediastream). Will be
automatically deallocated when the call ends

## remoteMediaStream

Access to the remote party’s `MediaStream`. `null` before connected.

## remoteMediaStreamUrl

Object URL that refers to [Call#remoteMediaStream](#callremotemediastream). Will be
automatically deallocated when the call ends

## sendingAudio

Indicates if the client is sending audio

## sendingVideo

Indicates if the client is sending video

## receivingAudio

Indicates if the client is receiving audio

## receivingVideo

Indicates if the client is receiving video

## status

<b>initiated</b> - Offer was sent to remote party but they have not yet accepted <br>
<b>ringing</b> - Remote party has acknowledged the call <br>
<b>connected</b> - At least one party is still on the call <br>
<b>disconnected</b> - All parties have dropped <br>

## answer

Answers an incoming call. Only applies to incoming calls. Invoking this
method on an outgoing call is a noop

**Parameters**

-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.constraints` **MediaStreamConstraints** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## acknowledge

Use to acknowledge (without answering) an incoming call. Will cause the
initiator's Call instance to emit the ringing event.

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## hangup

Disconnects the active call. Applies to both incoming and outgoing calls.
This method may be invoked in any call state and the SDK should take care
to tear down the call and free up all resources regardless of the state.

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## decline

Alias of [Call#reject](Call#reject)

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## oneFlight

Rejects an incoming call. Only applies to incoming calls. Invoking this
method on an outgoing call is a no-op.

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## startSendingAudio

Starts sending audio to the Cisco Spark Cloud

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## startSendingVideo

Starts sending video to the Cisco Spark Cloud

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## toggleReceivingAudio

Toggles receiving audio to the Cisco Spark Cloud

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## toggleReceivingVideo

Toggles receiving video to the Cisco Spark Cloud

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## toggleSendingAudio

Toggles sending audio to the Cisco Spark Cloud

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## toggleSendingVideo

Toggles sending video to the Cisco Spark Cloud

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## sendFeedback

Sends feedback about the call to the Cisco Spark cloud

**Parameters**

-   `feedback` **[Types~Feedback](#typesfeedback)** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## stopSendingAudio

Stops sending audio to the Cisco Spark Cloud. (stops broadcast immediately,
even if renegotiation has not completed)

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## stopSendingVideo

Stops sending video to the Cisco Spark Cloud. (stops broadcast immediately,
even if renegotiation has not completed)

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

# Types~Feedback

Payload for [Call#sendFeedback](#callsendfeedback)

**Properties**

-   `userRating` **[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number)** Number between 1 and 5 (5 being best) to let
    the user score the call
-   `userComments` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** Freeform feedback from the user about the
    call
-   `includeLogs` **[Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** set to true to submit client logs to the
    Cisco Spark cloud. Note: at this time, all logs, not just call logs,
    generated by the sdk will be uploaded to the Spark Cloud. Care has been taken
    to avoid including PII in these logs, but if you've taken advantage of the
    SDK's logger, you should make sure to avoid logging PII as well.

# mediaDirection

Indicates the direction of the specified media type for the specified
participant

**Parameters**

-   `mediaType` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `participant` **Types~LocusParticipant** 

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** One of `sendonly`, `recvonly`, `sendrecv`, or `inactive`

# Phone

**Extends SparkPlugin**

## connected

connected Indicates whether or not the WebSocket is connected

## registered

indicates whether or not the client is registered with the Cisco Spark
cloud

## register

Registers the client with the Cisco Spark cloud and starts listening for
WebSocket events.

Subsequent calls refresh the device registration.

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## deregister

Disconnects from WebSocket and unregisters from the Cisco Spark cloud.

Subsequent calls will be a noop.

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)** 

## createLocalMediaStream

Create a MediaStream to be used for video preview.

Note: You must explicitly pass the resultant stream to [Call#answer()](Call#answer())
or [Phone#dial()](Phone#dial())

**Parameters**

-   `options` **([Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object) | MediaStreamConstraints)** 
    -   `options.constraints` **MediaStreamConstraints** 

Returns **[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)&lt;MediaStream>** 

## \_onLocusEvent

Determines if the <call:incoming> event should be emitted for the
specifed [Types~MercuryEvent](Types~MercuryEvent)

**Parameters**

-   `event` **Types~MercuryEvent** 

Returns **[undefined](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined)** 

## dial

Place a call to the specified dialString. A dial string may be an email
address or sip uri.

**Parameters**

-   `dialString` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `options` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
    -   `options.constraints` **MediaStreamConstraints** 
    -   `options.localMediaStream` **MediaStream** if no stream is specified, a
        new one will be created based on options.constraints

Returns **[Call](#call)** 
