/* global step: false */

import browser from 'bowser';
import 'mocha-steps';
import {assert} from '@ciscospark/test-helper-chai';
import {browserOnly, expectEvent, firefoxOnly, handleErrorEvent} from '@ciscospark/test-helper-mocha';
import sinon from '@ciscospark/test-helper-sinon';
import WebRTCMediaEngine, {webrtcHelpers} from '@ciscospark/media-engine-webrtc';

import {setupRemotePeerConnection, simulateAnswer, clearRemoteSession} from '../lib/offer-answer';

const {
  getMediaDirectionFromSDP,
  getMediaFromSDP,
  reverseMediaDirection
} = webrtcHelpers;

function getExpectedMediaDirection(next, previous) {
  if (previous.includes('recv')) {
    if (next === 'inactive') {
      return 'recvonly';
    }
    if (next === 'sendonly') {
      return 'sendrecv';
    }
  }

  return next;
}

const backoffPattern = [0, 100, 200, 400, 800];

function retry(fn) {
  return backoffPattern.reduce((promise, delay) => promise.catch(() => new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(fn());
      }
      catch (err) {
        reject(err);
      }
    }, delay);
  })), Promise.reject());
}

browserOnly(describe)('media-engine-webrtc', function () {
  this.timeout(60000);
  describe('WebRTCMediaEngine', () => {
    describe('#logger', () => {
      it('defaults to console', () => {
        const engine = new WebRTCMediaEngine();
        assert.equal(engine.logger, console);
      });

      it('proxies to the spark logger', () => {
        const engine = new WebRTCMediaEngine(null, {
          parent: {
            logger: {}
          }
        });

        assert.equal(engine.logger, console);
        return Promise.resolve()
          .then(() => new Promise((resolve) => process.nextTick(resolve)))
          .then(() => {
            assert.isDefined(engine.logger);
            assert.notEqual(engine.logger, console);
          });
      });
    });

    describe('renegotiation', () => {
      const audioStartStates = [
        'inactive',
        'recvonly',
        'sendonly',
        'sendrecv'
      ];

      const audioEndStates = [
        'inactive',
        'recvonly',
        'sendonly',
        'sendrecv'
      ];

      const videoStartStates = [
        'inactive',
        'recvonly',
        'sendonly',
        'sendrecv'
      ];

      const videoEndStates = [
        'inactive',
        'recvonly',
        'sendonly',
        'sendrecv'
      ];

      audioStartStates.forEach((audioStart) => {
        audioEndStates.forEach((audioEnd) => {
          videoStartStates.forEach((videoStart) => {
            // all the complexity comes from building the `describe()` block
            // message
            // eslint-disable-next-line complexity
            videoEndStates.forEach((videoEnd) => {
              if (audioStart === 'inactive' && videoStart === 'inactive') {
                // not a valid initial state
                return;
              }

              if (audioEnd === 'inactive' && videoEnd === 'inactive') {
                return;
              }

              if (audioStart === audioEnd && videoStart === videoEnd) {
                // no changes, therefore nothing to test
                return;
              }

              // Scenarios that involve adding a remote stream after the the
              // call has started seem flaky in Chrome. They pass on occasion,
              // but more oftent than not, the `track` event doesn't fire. I
              // can't tell if this is a Chrome bug or an adapter.js bug and so
              // far, I've not been able to reproduce in isolation, so I don't
              // have a means of providing a reproduction case.
              // TODO keep an eye on this as Chrome and adapter.js update
              const flakyInChrome = !audioStart.includes('recv') && audioEnd.includes('recv')
                || !videoStart.includes('recv') && videoEnd.includes('recv');

              // Firefox does doesn't include ice credentials when renegotiating
              // a media stream into an inactive state, but the mock peer
              // expects said credentials. We're not sure if this bug will
              // impact the real world, but we plan to minimize renegotation
              // that transitions to inactive and don't expect major issues.
              // More details in `renegotiation-support.md`

              const brokenInFirefox = audioStart !== 'inactive' && audioEnd === 'inactive'
                  && videoStart === 'inactive' && videoEnd !== 'inactive'
                || audioStart === 'inactive' && audioEnd !== 'inactive'
                  && videoStart !== 'inactive' && videoEnd === 'inactive';

              // Chrome rejects transition when setting local offer with error:
              // Failed to set local offer sdp: The m= section:video should be rejected.
              const brokenInChrome = audioStart !== 'inactive' && audioEnd === 'inactive'
                && videoStart === 'recvonly' && videoEnd.includes('send');

              const shouldSkip = (browser.chrome && (flakyInChrome || brokenInChrome)) || (browser.firefox && brokenInFirefox);

              // See `renegotiation-support.md` for renegotiation and ontrack table

              let sendingAudioChange = false;
              sendingAudioChange = audioStart.includes('send') !== audioEnd.includes('send');

              let sendingVideoChange = false;
              sendingVideoChange = videoStart.includes('send') !== videoEnd.includes('send');

              let receivingAudioChange = false;
              receivingAudioChange = audioStart.includes('recv') !== audioEnd.includes('recv');

              let receivingVideoChange = false;
              receivingVideoChange = videoStart.includes('recv') !== videoEnd.includes('recv');

              let expectNewRemoteTrackOnTransition = false;
              let expectToRenegotiateOnTransition = expectNewRemoteTrackOnTransition;
              let expectNewRemoteTrackOnReturn = false;
              let expectToRenegotiateOnReturn = expectNewRemoteTrackOnReturn;

              const message = `when ${[
                audioStart === audioEnd ? `audio is '${audioStart}'` : `audio changes from '${audioStart}' to '${audioEnd}'`,
                videoStart === videoEnd ? `video is '${videoStart}'` : `video changes from '${videoStart}' to '${videoEnd}'`
              ]
                .filter((m) => m)
                .join(' and ')}`;

              describe(message, () => {
                // Note: This describe block is stateful; `step()` statements must
                // execute in order.
                let engine;
                before(() => {
                  engine = new WebRTCMediaEngine();
                });

                after(() => {
                  engine.stop();
                  clearRemoteSession();
                });


                (shouldSkip ? it.skip : step)(`initiates a session with audio=${audioStart} and video=${videoStart}`, () => {
                  engine.setMedia('audio', audioStart);
                  engine.setMedia('video', videoStart);
                  setupRemotePeerConnection();

                  return engine.createOffer()
                    .then((offerSdp) => {
                      assertLocalMedia(engine, audioStart, videoStart);
                      assert.equal(
                        getMediaDirectionFromSDP('audio', offerSdp),
                        audioStart
                      );
                      assert.equal(
                        getMediaDirectionFromSDP('video', offerSdp),
                        videoStart
                      );

                      return offerSdp;
                    })
                    .then(simulateAnswer)
                    .then((answerSdp) => {
                      assertLocalMedia(engine, audioStart, videoStart);

                      assert.equal(
                        getMediaDirectionFromSDP('audio', answerSdp),
                        reverseMediaDirection(audioStart)
                      );
                      assert.equal(
                        getMediaDirectionFromSDP('video', answerSdp),
                        reverseMediaDirection(videoStart)
                      );
                      return answerSdp;
                    })
                    .then((answerSdp) => Promise.all([
                      (audioStart.includes('recv')
                        || videoStart.includes('recv')) && expectEvent(20000, 'track', engine),
                      engine.acceptAnswer(answerSdp)
                    ]))
                    .then(() => {
                      assertLocalMedia(engine, audioStart, videoStart);
                      assertRemoteMedia(engine, audioStart, videoStart);

                      assert.equal(engine.audioDirection, audioStart);
                      assert.equal(engine.videoDirection, videoStart);
                    });
                });

                (shouldSkip ? it.skip : step)(`transitions to audio=${audioEnd} and video=${videoEnd}`, () => {
                  const sendingAudioSpy = sinon.spy();
                  const sendingVideoSpy = sinon.spy();
                  const receivingAudioSpy = sinon.spy();
                  const receivingVideoSpy = sinon.spy();

                  engine.once('change:sendingAudio', sendingAudioSpy);
                  engine.once('change:sendingVideo', sendingVideoSpy);
                  engine.once('change:receivingAudio', receivingAudioSpy);
                  engine.once('change:receivingVideo', receivingVideoSpy);

                  const negotiationneededSpy = sinon.spy();
                  const trackSpy = sinon.spy();

                  engine.once('negotiationneeded', negotiationneededSpy);
                  engine.once('track', trackSpy);

                  // Firefox initiates sendonly media as sendrecv,
                  // so we should not renegotiate when transitioning to enable recv
                  expectNewRemoteTrackOnTransition = expectNewRemoteTrackOnTransition
                    || !audioStart.includes('recv') && audioEnd.includes('recv')
                      && !(browser.firefox && audioStart === 'sendonly' && audioEnd.includes('recv'))
                    || !videoStart.includes('recv') && videoEnd.includes('recv')
                      && !(browser.firefox && videoStart === 'sendonly' && videoEnd.includes('recv'));

                  expectToRenegotiateOnTransition = expectNewRemoteTrackOnTransition
                    || !audioStart.includes('send') && audioEnd.includes('send')
                    || !videoStart.includes('send') && videoEnd.includes('send');


                  return Promise.all([
                    engine.setMedia('audio', audioEnd),
                    engine.setMedia('video', videoEnd)
                  ])
                    .then(() => Promise.all([
                      expectToRenegotiateOnTransition && expectEvent(20000, 'negotiationneeded', engine)
                        .then(() => retry(() => assertLocalMedia(engine, audioEnd, videoEnd)))
                        .then(() => engine.createOffer())
                        .then((offerSdp) => {
                          // When transitioning to inactive after a renegotiation, FF does not set
                          // correct direction on sdp so we skip the assertions
                          if (!browser.firefox || audioEnd !== 'inactive') {
                            assertOffer('audio', audioEnd, audioStart, offerSdp);
                          }
                          if (!browser.firefox || videoEnd !== 'inactive') {
                            assertOffer('video', videoEnd, videoStart, offerSdp);
                          }
                          return offerSdp;
                        })
                        .then(simulateAnswer)
                        .then((answerSdp) => {
                          if (!browser.firefox || audioEnd !== 'inactive') {
                            assertAnswer('audio', audioEnd, audioStart, answerSdp);
                          }
                          if (!browser.firefox || videoEnd !== 'inactive') {
                            assertAnswer('video', videoEnd, videoStart, answerSdp);
                          }
                          return answerSdp;
                        })
                        .then((answerSdp) => engine.acceptAnswer(answerSdp)),
                      expectNewRemoteTrackOnTransition && expectEvent(20000, 'track', engine)
                    ]))
                    .then(() => {
                      assertLocalMedia(engine, audioEnd, videoEnd);
                      // Firefox transitions from sendonly to recv that trigger renegotiation
                      // generates extra receiver tracks. We ignore those changes for now.
                      if (!browser.firefox
                        || !expectToRenegotiateOnTransition
                        || ((videoStart !== 'sendonly' || !videoEnd.includes('recv'))
                          && (audioStart !== 'sendonly' || !audioEnd.includes('recv')))) {
                        assertRemoteMedia(engine, audioEnd, videoEnd);
                      }
                      assert.equal(engine.audioDirection, audioEnd);
                      assert.equal(engine.videoDirection, videoEnd);
                    })
                    .then(() => {
                      assertSpyCalledOrNot(expectToRenegotiateOnTransition, negotiationneededSpy);
                      assertSpyCalledOrNot(expectNewRemoteTrackOnTransition, trackSpy);

                      assertSpyCalledOrNot(sendingAudioChange, sendingAudioSpy);
                      assertSpyCalledOrNot(sendingVideoChange, sendingVideoSpy);
                      assertSpyCalledOrNot(receivingAudioChange, receivingAudioSpy);
                      assertSpyCalledOrNot(receivingVideoChange, receivingVideoSpy);
                    });
                });

                (shouldSkip ? it.skip : step)(`returns to audio=${audioStart} and video=${videoStart}`, () => {
                  const sendingAudioSpy = sinon.spy();
                  const sendingVideoSpy = sinon.spy();
                  const receivingAudioSpy = sinon.spy();
                  const receivingVideoSpy = sinon.spy();

                  engine.once('change:sendingAudio', sendingAudioSpy);
                  engine.once('change:sendingVideo', sendingVideoSpy);
                  engine.once('change:receivingAudio', receivingAudioSpy);
                  engine.once('change:receivingVideo', receivingVideoSpy);

                  const negotiationneededSpy = sinon.spy();
                  const trackSpy = sinon.spy();

                  engine.once('negotiationneeded', negotiationneededSpy);
                  engine.once('track', trackSpy);

                  // We should not need to renegotiate nor add new recv tracks.
                  // Chrome removes recv tracks when sdp updates without recv so
                  // when we add recv back, we must trigger renegotiation to get
                  // the new track.
                  expectNewRemoteTrackOnReturn = expectNewRemoteTrackOnReturn
                    || browser.chrome
                      && (!audioEnd.includes('recv') && audioStart.includes('recv')
                        || !videoEnd.includes('recv') && videoStart.includes('recv'))
                      && expectToRenegotiateOnTransition;

                  expectToRenegotiateOnReturn = expectNewRemoteTrackOnReturn;

                  return Promise.all([
                    engine.setMedia('audio', audioStart),
                    engine.setMedia('video', videoStart)
                  ])
                    .then(() => Promise.resolve(
                      expectToRenegotiateOnReturn
                      && expectEvent(20000, 'negotiationneeded', engine)
                        .then(() => engine.createOffer())
                        .then((offer) => {
                          assertOffer('audio', audioStart, audioEnd, offer);
                          assertOffer('video', videoStart, videoEnd, offer);

                          return offer;
                        })
                        .then(simulateAnswer)
                        .then((answer) => {
                          assertAnswer('audio', audioStart, audioEnd, answer);
                          assertAnswer('video', videoStart, videoEnd, answer);

                          return answer;
                        })
                        .then((answer) => Promise.all([
                          engine.acceptAnswer(answer),
                          expectNewRemoteTrackOnReturn && expectEvent(20000, 'track', engine)
                        ]))
                    ))
                    .then(() => {
                      assertLocalMedia(engine, audioStart, videoStart);
                      // Firefox transitions from sendonly to recv that trigger renegotiation
                      // generates extra receiver tracks. We ignore those changes for now.
                      if (!browser.firefox
                        || !expectToRenegotiateOnTransition
                        || ((videoStart !== 'sendonly' || !videoEnd.includes('recv'))
                          && (audioStart !== 'sendonly' || !audioEnd.includes('recv')))) {
                        assertRemoteMedia(engine, audioStart, videoStart);
                      }
                      assert.equal(engine.audioDirection, audioStart, `expected "audio" to return to "${audioStart}"`);
                      assert.equal(engine.videoDirection, videoStart, `expected "video" to return to "${videoStart}"`);
                    })
                    .then(() => {
                      assertSpyCalledOrNot(expectToRenegotiateOnReturn, negotiationneededSpy);
                      assertSpyCalledOrNot(expectNewRemoteTrackOnReturn, trackSpy);

                      assertSpyCalledOrNot(sendingAudioChange, sendingAudioSpy);
                      assertSpyCalledOrNot(sendingVideoChange, sendingVideoSpy);
                      assertSpyCalledOrNot(receivingAudioChange, receivingAudioSpy);
                      assertSpyCalledOrNot(receivingVideoChange, receivingVideoSpy);
                    });
                });
              });
            });
          });
        });
      });
    });

    [
      'audio',
      'video'
    ]
      .forEach((kind) => {
        describe(`#(un)pauseSendingMedia(${kind})`, () => {
          it(`pauses the outgoing ${kind} stream but does not trigger renegotiation`, () => {
            const engine = new WebRTCMediaEngine();
            engine.setMedia('audio', 'sendrecv');
            engine.setMedia('video', 'sendrecv');
            const spy = sinon.spy();

            setupRemotePeerConnection();
            return engine.createOffer()
              .then(simulateAnswer)
              .then((answer) => Promise.all([
                expectEvent(20000, 'track', engine),
                engine.acceptAnswer(answer)
              ]))
              .then(() => {
                assertLocalMedia(engine, 'sendrecv', 'sendrecv');
                assertRemoteMedia(engine, 'sendrecv', 'sendrecv');

                engine.on('negotiationneeded', spy);
                engine.pauseSendingMedia(kind);
                assert.isFalse(engine.pc.getSenders().find((s) => s.track && s.track.kind === kind).track.enabled);
                assert.isFalse(engine.localMediaStream.getTracks().find((t) => t.kind === kind).enabled);
                // I don't know a better way to assert an event doesn't fire than
                // to wait a while and assert it didn't fire.
                return new Promise((resolve) => setTimeout(resolve, 500));
              })
              .then(() => assert.notCalled(spy))
              .then(() => {
                assertLocalMedia(engine, kind === 'audio' ? 'recvonly' : 'sendrecv', kind === 'video' ? 'recvonly' : 'sendrecv');
                assertRemoteMedia(engine, kind === 'audio' ? 'recvonly' : 'sendrecv', kind === 'video' ? 'recvonly' : 'sendrecv');

                engine.on('negotiationneeded', spy);
                engine.unpauseSendingMedia(kind);
                assert.isTrue(engine.pc.getSenders().find((s) => s.track && s.track.kind === kind).track.enabled);
                assert.isTrue(engine.localMediaStream.getTracks().find((t) => t.kind === kind).enabled);
                // I don't know a better way to assert an event doesn't fire than
                // to wait a while and assert it didn't fire.
                return new Promise((resolve) => setTimeout(resolve, 500));
              })
              .then(() => assert.notCalled(spy));
          });
        });

        describe(`#(un)pauseReceivingMedia(${kind})`, () => {
          it(`pauses the outgoing ${kind} stream but does not trigger renegotiation`, () => {
            const engine = new WebRTCMediaEngine();
            engine.setMedia('audio', 'sendrecv');
            engine.setMedia('video', 'sendrecv');
            const spy = sinon.spy();

            setupRemotePeerConnection();
            return engine.createOffer()
              .then(simulateAnswer)
              .then((answer) => Promise.all([
                expectEvent(20000, 'track', engine),
                engine.acceptAnswer(answer)
              ]))
              .then(() => {
                assertLocalMedia(engine, 'sendrecv', 'sendrecv');
                assertRemoteMedia(engine, 'sendrecv', 'sendrecv');

                engine.on('negotiationneeded', spy);
                engine.pauseReceivingMedia(kind);
                assert.isFalse(engine.pc.getRemoteStreams()[0].getTracks().find((t) => t.kind === kind).enabled);
                assert.isFalse(engine.remoteMediaStream.getTracks().find((t) => t.kind === kind).enabled);
                // I don't know a better way to assert an event doesn't fire than
                // to wait a while and assert it didn't fire.
                return new Promise((resolve) => setTimeout(resolve, 500));
              })
              .then(() => assert.notCalled(spy))
              .then(() => {
                assertLocalMedia(engine, kind === 'audio' ? 'sendonly' : 'sendrecv', kind === 'video' ? 'sendonly' : 'sendrecv');
                assertRemoteMedia(engine, kind === 'audio' ? 'sendonly' : 'sendrecv', kind === 'video' ? 'sendonly' : 'sendrecv');

                engine.on('negotiationneeded', spy);
                engine.unpauseReceivingMedia(kind);
                assert.isTrue(engine.pc.getRemoteStreams()[0].getTracks().find((t) => t.kind === kind).enabled);
                assert.isTrue(engine.remoteMediaStream.getTracks().find((t) => t.kind === kind).enabled);
                // I don't know a better way to assert an event doesn't fire than
                // to wait a while and assert it didn't fire.
                return new Promise((resolve) => setTimeout(resolve, 500));
              })
              .then(() => assert.notCalled(spy));
          });
        });
      });

    describe('custom track', () => {
      let engine;
      beforeEach(() => {
        engine = new WebRTCMediaEngine();
      });

      afterEach(() => {
        engine.stop();
      });


      it('adds a track without internally calling getusermedia', () => {
        let track;
        const spy = sinon.spy(engine, '_getUserMedia');

        return WebRTCMediaEngine.getUserMedia({
          audio: true,
          video: false
        })
          .then((stream) => {
            [track] = stream.getAudioTracks();
            engine.setMedia('audio', 'sendrecv', track);

            assert.lengthOf(engine.localMediaStream.getTracks(), 1);
            setupRemotePeerConnection();
            return engine.createOffer();
          })
          .then(simulateAnswer)
          .then((answer) => Promise.all([
            expectEvent(20000, 'track', engine),
            engine.acceptAnswer(answer)
          ]))
          .then(() => {
            assert.equal(engine.localMediaStream.getAudioTracks()[0].id, track.id);
            assert.equal(engine.localMediaStream.getAudioTracks()[0], track);
            assert.notCalled(spy);
            assertLocalMedia(engine, 'sendrecv', 'inactive');
          });
      });

      it('adds an external track without clobbering it', () => {
        let track;

        return WebRTCMediaEngine.getUserMedia({
          audio: true,
          video: false
        })
          .then((stream) => {
            [track] = stream.getAudioTracks();
            engine.setMedia('audio', 'sendrecv', track);
            engine.setMedia('video', 'sendrecv');

            assert.lengthOf(engine.localMediaStream.getTracks(), 1);
            setupRemotePeerConnection();
            return engine.createOffer();
          })
          .then(simulateAnswer)
          .then((answer) => Promise.all([
            expectEvent(20000, 'track', engine),
            engine.acceptAnswer(answer)
          ]))
          .then(() => {
            assert.equal(engine.localMediaStream.getAudioTracks()[0].id, track.id);
            assert.equal(engine.localMediaStream.getAudioTracks()[0], track);
            assertLocalMedia(engine, 'sendrecv', 'sendrecv');
          });
      });

      it('adds a new track to an inprogress connection', () => {
        let track;

        engine.setMedia('audio', 'inactive');
        engine.setMedia('video', 'sendrecv');

        setupRemotePeerConnection();
        return engine.createOffer()
          .then(simulateAnswer)
          .then((answer) => Promise.all([
            expectEvent(20000, 'track', engine),
            engine.acceptAnswer(answer)
          ]))
          .then(() => {
            assertLocalMedia(engine, 'inactive', 'sendrecv');
            return WebRTCMediaEngine.getUserMedia({
              audio: true,
              video: false
            });
          })
          .then((stream) => {
            [track] = stream.getAudioTracks();
            assert.isDefined(track);
            engine.setMedia('audio', 'sendrecv', track);
            return expectEvent(20000, 'negotiationneeded', engine);
          })
          .then(() => engine.createOffer())
          .then(simulateAnswer)
          .then((answer) => engine.acceptAnswer(answer))
          .then(() => {
            assertLocalMedia(engine, 'sendrecv', 'sendrecv');
            assert.equal(engine.localMediaStream.getAudioTracks()[0].id, track.id);
            assert.equal(engine.localMediaStream.getAudioTracks()[0], track);
          });
      });
    });

    describe('custom constraints', () => {
      let engine, spy;
      beforeEach(() => {
        engine = new WebRTCMediaEngine();
        spy = sinon.spy(WebRTCMediaEngine, 'getUserMedia');
      });

      afterEach(() => {
        engine.stop();
        spy.restore();
      });


      it('starts a connection with custom constraints', () => {
        assert.notCalled(spy);
        engine.setMedia('audio', 'sendrecv');
        engine.setMedia('video', 'sendrecv', {
          facingMode: {
            ideal: 'user'
          }
        });
        setupRemotePeerConnection();
        return engine.createOffer()
          .then(simulateAnswer)
          .then((answer) => engine.acceptAnswer(answer))
          .then(() => {
            assert.calledOnce(spy);
            assert.calledWith(spy, {
              audio: true,
              video: {
                facingMode: {
                  ideal: 'user'
                }
              }
            });

            assertLocalMedia(engine, 'sendrecv', 'sendrecv');
          });
      });

      it('replaces a track with with new contraints', () => {
        assert.notCalled(spy);
        engine.setMedia('audio', 'sendrecv');
        engine.setMedia('video', 'sendrecv', {
          facingMode: {
            ideal: 'user'
          }
        });

        setupRemotePeerConnection();
        return engine.createOffer()
          .then(simulateAnswer)
          .then((answer) => engine.acceptAnswer(answer))
          .then(() => {
            assert.calledOnce(spy);
            assert.calledWithMatch(spy, {
              audio: true,
              video: {
                facingMode: {
                  ideal: 'user'
                }
              }
            });

            assertLocalMedia(engine, 'sendrecv', 'sendrecv');
            return engine.setMedia('video', 'sendrecv', {
              facingMode: {
                ideal: 'environment'
              }
            });
            // We do not need to wait for renegotation for local track switching
          })
          .then(() => engine.logger.info('creating new offer'))
          .then(() => engine.createOffer())
          .then(simulateAnswer)
          .then((answer) => engine.acceptAnswer(answer))
          .then(() => {
            assert.calledWithMatch(spy, {
              video: {
                facingMode: {
                  ideal: 'environment'
                }
              }
            });

            assertLocalMedia(engine, 'sendrecv', 'sendrecv');
          });
      });

      it('adds a new track to an inprogress connection', () => {
        assert.notCalled(spy);
        engine.setMedia('audio', 'sendrecv');

        setupRemotePeerConnection();
        return engine.createOffer()
          .then(simulateAnswer)
          .then((answer) => engine.acceptAnswer(answer))
          .then(() => {
            assert.calledOnce(spy);

            assertLocalMedia(engine, 'sendrecv', 'inactive');
            engine.setMedia('video', 'sendrecv', {
              facingMode: {
                ideal: 'environment'
              }
            });

            return expectEvent(20000, 'negotiationneeded', engine);
          })
          .then(() => engine.createOffer())
          .then(simulateAnswer)
          .then((answer) => engine.acceptAnswer(answer))
          .then(() => {
            assert.calledWithMatch(spy, {
              video: {
                facingMode: {
                  ideal: 'environment'
                }
              }
            });

            assertLocalMedia(engine, 'sendrecv', 'sendrecv');
          });
      });
    });

    firefoxOnly(describe)('screensharing', () => {
      let engine;

      before('create a audio-video session', () => handleErrorEvent(new WebRTCMediaEngine(), (e) => {
        engine = e;
        engine.setMedia('audio', 'sendrecv');
        engine.setMedia('video', 'sendrecv');

        setupRemotePeerConnection();
        return engine.createOffer()
          .then(simulateAnswer)
          .then((answer) => Promise.all([
            expectEvent(20000, 'track', engine),
            engine.acceptAnswer(answer)
          ]));
      }));

      step('adds a screenshare stream', () =>
        handleErrorEvent(engine, () => Promise.resolve()
          .then(() => engine.logger.info('adding screenshare'))
          .then(Promise.all([
            engine.setMedia('screen', 'sendonly'),
            expectEvent(
              3000, 'negotiationneeded', engine,
              'We should receive a negotitation event when we change screen to sendonly'
            )
          ]))
          .then(() => engine.createOffer())
          .then((offer) => {
            // As of FF59, setting sendonly leaves the sdp at sendrecv for the offer
            assert.equal(getMediaDirectionFromSDP('screen', offer), 'sendrecv');
            return offer;
          })
          .then(simulateAnswer)
          .then((answer) => {
            assert.equal(getMediaDirectionFromSDP('screen', answer), 'recvonly');
            return answer;
          })
          .then((answer) => engine.acceptAnswer(answer))
          .then(() => {
            assert.lengthOf(engine.pc.getSenders().filter((s) => s.track && s.track.kind === 'video'), 2);
            assert.lengthOf(engine.pc.getSenders().filter((s) => s.track && s.track.kind === 'audio'), 1);
          })));

      step('removes the screenshare stream', () => handleErrorEvent(engine, () => {
        engine.setMedia('screen', 'inactive');
        return engine.createOffer()
          .then((offer) => {
            if (engine.localScreenShare) {
              assert.isEmpty(engine.localScreenShare.getVideoTracks());
            }
            assert.equal(getMediaDirectionFromSDP('screen', offer), 'inactive');
            return offer;
          })
          .then(simulateAnswer)
          .then((answer) => {
            if (engine.localScreenShare) {
              assert.isEmpty(engine.localScreenShare.getVideoTracks());
            }
            assert.equal(getMediaDirectionFromSDP('screen', answer), 'inactive');
            return answer;
          })
          .then((answer) => engine.acceptAnswer(answer))
          .then(() => {
            if (engine.localScreenShare) {
              assert.isEmpty(engine.localScreenShare.getVideoTracks());
            }
            assert.lengthOf(engine.pc.getSenders().filter((s) => s.track && s.track.kind === 'video'), 1);
            assert.lengthOf(engine.pc.getSenders().filter((s) => s.track && s.track.kind === 'audio'), 1);
          });
      }));

      step('adds back a screenshare stream', () => handleErrorEvent(engine, () => {
        if (engine.localScreenShare) {
          assert.isEmpty(engine.localScreenShare.getVideoTracks());
        }
        assert.lengthOf(engine.pc.getSenders().filter((s) => s.track && s.track.kind === 'video'), 1);
        assert.lengthOf(engine.pc.getSenders().filter((s) => s.track && s.track.kind === 'audio'), 1);

        engine.setMedia('screen', 'sendonly');

        assert.lengthOf(engine.pc.getSenders().filter((s) => s.track && s.track.kind === 'video'), 1);
        assert.lengthOf(engine.pc.getSenders().filter((s) => s.track && s.track.kind === 'audio'), 1);

        return engine.createOffer()
          .then((offer) => {
            assert.lengthOf(engine.pc.getSenders().filter((s) => s.track && s.track.kind === 'audio'), 1, 'There should be an audio sender after creating the offer');
            assert.isTrue(engine.pc.getSenders().find((s) => s.track && s.track.kind === 'audio').track.enabled, 'The audio sender should be enabled');
            assert.lengthOf(engine.pc.getSenders().filter((s) => s.track && s.track.kind === 'video'), 2, 'There should be 2 video senders after creating the offer');
            assert.isTrue(engine.pc.getSenders().filter((s) => s.track && s.track.kind === 'video')[0].track.enabled, 'The video sender should be enabled');
            assert.isTrue(engine.pc.getSenders().filter((s) => s.track && s.track.kind === 'video')[1].track.enabled, 'The screenshare sender should be enabled');

            // As of FF59, setting sendonly leaves the sdp at sendrecv for the offer
            assert.equal(getMediaDirectionFromSDP('audio', offer), 'sendrecv');
            assert.equal(getMediaDirectionFromSDP('video', offer), 'sendrecv');
            assert.equal(getMediaDirectionFromSDP('screen', offer), 'sendrecv');
            return offer;
          })
          .then(simulateAnswer)
          .then((answer) => {
            assert.equal(getMediaDirectionFromSDP('screen', answer), 'recvonly');
            return answer;
          })
          .then((answer) => engine.acceptAnswer(answer))
          .then(() => {
            assert.lengthOf(engine.pc.getSenders().filter((s) => s.track && s.track.kind === 'video'), 2);
            assert.lengthOf(engine.pc.getSenders().filter((s) => s.track && s.track.kind === 'audio'), 1);
          });
      }));
    });
  });
});

