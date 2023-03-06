# What is an Ad-hoc space meeting?
In Webex, the meetings can be broadly classified as below,

1. Webex Meetings
    1. **Scheduled Webex Meetings** - In this, the meeting gets created first and then the meeting information like Meeting ID, passcode & unique meeting link is sent to the
invitees
    2. **PMR (personal meeting room) (aka instant meeting)** - This is a meeting with static URL which can be attached to a meeting schedule as well as sent out as a message for anyone to join
2. Space Meetings 
    1. **Scheduled Space Meetings** - In this, the meeting gets created first and then the meeting information like Meeting ID, passcode & meeting link is available to the members of the space in Webex
    2. **Ad-hoc Space Meetings** - This type of meeting can be started from a team space where the meeting gets started instantly without any pre-scheduled meeting links. Although these meetings are instant and does not have a meeting ID / URL at the time of starting, Webex creates a meeting ID & URL for it which can be obtained via the Meeting Info API.

This document talks about **2. ii) Ad-hoc space meeting or the Instant meeting**. 

# Prerequisites
There is only one primary prerequisite. The Unified meetings should be enabled.

## How to know if Unified Meetings is enabled?
The Web SDK has the following configuration which should be true if the unified meetings are enabled.

```
webex.meetings.config.experimental.enableUnifiedMeetings
```

## How to enable Unified Meetings if disabled?
Invoke the following function which would toggle Unified Meetings on / off.

```
webex.meetings._toggleUnifiedMeetings(changeState);
```
|        |       |
| ------------- | ------------- |
| **Asynchronous**  | No  |
| **Parameters**  | changeState<Boolean (true / false)> |
| **Returns**  | undefined |

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
When an Ad-hoc meeting is already started by someone, Webex creates a meeting for that and appropriate meeting ID / URL is generated which then can be shared to others who could join through that meeting information.

From SDK, the meeting information is available in the Meetings object as mentioned below,
```
meeting.meetingInfo
```

# Change Pull Request
Ad-hoc Space Meeting Github Pull Request -> [#2309](https://github.com/webex/webex-js-sdk/pull/2309)