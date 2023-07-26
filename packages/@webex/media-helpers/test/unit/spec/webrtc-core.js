import {assert, expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {
  LocalCameraTrack,
  LocalMicrophoneTrack,
  LocalMicrophoneTrackEvents,
  LocalCameraTrackEvents,
  LocalDisplayTrack,
  LocalSystemAudioTrack,
  createCameraTrack,
  createMicrophoneTrack,
  createDisplayTrack,
  createDisplayTrackWithAudio,
} from '../../../src/webrtc-core';
import * as wcmetracks from '@webex/internal-media-core';

describe('media-helpers', () => {
  describe('webrtc-core', () => {
    const classesToTest = [
      {
        className: LocalCameraTrack,
        title: 'LocalCameraTrack',
        event: LocalCameraTrackEvents,
        createFn: createCameraTrack,
        spyFn: 'createCameraTrack',
      },
      {
        className: LocalMicrophoneTrack,
        title: 'LocalMicrophoneTrack',
        event: LocalMicrophoneTrackEvents,
        createFn: createMicrophoneTrack,
        spyFn: 'createMicrophoneTrack',
      },
    ];

    classesToTest.forEach(({className, title, event, createFn, spyFn}) =>
      describe(title, () => {
        const fakeStream = {
          getTracks: sinon.stub().returns([
            {
              label: 'fake track',
              id: 'fake track id',
              enabled: true,
            },
          ]),
        };
        const track = new className(fakeStream);

        afterEach(() => {
          sinon.restore();
        });

        it('by default allows unmuting', async () => {
          assert.equal(track.isUnmuteAllowed(), true);
          await track.setMuted(false);
        });

        it('rejects setMute(false) if unmute is not allowed', async () => {
          track.setUnmuteAllowed(false);

          assert.equal(track.isUnmuteAllowed(), false);
          const fn = () => track.setMuted(false);
          expect(fn).to.throw(/Unmute is not allowed/);
        });

        it('resolves setMute(false) if unmute is allowed', async () => {
          track.setUnmuteAllowed(true);

          assert.equal(track.isUnmuteAllowed(), true);
          await track.setMuted(false);
        });

        describe('#setServerMuted', () => {
          afterEach(() => {
            sinon.restore();
          });

          const checkSetServerMuted = async (startMute, setMute, expectedCalled) => {
            await track.setMuted(startMute);

            assert.equal(track.muted, startMute);

            const handler = sinon.fake();
            track.on(event.ServerMuted, handler);

            await track.setServerMuted(setMute, 'remotelyMuted');

            assert.equal(track.muted, setMute);
            if (expectedCalled) {
              assert.calledOnceWithExactly(handler, {muted: setMute, reason: 'remotelyMuted'});
            } else {
              assert.notCalled(handler);
            }
          };

          it('tests true to false', async () => {
            await checkSetServerMuted(true, false, true);
          });

          it('tests false to true', async () => {
            await checkSetServerMuted(false, true, true);
          });

          it('tests true to true', async () => {
            await checkSetServerMuted(true, true, false);
          });

          it('tests false to false', async () => {
            await checkSetServerMuted(false, false, false);
          });
        });

        describe('#wcmeCreateMicrophoneTrack, #wcmeCreateCameraTrack', () => {
          it('checks creating tracks', async () => {
            const constraints = {devideId: 'abc'};

            const spy = sinon.stub(wcmetracks, spyFn).returns('something');
            const result = createFn(constraints);

            assert.equal(result, 'something');
            assert.calledOnceWithExactly(spy, className, constraints);
          });
        });
      })
    );

    describe('createDisplayTrack', () => {
      it('checks createDisplayTrack', async () => {
        const spy = sinon.stub(wcmetracks, 'createDisplayTrack').returns('something');
        const result = createDisplayTrack();
        assert.equal(result, 'something');
        assert.calledOnceWithExactly(spy, LocalDisplayTrack);
      });

      it('checks createDisplayTrack getAnnotationInfo and setAnnotationInfo', () => {
        const fakeStream = {
          getTracks: sinon.stub().returns([
            {
              label: 'fake track',
              id: 'fake track id',
              enabled: true,
            },
          ]),
        };
        const localDisplayTrack = new LocalDisplayTrack(fakeStream);
        localDisplayTrack.setAnnotationInfo("annotation Info")
        assert.equal(localDisplayTrack.getAnnotationInfo(), 'annotation Info');

      });
    });

    describe('createDisplayTrackWithAudio', () => {
      it('checks createDisplayTrackWithAudio', async () => {
        const spy = sinon.stub(wcmetracks, 'createDisplayTrackWithAudio').returns('something');
        const result = createDisplayTrackWithAudio();
        assert.equal(result, 'something');
        assert.calledOnceWithExactly(spy, LocalDisplayTrack, LocalSystemAudioTrack);
      });
    });
  });
});
