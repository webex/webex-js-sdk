import {assert} from '@webex/test-helper-chai';
import {Defer} from '@webex/common';

const max = 30000;
const waitForSpy = (spy, event) => {
  let timer;

  return Promise.race([
    new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(` ${event} did not fire`));
      }, max);
    }),
    new Promise((resolve) => {
      const interval = setInterval(() => {
        if (spy.calledOnce) {
          clearTimeout(timer);
          clearInterval(interval);
          resolve(spy.args[0][0]);
        }
      }, 1000);
    })
  ]);
};

const waitForStateChange = (meeting, state) => {
  let timer;

  return Promise.race([
    new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Expected:  ${state} , Actual: ${meeting.state}`));
      }, max);
    }),
    new Promise((resolve) => {
      const interval = setInterval(() => {
        if (meeting.state === state) {
          clearTimeout(timer);
          clearInterval(interval);
          resolve(meeting.locusInfo.parsedLocus.states);
        }
      }, 1000);
    })
  ]);
};

const waitForCallEnded = (user, email) => {
  let timer;

  return Promise.race([
    new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(` ${user.name} meeting still exists`));
      }, max);
    }),
    new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!user.webex.meetings.getMeetingByType('sipUri', email)) {
          clearTimeout(timer);
          clearInterval(interval);
          resolve();
        }
        else {
          console.log('MEETING STILL EXISTS!', user.webex.meetings.getAllMeetings());
        }
      }, 3000);
    })
  ]);
};

const syncAndEndMeeting = (user) => user.webex.meetings.syncMeetings()
  .then(() => {
    const promise = [];
    const meetings = user.webex.meetings.getAllMeetings();

    if (Object.keys(meetings).length === 0) {
      return Promise.resolve();
    }
    Object.keys(meetings)
      .forEach((key) => {
        promise.push(meetings[key].leave());
      });

    return Promise.all(promise);
  })
  .then(() => new Promise((resolve) => {
    const interval = setInterval(() => {
      if (Object.keys(user.webex.meetings.getAllMeetings()).length === 0) {
        clearInterval(interval);
        resolve();
      }
      else {
        console.log('End Meetings before test failed');
      }
    }, 3000);
  }))
  .catch((e) => {
    console.log('ERROR on syncMeeting', e);
  });

//
const waitForEvents = (scopeEvents, timeout = max) => {
  let timer;
  const events = {};

  return Promise.race([
    new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Events not triggered ${JSON.stringify(events)} in ${timeout} ms`));
      }, timeout);
    }),
    new Promise((resolve, reject) => {
      try {
        const result = [];

        scopeEvents.forEach((obj) => {
          events[obj.event] = false;
          const handler = (value) => {
            result.push(Object.assign(obj, {result: value}));
            events[obj.event] = true;
            result[obj.event] = Object.assign(obj, {result: value});
            if (obj.event === 'meeting:added') {
              obj.user.meeting = value.meeting;
              obj.user.meeting.name = obj.user.name;
              obj.user.memberId = value.meeting.locusInfo.parsedLocus.selfId;
            }
            if (obj.event === 'meeting:removed') {
              console.log(`MEETING:REMOVED ${obj.user.name} ID ${obj.user.meeting.id} correlationID ${obj.user.meeting.correlationId}`);
              if (obj.user.meeting.id === value.meetingId) {
                obj.user.meeting = null;
              }
              else {
                console.log('MEETING EXISTING ', obj.user.webex.meetings.getAllMeetings());
                reject(new Error(`Different Meeting Object ${value}`));
              }
            }

            if (obj.match) {
              if (obj.match(value)) {
                clearTimeout(timer);
                obj.scope.off(obj.event, handler);

                resolve(result);
              }
            }
            else if (result.length === scopeEvents.length) {
              resolve(result);
              obj.scope.off(obj.event, handler);
              clearTimeout(timer);
            }
          };

          obj.scope.on(obj.event, handler);
        });
      }
      catch (e) {
        console.error('waitForEvents', e);
        reject(e);
      }
    })
  ]);
};

const delayedPromise = (promise) => {
  let timer;

  return Promise.race([
    new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error('Events not triggered'));
      }, max);
    }),
    new Promise((resolve, reject) => {
      setTimeout(() => {
        promise.then((res) => {
          resolve(res);
          clearTimeout(timer);
        })
          .catch((e) => {
            console.error('delayedPromise', e);
            reject(e);
          });
      }, 2000);
    })
  ]);
};

const delayedTest = (callback, timeout) => new Promise((resolve) => {
  setTimeout(() => {
    callback();
    resolve();
  }, timeout);
});

const addMedia = (user) => {
  const mediaReadyPromises = {
    local: new Defer(),
    remoteAudio: new Defer(),
    remoteVideo: new Defer(),
  };
  const mediaReady = (media) => {
    if (!media) {
      return;
    }
    if (mediaReadyPromises[media.type]) {
      mediaReadyPromises[media.type].resolve();
    }
  };

  user.meeting.on('media:ready', mediaReady);

  return user.meeting.getMediaStreams({
    sendAudio: true,
    sendVideo: true,
    sendShare: false
  })
    .then(([localStream, localShare]) => user.meeting.addMedia({
      mediaSettings: {
        sendAudio: true,
        sendVideo: true,
        sendShare: false,
        receiveShare: true,
        receiveAudio: true,
        receiveVideo: true
      },
      localShare,
      localStream
    }))
    .then(() => Promise.all(Object.values(mediaReadyPromises).map((defer) => defer.promise)))
    .then(() => {
      assert.exists(user.meeting.mediaProperties.audioTrack, 'audioTrack not present');
      assert.exists(user.meeting.mediaProperties.videoTrack, 'videoTrack not present');
    });
};

const waitUntil = (waitTime) => new Promise((resolve) => {
  setTimeout(() => {
    resolve();
  }, waitTime);
});

const flushPromises = () => new Promise(setImmediate);

const getCircularReplacer = () => {
  const seen = new WeakSet();

  return (_, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }

    // eslint-disable-next-line consistent-return
    return value;
  };
};

// this function is meant to be used as the "match" callback with waitForEvents()
// when you want to wait for a particular users's status to reach a certain value
const checkParticipantUpdatedStatus = (user, expectedStatus) => (event) => !!event.delta.updated.find((member) => user.meeting.members.selfId === member.id && member.status === expectedStatus);

export default {
  waitForSpy,
  waitForStateChange,
  waitForCallEnded,
  syncAndEndMeeting,
  waitForEvents,
  checkParticipantUpdatedStatus,
  delayedPromise,
  addMedia,
  waitUntil,
  delayedTest,
  flushPromises,
  getCircularReplacer
};

