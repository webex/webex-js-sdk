import {assert, expect} from '@webex/test-helper-chai';
import sinon from 'sinon';

import * as wcmestreams from '@webex/internal-media-core';

import {
  LocalCameraStream,
  LocalMicrophoneStream,
  LocalMicrophoneStreamEventNames,
  LocalCameraStreamEventNames,
  LocalDisplayStream,
  LocalSystemAudioStream,
  createCameraStream,
  createMicrophoneStream,
  createDisplayStream,
  createDisplayStreamWithAudio,
} from '@webex/media-helpers';

describe('media-helpers', () => {
  describe('webrtc-core', () => {
    const classesToTest = [
      {
        className: LocalCameraStream,
        title: 'LocalCameraStream',
        event: LocalCameraStreamEventNames,
        createFn: createCameraStream,
        spyFn: 'createCameraStream',
      },
      {
        className: LocalMicrophoneStream,
        title: 'LocalMicrophoneStream',
        event: LocalMicrophoneStreamEventNames,
        createFn: createMicrophoneStream,
        spyFn: 'createMicrophoneStream',
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
              muted: false,
              addEventListener: sinon.stub(),
            },
          ]),
        };
        const stream = new className(fakeStream);

        afterEach(() => {
          sinon.restore();
        });

        it('by default allows unmuting', async () => {
          assert.equal(stream.isUnmuteAllowed(), true);
          await stream.setMuted(false);
        });

        it('rejects setMute(false) if unmute is not allowed', async () => {
          await stream.setUnmuteAllowed(false);

          assert.equal(stream.isUnmuteAllowed(), false);
          const fn = () => stream.setMuted(false);
          expect(fn).to.throw(/Unmute is not allowed/);
        });

        it('resolves setMute(false) if unmute is allowed', async () => {
          await stream.setUnmuteAllowed(true);

          assert.equal(stream.isUnmuteAllowed(), true);
          await stream.setMuted(false);
        });

        it('returns a reasonable length string from JSON.stringify()', () => {
          assert.isBelow(JSON.stringify(stream).length, 200);
        });

        describe('#setServerMuted', () => {
          afterEach(() => {
            sinon.restore();
          });

          const checkSetServerMuted = async (startMute, setMute, expectedCalled) => {
            await stream.setMuted(startMute);

            assert.equal(stream.muted, startMute);

            const handler = sinon.fake();
            stream.on(event.ServerMuted, handler);

            await stream.setServerMuted(setMute, 'remotelyMuted');

            assert.equal(stream.muted, setMute);
            if (expectedCalled) {
              assert.calledOnceWithExactly(handler, setMute, 'remotelyMuted');
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

        describe('#wcmeCreateMicrophoneStream, #wcmeCreateCameraStream', () => {
          it('checks creating tracks', async () => {
            const constraints = {deviceId: 'abc'};

            const spy = sinon.stub(wcmestreams, spyFn).returns('something');
            const result = await createFn(constraints);

            assert.equal(result, 'something');
            assert.calledOnceWithExactly(wcmestreams[spyFn], className, constraints);
          });
        });
      })
    );

    describe('createDisplayStream', () => {
      it('checks createDisplayStream', async () => {
        const spy = sinon.stub(wcmestreams, 'createDisplayStream').returns('something');
        const result = await createDisplayStream();
        assert.equal(result, 'something');
        assert.calledOnceWithExactly(wcmestreams.createDisplayStream, LocalDisplayStream);
      });
    });

    describe('createDisplayStreamWithAudio', () => {
      it('checks createDisplayStreamWithAudio', async () => {
        const spy = sinon.stub(wcmestreams, 'createDisplayStreamWithAudio').returns('something');
        const result = await createDisplayStreamWithAudio();
        assert.equal(result, 'something');
        assert.calledOnceWithExactly(
          wcmestreams.createDisplayStreamWithAudio,
          LocalDisplayStream,
          LocalSystemAudioStream
        );
      });
    });
  });
});