function assertLocalKind(kind, direction, engine) {
  if (engine.localMediaStream) {
    const tracks = engine.localMediaStream.getTracks().filter((t) => t.kind === kind);
    if (direction.includes('send')) {
      assert.lengthOf(tracks, 1, `there is 1 local ${kind} track`);
      assert.isTrue(tracks[0].enabled, `the local ${kind} track is enabled`);
    }
    else {
      try {
        assert.lengthOf(tracks, 0, `there are 0 local ${kind} tracks`);
      }
      catch (err) {
        assert.lengthOf(tracks, 1, `there is 1 local ${kind} track`);
        assert.isFalse(tracks[0].enabled, `the local ${kind} track is not enabled`);
      }
    }
  }

  const senders = engine.pc.getSenders().filter((s) => s.track && s.track.kind === kind && s.track.enabled === true);
  senders.forEach((s) => console.log(`assertLocal Senders ${s.track.kind} ${s.track.id} ${s.track.enabled}`));
  if (direction.includes('send')) {
    assert.lengthOf(senders, 1, `local ${kind} is ${direction}`);
    assert.isTrue(senders[0].track.enabled, `local ${kind} is ${direction}`);
  }
  else {
    try {
      assert.lengthOf(senders, 0, `there are 0 ${kind} senders`);
    }
    catch (err) {
      assert.lengthOf(senders, 1, `local ${kind} is ${direction}`);
      assert.isFalse(senders[0].track.enabled, `local ${kind} is ${direction}`);
    }
  }
}

