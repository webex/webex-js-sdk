# Introduction

Webex Meeting Center today has three distinct meeting experiences: Personal Meeting Room (PMR), Scheduled Meetings, and Space Meetings. Each of these meeting types has distinct experiences, USM is to consolidate the experiences of Space Meetings with Scheduled Meetings and meld together the experiences. Get the single meetings experience in Webex App.

This document explains how to enable USM, how to start an Ad-hoc meeting and also the complete flow for password and captcha support when using Unified Space Meetings is enabled.

# What is an Ad-hoc space meeting?

In Webex, the meetings can be broadly classified as below,

1. Webex Meetings
    1. **Scheduled Webex Meetings** - In this, the meeting gets created first and then the meeting information like Meeting ID, passcode & unique meeting link is sent to the
invitees
    2. **PMR (personal meeting room) (aka instant meeting)** - This is a meeting with static URL which can be attached to a meeting schedule as well as sent out as a message for anyone to join
2. Space Meetings 
    1. **Scheduled Space Meetings** - In this, the meeting gets created first and then the meeting information like Meeting ID, passcode & meeting link is available to the members of the space in Webex
    2. **Ad-hoc Space Meetings** - This type of meeting can be started from a team space, where the meeting gets started instantly without any pre-scheduled meeting links. Although these meetings are instant and does not have a meeting ID / URL at the time of starting, Webex creates a meeting ID & URL for it which can be obtained via the Meeting Info API.

This document is about Ad-hoc space meeting or the Instant space meeting. 

# Prerequisites for USM

There is only one primary prerequisite. The Unified meetings should be enabled.

## How to know if Unified Meetings is enabled?
The Web SDK has the following configuration, which should be true if the unified meetings are enabled.

```
webex.meetings.config.experimental.enableUnifiedMeetings
```

## How to enable Unified Meetings if disabled?
Invoke the following function, which would toggle Unified Meetings on / off.

```
webex.meetings._toggleUnifiedMeetings(changeState);
```
|        |       |
| ------------- | ------------- |
| **Asynchronous**  | No  |
| **Parameters**  | changeState<Boolean (true / false)> |
| **Returns**  | undefined |

We can also add the config by toggling below values
```
Meetings :{
 experimental: {
      enableUnifiedMeetings: false,
      enableAdhocMeetings: false
    }
  }
```


# How to create an Ad-hoc space meeting?
An Ad-hoc space meeting in SDK can be created with the help of Hydra ID or the Room ID. The Room ID can be obtained using the Room APIs for Webex → https://developer.webex.com/docs/api/v1/rooms/list-rooms

A typical room object would look like below JSON,
```
{
        "id": "Y2lzY29zcGFyazovL3VzL1JPT00vYzVlNjgxODAtMDkxMy0xMWVkLWFmZjQtYTc5YzYwNWU1MEKl",
        "title": "Ask Web SDK",
        "type": "group",
        "isLocked": false,
        "lastActivity": "2022-08-25T07:30:18.466Z",
        "creatorId": "Y2lzY29zcGFyazovL3VzL1BFT1BMRS8zNDRlYTE4My05ZDVkLTRlNzctYWVkMi1jNGYwMDRhZmR6NUV",
        "created": "2022-07-21T16:40:04.760Z",
        "ownerId": "Y2lzY29zcGFyazovL3VzL09SR0FOSVpBVElPTi8xZWI2NWZkZi05NjQzLTQxN2YtOTk3NC1hZDcyY2FlMGVyNHZ",
        "isPublic": false
}
```
In this, the id field is the Room ID / Hydra ID. This room ID can be used to create a meeting as mentioned below
```
webex.meetings.create(ROOMID);
```
|        |       |
| ------------- | ------------- |
| **Asynchronous**  | Yes  |
| **Mandatory Parameters**  | Destination |
| **Returns**  | A promise that gets resolved to give a Meeting object |

# How to join a running Ad-hoc space meeting?
When an Ad-hoc meeting is already started by someone, Webex creates a meeting for that and appropriate meeting ID / URL is generated, which then can be shared to others who could join through that meeting information.

From SDK, the meeting information is available in the Meetings object as mentioned below,
```
meeting.meetingInfo
```

