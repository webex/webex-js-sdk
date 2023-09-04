






## Changes on the SDK side to migrate customers to USM meetings 


### Pre requests 

* Developers have created a integration bot , intergation
* Created spaces and added guest uses to the space 
* Has the hydra room ID to start the meeting on the space.
* Guest will be starting the meeting in a space 


### Existing workflow with the SDK 

Use the licence of the one of the superior user in the space 

```
  const webex = (window.webex = window.Webex.init(…)
  await webex.meetings.register();

  const room_Id = "csdsd-sdsd-sds-dsd-sddsd-" // room where the user is part of 
  const meeting = await webex.meetings.create(room_Id, "ROOM_ID");

  await meeting.join()
  await meeting.addMedia(..)

  // User should be joined when add Media is successful 
```


### New Flow with the SDK 

* Application developer  (machine account) need to create a space meeting for a specific space and give back hostId and password
* Developers will now have to pass the meeting ID, There is no need to pass the room id , we will be decoupling the room from meeting going forward and ask developers to use apis

 developers uses the service app token to call /meetings create api and will have two options 

*  create a meetings with the room id and mark it as adhoc meeting => meeting ID , host Pin and password
* create a normal meeting which starts in few min or later time and add the guest email address to the meeting api


  ```
  const webex = (window.webex = window.Webex.init(…)
  await webex.meetings.register();

  const webexMeetingId = "34343434" // webex id for the meeting 
  const hostPin = "344545"
  const meeting = await webex.meetings.create(webexMeetingId, "MEETING_ID");

  if(meeting.passwordStatus === "REQUIRED") {

    const response  = meeting.verifyPassword(hostPin)
  }


if(response.isPasswordValid) {
    await meeting.join()
    await meeting.addMedia(..)
}

  // User should be joined when add Media is successful 
```

