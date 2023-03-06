## Introduction 




This document explains the complete flow for password flow captcha. Basic Flow and Flow Diagram below.

> Please check the knowledge base recording for more information.


<p><br /></p>

## Branch & Usage
Repository

https://github.com/webex/webex-js-sdk

<p><br /></p>

## Important links & References


https://github.com/webex/webex-js-sdk/pull/2238 - PR

https://wiki.cisco.com/display/HFWEB/MeetingInfo+API  - this is wbxappapi page for the meeting info API

https://wiki.cisco.com/display/HFWEB/MeetingInfo+Captcha+case - MeetingInfo Captcha case

<p><br /></p>

## Basic Flow

Password/Captcha Flow,

If, SDK config is

```js
meetings.experimental.enableUnifiedMeetings=true
```

→ then SDK uses wbxappapi to get the meeting info (instead of Locus) and wbxappapi returns an error code that says 403xxx and 423xxx 

Below mentioned error messages are shown to the developer


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

KS App URL - https://webex.github.io/webex-js-sdk/samples/browser-plugin-meetings/


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

<p><br /></p>

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

<p><br /></p>

## Flow Diagram

This covers Password Required and Captcha Flow along with refresh captcha. 


![Password Captcha Flow](https://user-images.githubusercontent.com/3918217/179780542-9f52c442-360e-4a0b-955f-603ab28489c3.png)

<p><br /></p>

## Knowledge Base / Recordings

Vidcast demo -

Web Team - Password & Captcha support for USM
https://app.vidcast.io/share/d3427f5e-c9ed-47e3-8730-a3983b0ac7a3



<p><br /></p>

> __Please feel free to add/edit/delete anything, if required.

<p><br /></p>
