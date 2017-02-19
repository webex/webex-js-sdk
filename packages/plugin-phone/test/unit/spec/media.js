import {assert} from '@ciscospark/test-helper-chai';
import {Media} from '../..';
import {parse} from 'sdp-transform';


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
  });
});
