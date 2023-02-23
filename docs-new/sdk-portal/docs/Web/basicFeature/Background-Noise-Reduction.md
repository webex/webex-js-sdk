## Introduction

BNR, which is expanded as Background Noise Reduction is one of the features that users / customers had been expecting for long time in the Web SDK. This is now a feature complete and is available on the latest versions of Webex JS SDK. This documentation is a walkthrough on how to use the feature at its best.

## Pre-requisites

To enable BNR on your meeting, you need to have the following pre-requisites. The meeting,

- Should be created & joined
- Should have attached media tracks (particularly audio)
- Should not be in mute

With the above pre-requisites, please ensure the SDK version is `webex-js-sdk@2.19.1` or above.

## APIs

To know about all the other APIs in the Webex JS SDK, please visit → [https://webex.github.io/webex-js-sdk/api/](https://webex.github.io/webex-js-sdk/api/)

As for this feature, the usage is pretty simple. We have the following APIs,

- Enable BNR
- Disable BNR
- Is BNR Enabled?

### Enable BNR

With all the above said pre-requisites, the only and easiest way to enable BNR is to access this API via the meeting object as mentioned below,

```js
 meeting.enableBNR();
```

|        |       |
| ------------- | ------------- |
| **Asynchronous**  | Yes  |
| **Parameters**  | No parameters required |
| **Returns**  | A promise that gets resolved to a boolean (true / false) |

When a call is made to this API and if it resolves to get true, it means that BNR is enabled on the meeting and all the background noises should be reduced. As simple as that.

### Disable BNR
In order to disable BNR on your meeting, the only and easiest way is to access this API via the same meeting object as mentioned below,

```js
meeting.disableBNR();
```

|        |       |
| ------------- | ------------- |
| **Asynchronous**  | Yes  |
| **Parameters**  | No parameters required |
| **Returns**  | A promise that gets resolved to a boolean (true / false) |

When a call is made to this API and if it gets resolved to get true, it means that BNR is disabled on the meeting and the raw audio is heard by other members in the meeting. One of the additional pre-requisites for this API is to have BNR enabled. (i.e) if the meeting is not enabled with BNR already, disable BNR cannot be called and error will be thrown. 

Now, how to know if BNR is enabled already? Read on.

### Is BNR Enabled?
This API tells the user if BNR is already enabled on the meeting. This might come in handy in many cases and one of the known use cases for this method is whether to call meeting.disableBNR() or not.
```js
meeting.isBnrEnabled();
```

|        |       |
| ------------- | ------------- |
| **Asynchronous**  | No  |
| **Parameters**  | No parameters required |
| **Returns**  | A boolean (true / false) |

It can be used as follows,
```js
if(meeting.isBnrEnabled()){
    meeting.disableBNR();
}
```

This API can also be used for many UI use cases,
- Show a toggle button
```html
<button>${meeting.isBnrEnabled() ? "Disable BNR" : "Enable BNR"}</button>
```
- Keep a disableBNR button in disabled state
```html
<button disabled=`${meeting.isBnrEnabled()}`>Disable BNR</button>
```
And the use cases could keep going this way.

## Demo

Please watch Vidcast Demo here for happy path on the [Kitchen Sink sample](https://webex.github.io/webex-js-sdk/samples/browser-plugin-meetings/) → https://app.vidcast.io/share/3f440def-3f7d-4eb1-83f2-7f3bd39208c3

## Possible errors

The possible errors that one could get from the BNR APIs are listed below,

| API | Error | How to fix? |
| ------------- | ------------- | ------------- |
| **enableBNR**  | Meeting doesn't have an audioTrack attached | Make call to **meeting.getMediaStreams()** and then **meeting.addMedia()** which will attach the audio to the meeting |
| **enableBNR**  | Cannot enable BNR while meeting is muted | Make call to **meeting.unmuteAudio()**. Straight forward |
| **enableBNR**  | BNR is enabled on the track already | This error is thrown when enableBNR is passed on with a track that was already returned from it |
| **enableBNR**  | Sample rate is not supported | This error comes from the brain of BNR which right now supports only track with sample rate, 16000, 32000 (or) 48000 |
|   |   |  |
| **disableBNR**  | Can not disable as BNR is not enabled | Please ensure that BNR is enabled before calling disableBNR. Refer to [Is BNR Enabled?](https://github.com/webex/webex-js-sdk/wiki/Background-Noise-Reduction-(BNR)-in-Web-SDK#is-bnr-enabled) section for more information |
| **disableBNR**  | Meeting doesn't have an audioTrack attached	| Make call to **meeting.getMediaStreams()** and then **meeting.addMedia()** which will attach the audio to the meeting |