These can be tested out from our public [Kitchen Sink app](https://webex.github.io/webex-js-sdk/samples/browser-plugin-meetings/).


# Password and Captcha Support for USM
As mentioned earlier, one primary prerequisite is unified meetings should be enabled. Please check how to enable unified meeting above.

In USM, For scheduled Webex meeting, it will require a password only if you are not part of the space.


## Basic Flow
Flow will be same for Password and Captcha in scheduled space meeting as well as in instant meetings (Ad-hoc meetings).

If, SDK config is
```
webex.meetings.config.experimental.enableUnifiedMeetings
```
→ then SDK uses wbxappapi (MeetingInfo endpoint) to get the meeting info (instead of Locus) and wbxappapi returns an error code that says 403xxx and 423xxx 


Below-mentioned error messages are shown to the developer


```js
Password required. Call fetchMeetingInfo() with password argument
```

or

```js
Captcha required. Call fetchMeetingInfo() with captchaInfo argument
```

or both and

→ then the Developer has to supply a password/captcha and

→ then we can call fetchMeetingInfo again and get the info




We will be asked for a password if there is a scheduled space meeting, and you're not a member and not invited

Also, we will be asked for a captcha if we try the wrong password a few times.

These can be tested out from our public [Kitchen Sink app](https://webex.github.io/webex-js-sdk/samples/browser-plugin-meetings/).



### Captcha Response looks like below

fetch captcha image audio also refresh captcha URL

```js
{
"code": 423006,
"message": "PasswordOrHostKeyError too many time,please input captcha code",
"captchaID": "Captcha_8f7ecfce-541f-4f22-9ff7-a42d6a323336",
"verificationImageURL": "https://train.qa.webex.com/captchaservice/v1/captchas/Captcha_8f7ecfce-541f-4f22-9ff7-a42d6a323336/verificationCodeImage",
"verificationAudioURL": "https://train.qa.webex.com/captchaservice/v1/captchas/Captcha_8f7ecfce-541f-4f22-9ff7-a42d6a323336/verificationCodeAudio",
"refreshURL": "https://train.qa.webex.com/captchaservice/v1/captchas/refresh?siteurl=train&captchaID=Captcha_8f7ecfce-541f-4f22-9ff7-a42d6a323336"
}
```


## Error Codes

This is not the full list of all error codes wbxappapi can return. 


> Please refer to wbxappapi page for the [meeting info API](https://wiki.cisco.com/display/HFWEB/MeetingInfo+API).

In the SDK code, we check 403xxx and 423xxx without listing all possible values because these can change over time.


```js
const PASSWORD_ERROR_DEFAULT_MESSAGE = 'Password required. Call fetchMeetingInfo() with password argument'; 
const CAPTCHA_ERROR_DEFAULT_MESSAGE = 'Captcha required. Call fetchMeetingInfo() with captchaInfo argument'; 
const ADHOC_MEETING_DEFAULT_ERROR = 'Failed starting the adhoc meeting, Please contact support team ';
```


Code - [@webex/plugin-meetings/src/meeting-info/meeting-info-v2.js](https://github.com/webex/webex-js-sdk/blob/master/packages/node_modules/%40webex/plugin-meetings/src/meeting-info/meeting-info-v2.js)



All the below error codes returns while getting the meeting info and wbxappapi -


> Error code and a message shown to the developer are depicted as first one in the Error table.


### Verify Password Error Codes

Error Code | Error Message | Description
-- | -- | --
403036 | Meeting is not allow to access since require password or hostKey | Just asking for a password right now
403004 | Meeting is not allow to access since require password | if the user does not provide the password/pin as part of the joining
403028 | Meeting is not allow to access since password error | If the user provides an invalid or wrong password


### Verify Captcha Error Codes

```js
const CAPTCHA_ERROR_REQUIRES_PASSWORD_CODES = [423005, 423006];
```


Error Code | Error Message | Description
-- | -- | --
423006 | PasswordOrHostKeyError too many time,please input captcha code | If the user enters the wrong passwords (Reference - MeetingInfo Captcha case)
423001 | Too many requests access,please input captcha code | If the user provides an invalid or wrong password many times - Captcha Required
423005 | PasswordError too many time,please input captcha code | If the user provides an invalid or wrong password many times. password error more than three-time.



## Flow Diagram

This covers Password Required and Captcha Flow along with refresh captcha. 


![Password Captcha Flow](https://user-images.githubusercontent.com/3918217/179780542-9f52c442-360e-4a0b-955f-603ab28489c3.png)


# Important links & References


[Password and Captcha Support for USM GitHub Pull Request](https://github.com/webex/webex-js-sdk/pull/2238)

[Ad-hoc Space Meeting GitHub Pull Request](https://github.com/webex/webex-js-sdk/pull/2309)


# Demo
Please watch the Vidcast Demo recorded with the help of our [Kitchen Sink app](https://webex.github.io/webex-js-sdk/samples/browser-plugin-meetings/) below -

## Web Team - Adhoc Meetings
https://app.vidcast.io/share/53ebc866-8e91-46fb-ab81-47e1d8994f23

## Web Team - Password & Captcha support for USM
https://app.vidcast.io/share/d3427f5e-c9ed-47e3-8730-a3983b0ac7a3



Thanks for reading.