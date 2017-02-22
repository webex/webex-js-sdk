import sinon from '@ciscospark/test-helper-sinon';
import {assert} from '@ciscospark/test-helper-chai';
import {WebRTCMedia} from '../..';
import {parse} from 'sdp-transform';
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
            assert.equal(m.peer.signalingState, `stable`);
            // TODO assert remote stream
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

                  return m.createOffer()
                    .then(mockAnswer)
                    .then((answer) => m.acceptAnswer(answer))
                    .then(() => {
                      const p = Promise.race([
                        new Promise((resolve) => setTimeout(resolve, 1000)),
                        new Promise((resolve) => m.once(`renegotiationneeded`, resolve))
                      ]);
                      m.toggle(mediaType);
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

                      // TODO need assertions for sending/receving
                      return p;
                    })
                    .then(() => assert[shouldRenegotiate ? `called` : `notCalled`](negSpy))
                    .then(() => assert.isBelow(m.peer.getLocalStreams().length, 2));
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
