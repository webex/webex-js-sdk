# Simultaneous Interpretation

Simultaneous Interpretation (SI) feature provides support for interpretation of in-meeting audio. The host will specify the target languages at schedule time and assign language pairs to the desired interpreters. Each interpreter will use their client to indicate the language spoken at any point in time. For example, Alice might be translating between English and French. When an English speaker is talking in the meeting, Alice will use her client to indicate she is speaking French. When a French speaker is talking, Alice will indicate that she is speaking English. The host’s client will display the status of each interpreter including the current interpretation direction.

### Structure
SI languages are available in the siLanguages collection. List the languages which current meeting support to do simultaneous interpretation. Can subscribe the language's voice channel which you want to listen from the list.

```javascript
interpretation.siLanguages;
```
### Attendee functionality
```javascript
//subscribe this si language's voice channel
siLanguage.subscribe();

//unsubscribe this si language's voice channel
siLanguage.unsubscribe();
```
### Host functionality
The following are methods available to the host of a meeting.

```javascript
//get the support list of interpretation languages. only host is allowed to call it
interpretation.getSupportLanguages();

//get the interpreters list of the meeting
interpretation.getInterpreters();

//update the interpreters list, input parameter is an array of interpreters
interpretation.updateInterpreters([{
  sourceLanguage : 'fr-FR',
  targetLanguage : 'zh-ZH',
  usingResource : {
    id : 'a96747e2-1fc6-41d3-9ac7-512dd9478b6e'
  },
  order : 0
},]);
```

### Interpreter functionality

The following are methods available to the interpreters of a meeting.

```javascript
//Change direction of interpretation for an interpreter participant
interpretation.changeDirection();

//Handoff between interpreters, input paramerter participantId is the target to handoff
interpretation.handoffInterpreter(participantId);

//in-active interpreter request to handoff to self
interpretation.requestHandoff();

//accept the request of handoff, input paramter url is from last approval event which generate by server side
interpretation.acceptRequest(url);

//decline the request of handoff, input paramter url is from last approval event which generate by server side
interpretation.declineRequest(url);

```