function assertRemoteKind(kind, direction, engine) {
  const receivers = engine.pc.getReceivers().filter((r) => r.track && r.track.kind === kind);
  const enabled = receivers.filter((r) => r.track.enabled);
  receivers.forEach((s) => console.log(`assertRemote Receivers ${s.track.kind} ${s.track.id} ${s.track.enabled}`));

  if (direction.includes('recv')) {
    assert.isDefined(receivers, 'the peer connection has receiver tracks');

    try {
      assert.lengthOf(receivers, 1, `there is 1 remote ${kind} track`);
      assert.isTrue(enabled.length > 0, `the remote ${kind} track is enabled`);
    }
    catch (err) {
      assert.lengthOf(enabled, 1, 'There is a remote stream');
      assert.lengthOf(receivers, 1, `There is 1 ${kind} track in the remote stream`);
      assert.isTrue(!!enabled.length, `The is ${kind} track in the remote stream is enabled`);
    }
  }
  else {
    try {
      assert.lengthOf(receivers, 0, `there are 0 ${kind} receivers`);
    }
    catch (err) {
      assert.lengthOf(receivers, 1, `there is 1 ${kind} receivers`);
      assert.isFalse(receivers.filter((r) => r.track.direction === direction)
        .reduce((acc, r) => acc || r.track.enabled, false), `the remote ${kind} receiver's track is not enabled`);
    }
  }
}

