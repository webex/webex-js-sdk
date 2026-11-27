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
    }),
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
    }),
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
        } else {
          console.log('MEETING STILL EXISTS!', user.webex.meetings.getAllMeetings());
        }
      }, 3000);
    }),
  ]);
};

const syncAndEndMeeting = (user) =>
  user.webex.meetings
    .syncMeetings()
    .then(() => {
      const promise = [];
      const meetings = user.webex.meetings.getAllMeetings();

      if (Object.keys(meetings).length === 0) {
        return Promise.resolve();
      }
      Object.keys(meetings).forEach((key) => {
        promise.push(meetings[key].leave());
      });

      return Promise.all(promise);
    })
    .then(
      () =>
        new Promise((resolve) => {
          const interval = setInterval(() => {
            if (Object.keys(user.webex.meetings.getAllMeetings()).length === 0) {
              clearInterval(interval);
              resolve();
            } else {
              console.log('End Meetings before test failed');
            }
          }, 3000);
        })
    )
    .catch((e) => {
      console.log('ERROR on syncMeeting', e);
    });

// Each descriptor must match once; duplicates from one scope cannot satisfy another.
const waitForEvents = (scopeEvents, timeout = max) =>
  new Promise((resolve, reject) => {
    let timer;
    const result = [];
    const pending = new Map(scopeEvents.map((obj, index) => [index, obj]));
    const listeners = [];
    const cleanup = () => {
      clearTimeout(timer);
      listeners.forEach(({scope, event, handler}) => scope.off(event, handler));
    };
    const fail = (error) => {
      cleanup();
      reject(error);
    };
    timer = setTimeout(() => {
      fail(
        new Error(
          `Events not triggered ${JSON.stringify(
            Array.from(pending.values(), ({event}) => event)
          )} in ${timeout} ms`
        )
      );
    }, timeout);

    try {
      scopeEvents.forEach((obj, index) => {
        const handler = (value) => {
          if (!pending.has(index)) {
            return;
          }
          try {
            if (obj.match && !obj.match(value)) {
              return;
            }
            if (obj.event === 'meeting:added') {
              obj.user.meeting = value.meeting;
              obj.user.meeting.name = obj.user.name;
              obj.user.memberId = value.meeting.locusInfo.parsedLocus.selfId;
            }
            if (obj.event === 'meeting:removed') {
              if (obj.user.meeting.id !== value.meetingId) {
                throw new Error('Different Meeting Object');
              }
              obj.user.meeting = null;
            }

            const entry = Object.assign(obj, {result: value});

            result.push(entry);
            result[obj.event] = entry;
            pending.delete(index);
            obj.scope.off(obj.event, handler);
            if (pending.size === 0) {
              cleanup();
              resolve(result);
            }
          } catch (error) {
            fail(error);
          }
        };

        obj.scope.on(obj.event, handler);
        listeners.push({scope: obj.scope, event: obj.event, handler});
      });
      if (pending.size === 0) {
        cleanup();
        resolve(result);
      }
    } catch (error) {
      fail(error);
    }
  });

// Attach rejection handling immediately and release the deadline on every outcome.
const withTimeout = async (promise, timeout = max, description = 'Operation timed out') => {
  let timer;

  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          const message = typeof description === 'function' ? description() : description;

          reject(new Error(`${message} in ${timeout} ms`));
        }, timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
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
        promise
          .then((res) => {
            resolve(res);
            clearTimeout(timer);
          })
          .catch((e) => {
            console.error('delayedPromise', e);
            reject(e);
          });
      }, 2000);
    }),
  ]);
};

const delayedTest = (callback, timeout) =>
  new Promise((resolve) => {
    setTimeout(() => {
      callback();
      resolve();
    }, timeout);
  });

const waitUntil = (waitTime) =>
  new Promise((resolve) => {
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
const checkParticipantUpdatedStatus = (user, expectedStatus) => (event) =>
  !!event.delta.updated.find(
    (member) => user.meeting.members.selfId === member.id && member.status === expectedStatus
  );

export default {
  waitForSpy,
  waitForStateChange,
  waitForCallEnded,
  syncAndEndMeeting,
  waitForEvents,
  checkParticipantUpdatedStatus,
  delayedPromise,
  withTimeout,
  waitUntil,
  delayedTest,
  flushPromises,
  getCircularReplacer,
};
