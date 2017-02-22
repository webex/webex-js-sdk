import {assert} from '@ciscospark/test-helper-chai';
import {Media} from '../..';
import {parse} from 'sdp-transform';

const pcs = new WeakMap();
class MockServer {
  get pc() {
    let pc = pcs.get(this);
    if (!pc) {
      pc = new RTCPeerConnection();
      pcs.set(this, pc);
    }
    return pc;
  }

  answer(offer) {
    return this.pc.setRemoteDescription({type: `offer`, sdp: offer})
      .then(() => this.pc.createAnswer())
      .then((answer) => answer.sdp);
  }
}


function answer(offer) {
  const m = new MockServer();
  return m.answer(offer);
}

/* eslint no-multi-spaces: 0 */
/* eslint array-bracket-spacing: 0 */

// Use this truth table once we eliminate needless renegotiations
// const stateToContraints = [
//   [false, false, false, false, false, false, false, false],
//   [false, false, false,  true, false, false,  true,  true],
//   [false, false,  true, false, false, false,  true, false],
//   [false, false,  true,  true, false, false,  true,  true],
//   [false,  true, false, false,  true,  true, false, false],
//   [false,  true, false,  true,  true,  true,  true,  true],
//   [false,  true,  true, false,  true,  true,  true, false],
//   [false,  true,  true,  true,  true,  true,  true,  true],
//   [ true, false, false, false,  true, false, false, false],
//   [ true, false, false,  true,  true, false,  true,  true],
//   [ true, false,  true, false,  true, false,  true, false],
//   [ true, false,  true,  true,  true, false,  true,  true],
//   [ true,  true, false, false,  true,  true, false, false],
//   [ true,  true, false,  true,  true,  true,  true,  true],
//   [ true,  true,  true, false,  true,  true,  true, false],
//   [ true,  true,  true,  true,  true,  true,  true,  true]
// ]
const stateToContraints = [
  // [sendingAudio, receivingAudio, sendingVideo, receivingVideo, audio, offerToReceiveAudio, video, offerToReceiveVideo]
  [false, false, false, false, false, false, false, false],
  [false, false, false,  true, false, false, false,  true],
  [false, false,  true, false, false, false,  true, false],
  [false, false,  true,  true, false, false,  true,  true],
  [false,  true, false, false, false,  true, false, false],
  [false,  true, false,  true, false,  true, false,  true],
  [false,  true,  true, false, false,  true,  true, false],
  [false,  true,  true,  true, false,  true,  true,  true],
  [ true, false, false, false,  true, false, false, false],
  [ true, false, false,  true,  true, false, false,  true],
  [ true, false,  true, false,  true, false,  true, false],
  [ true, false,  true,  true,  true, false,  true,  true],
  [ true,  true, false, false,  true,  true, false, false],
  [ true,  true, false,  true,  true,  true, false,  true],
  [ true,  true,  true, false,  true,  true,  true, false],
  [ true,  true,  true,  true,  true,  true,  true,  true]
];

// Use this truth table once we eliminate needless renegotiations
// const localMediaDirections = [
//   // [false, false, false, false, `inactive`, `inactive`],
//   [false, false, false,  true, `inactive`, `sendrecv`],
//   [false, false,  true, false, `inactive`, `sendonly`],
//   [false, false,  true,  true, `inactive`, `sendrecv`],
//   [false,  true, false, false, `sendrecv`, `inactive`],
//   [false,  true, false,  true, `sendrecv`, `sendrecv`],
//   [false,  true,  true, false, `sendrecv`, `sendonly`],
//   [false,  true,  true,  true, `sendrecv`, `sendrecv`],
//   [ true, false, false, false, `sendonly`, `inactive`],
//   [ true, false, false,  true, `sendonly`, `sendrecv`],
//   [ true, false,  true, false, `sendonly`, `sendonly`],
//   [ true, false,  true,  true, `sendonly`, `sendrecv`],
//   [ true,  true, false, false, `sendrecv`, `inactive`],
//   [ true,  true, false,  true, `sendrecv`, `sendrecv`],
//   [ true,  true,  true, false, `sendrecv`, `sendonly`],
//   [ true,  true,  true,  true, `sendrecv`, `sendrecv`]
// ]