function assertLocalMedia(engine, targetAudioDirection, targetVideoDirection) {
  assertLocalKind('audio', targetAudioDirection, engine);
  assertLocalKind('video', targetVideoDirection, engine);
}

function assertRemoteMedia(engine, targetAudioDirection, targetVideoDirection) {
  assertRemoteKind('audio', targetAudioDirection, engine);
  assertRemoteKind('video', targetVideoDirection, engine);
}

function assertOffer(kind, currentDirection, previousDirection, offer) {
  const sdpDirection = getMediaDirectionFromSDP(kind, offer);

  const fallbackDirection = getExpectedMediaDirection(currentDirection, previousDirection);
  const media = getMediaFromSDP(kind, offer, currentDirection);
  // Don't wire up the fallback assertion if it wouldn't do any good (this helps
  // with line numbers)
  if (fallbackDirection === currentDirection) {
    if (currentDirection === 'inactive') {
      // Chrome and firefox behave differently with inactive media.
      // We can use the result from getMediaDirectionFromSDP instead of getMediaFromSDP
      // for inactive direction.
      assert.equal(sdpDirection, currentDirection, `expected "${kind}" offer to include "${currentDirection}"`);
    }
    else {
      // Since getMediaDirectionFromSDP doesn't support multiple media sections in sdp,
      // we use getMediaFromSDP to find the appropriate section
      assert.isDefined(media, `expected "${kind}" offer to be "${currentDirection}"`);
    }
    return;
  }

  try {
    if (currentDirection === 'inactive') {
      assert.equal(sdpDirection, currentDirection, `expected "${kind}" offer to include "${currentDirection}"`);
    }
    else {
      assert.isDefined(media, `expected "${kind}" offer to have "${currentDirection}"`);
    }
  }
  catch (err) {
    assert.equal(sdpDirection, fallbackDirection, `expected "${kind}" offer to include "${currentDirection}" or "${fallbackDirection}"`);
  }
}

