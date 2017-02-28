import sinon from '@ciscospark/test-helper-sinon';
import handleErrorEvent from '../../integration/lib/handle-error-event';
import {assert} from '@ciscospark/test-helper-chai';
import {WebRTCMedia} from '../..';

function maxWaitForEvent(max, event, emitter) {
  return Promise.race([
    new Promise((resolve) => setTimeout(resolve, 1000)),
    new Promise((resolve) => emitter.once(event, resolve))
  ]);
}

let pc;
function mockAnswer(offer) {
  pc = new RTCPeerConnection();
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
    fake: true
  })
    .then((stream) => {
      pc.addStream(stream);
    })
    .then(() => pc.setRemoteDescription({type: `offer`, sdp: offer}))
    .then(() => pc.createAnswer())
    .then((answer) => answer.sdp);
}
describe(`plugin-phone`, () => {
  describe(`WebRTCMedia`, () => {
    let negSpy;
    let m;
    beforeEach(() => {
      negSpy = sinon.spy();
      m = new WebRTCMedia();
      m.on(`negotiationneeded`, negSpy);
    });

    describe(`#acceptAnswer()`, () => {
      it(`accepts an answer`, () => {
        m.set({
          audio: true,
          offerToReceiveAudio: true,
          video: true,
          offerToReceiveVideo: true
        });

        return m.createOffer()
          .then(mockAnswer)
          .then((answer) => m.acceptAnswer(answer))
          .then(() => {
            const p = maxWaitForEvent(1000, `change:remoteMediaStream`, m);
            assert.equal(m.peer.signalingState, `stable`);
            return p;
          })
          .then(() => {
            assert.property(m, `remoteMediaStream`);
            assert.instanceOf(m.remoteMediaStream, MediaStream);
          });
      });
    });

    describe(`sending media state changes`, () => {
      [
        `audio`,
        `video`
      ]
        .forEach((mediaType) => {
          [
            [true, true, false],
            [true, false, false],
            [false, true, true],
            [false, false, true]
          ].forEach(([sending, receiving, shouldRenegotiate]) => {
            describe(`when ${mediaType} is toggled`, () => {
              describe(`when ${mediaType} is sending: ${sending} and receiving: ${receiving}`, () => {
                it(`${shouldRenegotiate ? `triggers` : `does not trigger`} renegotiation`, () => {
                  assert.notCalled(negSpy);
                  if (mediaType === `audio`) {
                    m.set({
                      audio: sending,
                      offerToReceiveAudio: receiving,
                      video: true,
                      offerToReceiveVideo: true
                    });
                  }
                  else {
                    m.set({
                      audio: true,
                      offerToReceiveAudio: true,
                      video: sending,
                      offerToReceiveVideo: receiving
                    });
                  }
                  assert.notCalled(negSpy);

                  return handleErrorEvent(m, () => m.createOffer()
                    .then(mockAnswer)
                    .then((answer) => m.acceptAnswer(answer))
                    .then(() => {
                      assert.lengthOf(m.peer.getLocalStreams(), 1);
                      assert.equal(m[mediaType === `audio` ? `sendingAudio` : `sendingVideo`], sending, `sending${mediaType === `audio` ? `Audio` : `Video`} is in the initial state of ${sending}`);
                      const p = maxWaitForEvent(1000, `renegotiationneeded`, m);
                      m.toggle(mediaType);
                      assert.lengthOf(m.peer.getLocalStreams(), 1);

                      m.peer.getLocalStreams().forEach((stream) => {
                        stream.getTracks().forEach((track) => {
                          if (track.kind === mediaType) {
                            // when you look at this and think the assertion is
                            // backwards, remember that `sending` is the state
                            // we're asserting we've left
                            assert[sending ? `isFalse` : `isTrue`](track.enabled);
                          }
                        });
                      });

                      if (sending) {
                        // We want to stop the stream as soon as the user asks us to
                        return Promise.all([
                          p,
                          new Promise((resolve) => process.nextTick(() => {
                            // Yes, it says synchronously, but one tick is close
                            // enough; there's a promise.then in there
                            // somewhere.
                            assert.isFalse(m[mediaType === `audio` ? `sendingAudio` : `sendingVideo`], `sending${mediaType === `audio` ? `Audio` : `Video`} has synchronously left the initial state`);
                            resolve();
                          }))
                        ]);
                      }

                      return Promise.all([
                        p,
                        maxWaitForEvent(1000, `change:sending${mediaType === `audio` ? `Audio` : `Video`}`, m)
                          .then(() => assert.isTrue(m[mediaType === `audio` ? `sendingAudio` : `sendingVideo`], `sending${mediaType === `audio` ? `Audio` : `Video`} has (possibly asynchronously) left the initial state`))
                      ]);
                    })
                    .then(() => assert[shouldRenegotiate ? `called` : `notCalled`](negSpy))
                    .then(() => assert.isBelow(m.peer.getLocalStreams().length, 2)));
                });
              });
            });
          });
        });
    });

    describe(`receiving media state changes`, () => {
      [
        `Audio`,
        `Video`
      ]
        .forEach((mediaType) => {
          [
            [true, true, true],
            [true, false, true],
            [false, true, true],
            [false, false, true]
          ].forEach(([sending, receiving, shouldRenegotiate]) => {
            describe(`when offerToReceive${mediaType} is toggled`, () => {
              describe(`when ${mediaType} is sending: ${sending} and receiving: ${receiving}`, () => {
                it(`${shouldRenegotiate ? `triggers` : `does not trigger`} renegotiation`, () => {
                  assert.notCalled(negSpy);
                  if (mediaType === `Audio`) {
                    m.set({
                      audio: sending,
                      offerToReceiveAudio: receiving,
                      video: true,
                      offerToReceiveVideo: true
                    });
                  }
                  else {
                    m.set({
                      audio: true,
                      offerToReceiveAudio: true,
                      video: sending,
                      offerToReceiveVideo: receiving
                    });
                  }
                  assert.notCalled(negSpy);

                  return m.createOffer()
                    .then(mockAnswer)
                    .then((answer) => m.acceptAnswer(answer))
                    .then(() => {
                      const p = Promise.race([
                        new Promise((resolve) => setTimeout(resolve, 1000)),
                        new Promise((resolve) => m.once(`renegotiationneeded`, resolve))
                      ]);
                      m.toggle(`offerToReceive${mediaType}`);
                      return p;
                    })
                    .then(() => assert[shouldRenegotiate ? `called` : `notCalled`](negSpy))
                    // TODO need assertions for sending/receving
                    .then(() => console.log(`renegotiationneeded call count`, negSpy.callCount));
                });
              });
            });
          });
        });
    });

  });
});
