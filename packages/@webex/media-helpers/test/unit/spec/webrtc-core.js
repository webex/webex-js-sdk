import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {LocalCameraTrack, LocalMicrophoneTrack} from '@webex/media-helpers';

describe('media-helpers', () => {
  describe('webrtc-core', () => {

    const classesToTest = [
      {className: LocalCameraTrack, title: 'LocalCameraTrack'},
      {className: LocalMicrophoneTrack, title: 'LocalMicrophoneTrack'},
    ];

    classesToTest.forEach(({className, title}) =>
      describe(title, () => {
        const fakeStream = {
          getTracks: sinon.stub().returns([{
            label: 'fake track',
            id: 'fake track id',
          }])
        };
        const track = new className(fakeStream);

        it('by default allows unmuting', async () => {
          assert.equal(track.isUnmuteAllowed(), true);
          await track.setMuted(false);
        })

        it('rejects setMute(false) if unmute is not allowed', async () => {
          track.setUnmuteAllowed(false);

          assert.equal(track.isUnmuteAllowed(), false);
          await assert.isRejected(track.setMuted(false), Error, 'Unmute is not allowed');
        });

        it('resolves setMute(false) if unmute is allowed', async () => {
          track.setUnmuteAllowed(true);

          assert.equal(track.isUnmuteAllowed(), true);
          await track.setMuted(false);
        })

      })
    )
  });
});