function assertAnswer(kind, currentDirection, previousDirection, answer) {
  const sdpDirection = getMediaDirectionFromSDP(kind, answer);

  const currentAnswerDirection = reverseMediaDirection(currentDirection);
  const fallbackDirection = reverseMediaDirection(getExpectedMediaDirection(currentDirection, previousDirection));

  const media = getMediaFromSDP(kind, answer, currentAnswerDirection);

  // Don't wire up the fallback assertion if it wouldn't do any good (this helps
  // with line numbers)
  if (currentAnswerDirection === fallbackDirection) {
    if (currentAnswerDirection === 'inactive') {
      // Chrome and firefox behave differently with inactive media.
      // We can use the result from getMediaDirectionFromSDP instead of getMediaFromSDP
      // for inactive direction.
      assert.equal(sdpDirection, currentAnswerDirection, `expected "${kind}" answer to include "${currentAnswerDirection}"`);
    }
    else {
      // Since getMediaDirectionFromSDP doesn't support multiple media sections in sdp,
      // we use getMediaFromSDP to find the appropriate section

      assert.isDefined(media, `expected "${kind}" answer to have "${currentAnswerDirection}"`);
    }
    return;
  }

  try {
    if (currentAnswerDirection === 'inactive') {
      assert.equal(sdpDirection, currentAnswerDirection, `expected "${kind}" answer to include "${currentAnswerDirection}"`);
    }
    else {
      assert.isDefined(media, `expected "${kind}" answer to have "${currentAnswerDirection}"`);
    }
  }
  catch (err) {
    assert.equal(sdpDirection, fallbackDirection, `expected "${kind}" answer to include "${currentAnswerDirection}" or "${fallbackDirection}"`);
  }
}

function assertSpyCalledOrNot(expectCall, spy) {
  if (expectCall) {
    assert.called(spy);
  }
  else {
    assert.notCalled(spy);
  }
}
