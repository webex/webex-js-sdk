import sinon from '@ciscospark/test-helper-sinon';
import handleErrorEvent from '../../integration/lib/handle-error-event';
import {assert} from '@ciscospark/test-helper-chai';
import {WebRTCMedia} from '../..';
import {parse} from 'sdp-transform';
import {find} from 'lodash';
import {skipInFirefox} from '@ciscospark/test-helper-mocha';

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
    .then((answer) => pc.setLocalDescription(answer)
      .then(() => answer.sdp));
}

function mockRenegotiate(offer) {
  const sdp = parse(offer);
  const audio = find(sdp.media, {type: `audio`}).direction.includes(`recv`);
  const video = find(sdp.media, {type: `video`}).direction.includes(`recv`);

  const hasAudio = !!pc.getLocalStreams()[0].getAudioTracks().length;
  const hasVideo = !!pc.getLocalStreams()[0].getVideoTracks().length;

  if (hasAudio && !audio) {
    pc.getLocalStreams()[0].getAudioTracks()[0].stop();
    pc.getLocalStreams()[0].removeTrack(pc.getLocalStreams()[0].getAudioTracks()[0]);
  }

  if (hasVideo && !video) {
    pc.getLocalStreams()[0].getVideoTracks()[0].stop();
    pc.getLocalStreams()[0].removeTrack(pc.getLocalStreams()[0].getVideoTracks()[0]);
  }

  let p;
  if (audio && !hasAudio || video && !hasVideo) {
    p = navigator.mediaDevices.getUserMedia({
      audio,
      video,
      fake: true
    })
      .then((newstream) => {
        newstream.getTracks().forEach((track) => {
          pc.getLocalStreams()[0].addTrack(track);
        });
      });
  }

  return Promise.resolve(p)
    .then(() => pc.setRemoteDescription({type: `offer`, sdp: offer}))
    .then(() => pc.createAnswer())
    .then((answer) => pc.setLocalDescription(answer)
      .then(() => answer.sdp));
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

    // So this sucks: as far as I can tell, Firefox doesn't honor
    // offerToReceiveAudio/offerToReceiveVideo when renegotiating. That said,
    // while frustrating, I think all this means is firefox will use extra
    // bandwith; everything should still *work*.
    skipInFirefox(describe)(`receiving media state changes`, () => {
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

                  return handleErrorEvent(m, () => m.createOffer()
                    .then(mockAnswer)
                    .then((answer) => m.acceptAnswer(answer))
                    .then(() => maxWaitForEvent(1000, `change:receiving${mediaType}`, m))
                    .then(() => {
                      assert.lengthOf(m.peer.getRemoteStreams(), 1);
                      assert.equal(m[`receiving${mediaType}`], receiving, `receiving${mediaType} is in the initial state of ${receiving}`);

                      const p = maxWaitForEvent(1000, `renegotiationneeded`, m);
                      m.toggle(`offerToReceive${mediaType}`);
                      assert.lengthOf(m.peer.getRemoteStreams(), 1);

                      m.peer.getRemoteStreams().forEach((stream) => {
                        assert.lengthOf(stream.getTracks().filter((track) => track.kind === mediaType.toLowerCase()), receiving ? 1 : 0);
                      });
                      return p;
                    })
                    .then(() => assert[shouldRenegotiate ? `called` : `notCalled`](negSpy))
                    .then(() => m.createOffer())
                    .then((offer) => {
                      const sdp = parse(offer);
                      const media = find(sdp.media, {type: mediaType.toLowerCase()});
                      const direction = media.direction;
                      // Reminder: this is after toggle, so `receiving` is the
                      // state we should have left by now.
                      assert[receiving ? `notInclude` : `include`](direction, `recv`);
                      return offer;
                    })
                    .then(mockRenegotiate)
                    .then((answer) => Promise.all([
                      m.acceptAnswer(answer),
                      maxWaitForEvent(1000, `change:receiving${mediaType}`, m)
                    ]))
                    .then(() => {
                      assert.notEqual(m[`receiving${mediaType}`], receiving, `receiving${mediaType} left the initial state of ${receiving}`);
                    }));
                });
              });
            });
          });
        });
    });

  });
});

// TODO figure out how to get renegotiation working in firefox
// TODO need a test for replacing the local media stream