const localMediaDirections = [
  // [sendingAudio, receivingAudio, sendingVideo, receivingVideo, audioDirection, videoDirection]
  // [false, false, false, false, `inactive`, `inactive`],
  [false, false, false,  true, `inactive`, `recvonly`],
  [false, false,  true, false, `inactive`, `sendonly`],
  [false, false,  true,  true, `inactive`, `sendrecv`],
  [false,  true, false, false, `recvonly`, `inactive`],
  [false,  true, false,  true, `recvonly`, `recvonly`],
  [false,  true,  true, false, `recvonly`, `sendonly`],
  [false,  true,  true,  true, `recvonly`, `sendrecv`],
  [ true, false, false, false, `sendonly`, `inactive`],
  [ true, false, false,  true, `sendonly`, `recvonly`],
  [ true, false,  true, false, `sendonly`, `sendonly`],
  [ true, false,  true,  true, `sendonly`, `sendrecv`],
  [ true,  true, false, false, `sendrecv`, `inactive`],
  [ true,  true, false,  true, `sendrecv`, `recvonly`],
  [ true,  true,  true, false, `sendrecv`, `sendonly`],
  [ true,  true,  true,  true, `sendrecv`, `sendrecv`]
];

describe(`plugin-phone`, () => {
  describe.only(`Media`, () => {
    let mock;
    beforeEach(() => {
      mock = new MockServer();
    });

    it(`maps desired media state to constraints`, () => {
      stateToContraints.map(([sendingAudio, receivingAudio, sendingVideo, receivingVideo, audio, offerToReceiveAudio, video, offerToReceiveVideo]) => {
        return {
          input: {
            sendingAudio, receivingAudio, sendingVideo, receivingVideo
          },
          constraints: {
            audio, video
          },
          offerOptions: {
            offerToReceiveAudio, offerToReceiveVideo
          }
        };
      })
      .forEach(({input, constraints, offerOptions}) => {
        const media = new Media();
        media.set(input);
        assert.deepEqual(media.constraints, constraints);
        assert.deepEqual(media.offerOptions, offerOptions);
      });
    });

    describe(`#createOffer()`, () => {
      localMediaDirections.forEach(([sendingAudio, receivingAudio, sendingVideo, receivingVideo, audioDirection, videoDirection]) => {
        describe(`when sendingAudio is ${sendingAudio}`, () => {
          describe(`when receivingAudio is ${receivingAudio}`, () => {
            describe(`when sendingVideo is ${sendingVideo}`, () => {
              describe(`when receivingVideo is ${receivingVideo}`, () => {
                it(`produces an offer with audio ${audioDirection} and video ${videoDirection}`, () => {
                  const media = new Media();
                  media.set({sendingAudio, receivingAudio, sendingVideo, receivingVideo});
                  return media.createOffer()
                    .then((offer) => {
                      const sdp = parse(offer);

                      const audio = sdp.media.find((item) => item.type === `audio`);
                      if (audio) {
                        assert.equal(audio.direction, audioDirection, `Audio directions should match`);
                      }
                      else {
                        assert.equal(audioDirection, `inactive`);
                      }
                      // assert.equal(media.localAudioDirection, audioDirection);

                      const video = sdp.media.find((item) => item.type === `video`);
                      if (video) {
                        assert.equal(video.direction, videoDirection, `Video directions should match`);
                      }
                      else {
                        assert.equal(videoDirection, `inactive`);
                      }
                      assert.equal(media.localVideoDirection, videoDirection);
                    });
                });
              });
            });
          });
        });
      });
    });

    describe(`#acceptAnswer()`, () => {
      it(`accepts an answer`, () => {
        const media = new Media();

        media.set({
          sendingAudio: true,
          receivingAudio: true,
          sendingVideo: true,
          receivingVideo: true
        });

        return media.createOffer()
          .then((offer) => mock.answer(offer))
          .then((answer) => media.acceptAnswer(answer));
      });
    });

    describe(`#renegotiate`, () => {
      it(`becomes false when renegotiation completes`, () => {
        const media = new Media();

        media.set({
          sendingAudio: true,
          receivingAudio: true,
          sendingVideo: true,
          receivingVideo: true
        });
        return media.createOffer()
          .then((offer) => mock.answer(offer))
          .then((answer) => media.acceptAnswer(answer))
          .then(() => {
            assert.isFalse(media.renegotiate, `renegotiate is false after initial negotiation`);

            const promise = new Promise((resolve) => {
              media.once(`change:renegotiate`, resolve);
            })
              .then(() => assert.isTrue(media.renegotiate, `renegotiate is true when the change event fires`))
              .then(() => media.createOffer())
              .then(answer)
              .then((answer) => media.acceptAnswer(answer))
              .then(() => {
                assert.isFalse(media.renegotiate, `renegotiate is false once a new answer is received`);
              });

            media.toggleSendingAudio();

            assert.isTrue(media.renegotiate, `renegotiate is true after toggling audio`);
            return promise;
          });
      });
    });

    [
      [`Sending`, `Audio`,  true,  true,  true,  true,  true, true],
      [`Sending`, `Audio`,  true,  true,  true, false,  true, true],
      [`Sending`, `Audio`,  true,  true, false,  true,  true, true],
      [`Sending`, `Audio`,  true,  true, false, false,  true, true],
      [`Sending`, `Audio`,  true, false,  true,  true,  true, true],
      [`Sending`, `Audio`,  true, false,  true, false,  true, true],
      [`Sending`, `Audio`,  true, false, false,  true,  true, true],
      [`Sending`, `Audio`,  true, false, false, false,  true, true],
      [`Sending`, `Audio`, false,  true,  true,  true,  true, false],
      [`Sending`, `Audio`, false,  true,  true, false,  true, false],
      [`Sending`, `Audio`, false,  true, false,  true,  true, false],
      [`Sending`, `Audio`, false,  true, false, false,  true, false],
      [`Sending`, `Audio`, false, false,  true,  true,  true, false],
      [`Sending`, `Audio`, false, false,  true, false,  true, false],
      [`Sending`, `Audio`, false, false, false,  true,  true, false],
      // CAN NEVER HAPPEN [`Sending`, `Audio`, false, false, false, false,  true, true]
      [`Sending`, `Video`,  true,  true,  true,  true,  true, true],
      [`Sending`, `Video`,  true,  true,  true, false,  true, true],
      [`Sending`, `Video`,  true,  true, false,  true,  true, false],
      [`Sending`, `Video`,  true,  true, false, false,  true, false],
      [`Sending`, `Video`,  true, false,  true,  true,  true, true],
      [`Sending`, `Video`,  true, false,  true, false,  true, true],
      [`Sending`, `Video`,  true, false, false,  true,  true, false],
      [`Sending`, `Video`,  true, false, false, false,  true, false],
      [`Sending`, `Video`, false,  true,  true,  true,  true, true],
      [`Sending`, `Video`, false,  true,  true, false,  true, true],
      [`Sending`, `Video`, false,  true, false,  true,  true, false],
      [`Sending`, `Video`, false,  true, false, false,  true, false],
      [`Sending`, `Video`, false, false,  true,  true,  true, true],
      [`Sending`, `Video`, false, false,  true, false,  true, true],
      [`Sending`, `Video`, false, false, false,  true,  true, false],
      // CAN NEVER HAPPEN [`Sending`, `Video`, false, false, false, false,  true]
      [`Receiving`, `Audio`,  true,  true,  true,  true,  true, true],
      [`Receiving`, `Audio`,  true,  true,  true, false,  true, true],
      [`Receiving`, `Audio`,  true,  true, false,  true,  true, true],
      [`Receiving`, `Audio`,  true,  true, false, false,  true, true],
      [`Receiving`, `Audio`,  true, false,  true,  true,  true, true],
      [`Receiving`, `Audio`,  true, false,  true, false,  true, true],
      [`Receiving`, `Audio`,  true, false, false,  true,  true, true],
      [`Receiving`, `Audio`,  true, false, false, false,  true, true],
      [`Receiving`, `Audio`, false,  true,  true,  true,  true, true],
      [`Receiving`, `Audio`, false,  true,  true, false,  true, true],
      [`Receiving`, `Audio`, false,  true, false,  true,  true, true],
      [`Receiving`, `Audio`, false,  true, false, false,  true, true],
      [`Receiving`, `Audio`, false, false,  true,  true,  true, true],
      [`Receiving`, `Audio`, false, false,  true, false,  true, true],
      [`Receiving`, `Audio`, false, false, false,  true,  true, true],
      // CAN NEVER HAPPEN [`Receiving`, `Audio`, false, false, false, false,  true, true],
      [`Receiving`, `Video`,  true,  true,  true,  true,  true, true],
      [`Receiving`, `Video`,  true,  true,  true, false,  true, true],
      [`Receiving`, `Video`,  true,  true, false,  true,  true, true],
      [`Receiving`, `Video`,  true,  true, false, false,  true, true],
      [`Receiving`, `Video`,  true, false,  true,  true,  true, true],
      [`Receiving`, `Video`,  true, false,  true, false,  true, true],
      [`Receiving`, `Video`,  true, false, false,  true,  true, true],
      [`Receiving`, `Video`,  true, false, false, false,  true, true],
      [`Receiving`, `Video`, false,  true,  true,  true,  true, true],
      [`Receiving`, `Video`, false,  true,  true, false,  true, true],
      [`Receiving`, `Video`, false,  true, false,  true,  true, true],
      [`Receiving`, `Video`, false,  true, false, false,  true, true],
      [`Receiving`, `Video`, false, false,  true,  true,  true, true],
      [`Receiving`, `Video`, false, false,  true, false,  true, true],
      [`Receiving`, `Video`, false, false, false,  true,  true, true]
      // CAN NEVER HAPPEN [`Receiving`, `Video`, false, false, false, false,  true]
    ].forEach(([direction, media, sendingAudio, receivingAudio, sendingVideo, receivingVideo, renegotiate, synchronous]) => {
      describe(`#toggle${direction}${media}()`, () => {
        describe(`when sendingAudio is ${sendingAudio}`, () => {
          describe(`when receivingAudio is ${receivingAudio}`, () => {
            describe(`when sendingVideo is ${sendingVideo}`, () => {
              describe(`when receivingVideo is ${receivingVideo}`, () => {
                it(`${renegotiate ? `triggers` : `does not trigger`} renegotiation ${synchronous ? `synchronously` : ``}`, () => {
                  const m = new Media();
                  m.set({
                    sendingAudio,
                    receivingAudio,
                    sendingVideo,
                    receivingVideo
                  });

                  return m.createOffer()
                    .then((offer) => mock.answer(offer))
                    .then((answer) => m.acceptAnswer(answer))
                    .then(() => {
                      m[`toggle${direction}${media}`]();

                      // mute actions should be synchronous, that way the user
                      // can safely trust that as soon as they try to turn their
                      // camera or microphone off they can trust their privacy.
                      // if (synchronous) {
                      assert.equal(m.renegotiate, renegotiate);
                        // return Promise.resolve();
                      // }
                      //
                      // return new Promise((resolve) => {
                      //   m.on(`change:renegotiate`, resolve);
                      // });
                    });
                    // .then(() => assert.equal(m.renegotiate, renegotiate));
                });
              });
            });
          });
        });
      });
    });

    [
      [`Audio`,  true,  true, `sendonly`],
      [`Audio`,  true, false, `sendrecv`],
      [`Audio`, false,  true, `inactive`],
      [`Audio`, false, false, `recvonly`],
      [`Video`,  true,  true, `sendonly`],
      [`Video`,  true, false, `sendrecv`],
      [`Video`, false,  true, `inactive`],
      [`Video`, false, false, `recvonly`]
    ]
    .forEach(([media, sending, receiving, mediaDirection]) => {
      describe(`when receiving ${media} gets toggled`, () => {
        describe(`when sending${media} is ${sending}`, () => {
          describe(`when receiving${media} is ${receiving}`, () => {
            it(`renegotiates`, () => {
              const m = new Media();
              if (media === `Audio`) {
                m.set({
                  sendingAudio: sending,
                  receivingAudio: receiving,
                  sendingVideo: true,
                  receivingVideo: true
                });
              }

              if (media === `Video`) {
                m.set({
                  sendingAudio: true,
                  receivingAudio: true,
                  sendingVideo: sending,
                  receivingVideo: receiving
                });
              }

              return Promise.all([
                m.createOffer()
                  .then((offer) => mock.answer(offer))
                  .then((answer) => m.acceptAnswer(answer))
                  .then(() => m[`toggleReceiving${media}`]()),
                new Promise((resolve) => m.once(`change:renegotiate`, resolve))
                  .then(() => m.createOffer())
                  .then((offer) => {
                    assert.isFalse(m.renegotiate);
                    return answer(offer);
                  })
                  .then((answer) => m.acceptAnswer(answer))
              ])
                .then(() => {
                  assert.equal(media === `Audio` ? m.localAudioDirection : m.localVideoDirection, mediaDirection);
                });
            });
          });

        });
      });
    });
  });
});
