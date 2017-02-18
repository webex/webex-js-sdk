import {getUserMedia} from '../../../src/webrtc';

describe(`plugin-phone`, () => {
  describe(`webrtc`, () => {
    describe.only(`getUserMedia()`, () => {
      it(`does not hang`, () => getUserMedia({
        audio: true,
        video: true,
        fake: true
      }));
    });
  });
});
