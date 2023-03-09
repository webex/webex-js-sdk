# Breakout Sessions

Breakout sessions are like meetings within meetings. They have separate roster lists and titles. Participants can move between breakouts and the main session.

### Enabling

To enable breakouts the `breakoutsSupported` parameter must be passed to the meeting join method.

### Structure

The current breakout session is accessible as follows:

```javascript
breakouts.currentBreakoutSession;
```

Other breakout sessions are available in the breakouts collection. These are breakouts that you known about. If you are an attendee, you may not know about all the breakout sessions in the meeting.

```javascript
breakouts.breakouts;
```

note: The `currentBreakoutSession` is NOT a member of the `breakouts.breakouts` collection.

Some information about the state of breakouts is available on the `meeting.breakouts` object itself

```javascript
// The number of seconds after ending breakouts before the participants are returned to the main session
breakouts.delayCloseTime;

// Whether the participant is allowed back to the main session
breakouts.allowBackToMain;
```

### Attendee functionality

The normal meeting members are updated when you move in and out of a breakout session.

The following are methods available to attendees of a meeting:

```javascript
// Join a breakout
// This can be used when the participant is in the main session or in a different breakout session
breakout.join();

// Leave a breakout
// This will cause the participant to return to the main session
breakouts.currentBreakoutSession.leave();

// Ask for help when in a breakout session. 10 second cooldown.
breakout.currentBreakoutSession.askForHelp();
```

#### Members

Each breakout session has members. Members represent other entities within the meeting.
The current breakout session members are accessed via the meeting object i.e. they will automatically
be updated when the user moves between sessions.

To see which members are in other sessions, you can access them via the breakout model. The Members
class is the same as that of the main meeting.

```javascript
breakout = breakouts.breakouts.models[0];
breakout.members;
```

#### breakouts events

```javascript
// When the breakouts in the breakouts collection changes. This includes updates to session members
on('meeting:breakouts:update', (breakouts) => {});

// When the breakout sessions end this event will be fired
on('meeting:breakouts:closing', () => {});

// When the host sends a message to the breakout this event will fire
on('meeting:breakouts:message', {senderUserId, sentTime, message, sessionId});
```

When breakouts are started there are several possibilities:

1. The attendee is forced to join a session
2. The attendee is assigned to a session, but can join when they feel like it
3. The attendee is not assigned to a session, and can choose which session they want to join

```javascript
breakout.assigned; // Assigned to a session, but not in it yet
breakout.assignedCurrent; // Forced to join a session
breakout.active; // The session exists
breakout.allowed; // The user is allowed to join the session
breakout.requested; // The user has been requested to join the session
```

The above attributes of the breakout sessions, combined with the `meeting:breakouts:update` event allow you to determine which situation you are in.

A host can signal attendees to move to a particular session. In this case the following is available. Using the same event, and the `requested` attribute of the breakout you can determine which session is to be moved to. Requesting return to the main session is the current use case of this.

### Host functionality

The following are methods available to a hosts of a meeting.

note: None of these are currently implemented

```javascript

// Move a participant to breakout
breakout.move(participant)

// Assign a particpant to a breakout
// Not sure whether there is any difference from move
breakout.assign(participant)

// Remove someone from a breakout session
// This returns them to the main session
breakout.remove(participant)

// Deletes a breakout session
// This can only be done when breakouts are inactive
breakout.delete()

/*
Create breakout sessions, Type is array
Format: [{'name':'session1', "anyoneCanJoin" : true}]
*/
breakouts.create(sessions)

// Delete all breakout sessions
breakouts.clearSessions()

// Rename an existing breakout session
breakout.rename(newSessionName)

// Start breakout sessions with necessary params
breakouts.start(params)

// End breakout sessions with necessary params
breakouts.end(params)

// get breakout sessions with/without param editlock
breakouts.getBreakout(editlock?)

// Enable breakout sessions
breakouts.enable()

// Disable breakout sessions
breakouts.disable()

// Send message asking all participants to return to the main session
breakouts.askAllToReturn()

// Send a message to a breakout session
// You can determine which participant types receive the message, if no type set, default is to all participants
breakout.broadcast(message, {participants: boolean, cohosts: boolean, presenters: boolean})

// Send a message to All breakout sessions
// You can determine which participant types receive the message,  if no type set, default is to all participants
breakouts.broadcast(message, {participants: boolean, cohosts: boolean, presenters: boolean})

// When breakouts are active you can cancel the automatic end of all sessions by calling this
// method. It cannot be restarted, only manually ending breakouts is possible after calling this
breakouts.cancelAutomaticEnd()

IBreakoutConfig {
  /*
  Number of sessions to count down before returning users to main session. Seconds. Default 60. 0 means off
  */
  countdownTimer: Number,
  /*
  Whether attendees are allowed to return to the main meeting
  */
  allowReturntoMainMeeting: Boolean,
  /*
  Whether attendees are allowed to join later
  */
  allowJoinLater: Boolean,
  /*
  The timeout after which breakouts are automatically ended. Seconds. Default 1800 (30 minutes) Miniumum 5 minutes.
  */
  automaticallyEndBreakoutsAfter: Number,
  /*
  How participants are assigned to breakouts.
  auto -> participants are automatically placed in sessions
  */
  assignmentMethod: 'auto' | 'manual' | 'choose'
}

// Configure settings on breakouts
breakouts.configure(config)

// set whether anyone can join the breakout or whether it is just assigned participants that can join
breakout.setOpen(isOpen)

// When the members change for a given breakout
on('meeting:breakout:members:update', ({sessionId, members}) => {

})

```
