import 'jsdom-global/register';
import {assert, expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {
  LocalCameraStream,
  LocalMicrophoneStream,
  LocalMicrophoneStreamEventNames,
  LocalCameraStreamEventNames,
  LocalDisplayStream,
  LocalSystemAudioStream,
  createCameraStream,
  createMicrophoneStream,
  createCameraAndMicrophoneStreams,
  createDisplayStream,
  createDisplayStreamWithAudio,
  createDisplayMedia,
} from '@webex/media-helpers';
import * as InternalMediaCoreModule from '@webex/internal-media-core';

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
          await stream.setUserMuted(false);
        });

        it('rejects setUserMuted(false) if unmute is not allowed', async () => {
          stream.setUnmuteAllowed(false);

          assert.equal(stream.isUnmuteAllowed(), false);
          const fn = () => stream.setUserMuted(false);
          expect(fn).to.throw(/Unmute is not allowed/);
        });

        it('resolves setUserMuted(false) if unmute is allowed', async () => {
          stream.setUnmuteAllowed(true);

          assert.equal(stream.isUnmuteAllowed(), true);
          await stream.setUserMuted(false);
        });

        it('returns a reasonable length string from JSON.stringify()', () => {
          assert.isBelow(JSON.stringify(stream).length, 200);
        });

        describe('#setServerMuted', () => {
          afterEach(() => {
            sinon.restore();
          });

          const checkSetServerMuted = async (startMute, setMute, expectedCalled) => {
            await stream.setUserMuted(startMute);

            assert.equal(stream.userMuted, startMute);

            const handler = sinon.fake();
            stream.on(event.ServerMuted, handler);

            await stream.setServerMuted(setMute, 'remotelyMuted');

            assert.equal(stream.userMuted, setMute);
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
      })
    );

    const functionsToTest = [
      {
        title: 'createCameraStream',
        createFn: createCameraStream,
        spyFn: 'createCameraStream',
        classConstructors: [LocalCameraStream],
        additionalOptions: {fake: 'constraints'},
      },
      {
        title: 'createMicrophoneStream',
        createFn: createMicrophoneStream,
        spyFn: 'createMicrophoneStream',
        classConstructors: [LocalMicrophoneStream],
        additionalOptions: {fake: 'constraints'},
      },
      {
        title: 'createCameraAndMicrophoneStreams',
        createFn: createCameraAndMicrophoneStreams,
        spyFn: 'createCameraAndMicrophoneStreams',
        classConstructors: [LocalCameraStream, LocalMicrophoneStream],
        additionalOptions: {video: {fake: 'constraints'}, audio: {fake: 'constraints'}},
      },
      {
        title: 'createDisplayStream',
        createFn: createDisplayStream,
        spyFn: 'createDisplayStream',
        classConstructors: [LocalDisplayStream],
        additionalOptions: 'motion',
      },
      {
        title: 'createDisplayStreamWithAudio',
        createFn: createDisplayStreamWithAudio,
        spyFn: 'createDisplayStreamWithAudio',
        classConstructors: [LocalDisplayStream, LocalSystemAudioStream],
        additionalOptions: 'motion',
      },
    ];
    functionsToTest.forEach(({title, createFn, spyFn, classConstructors, additionalOptions}) => {
      describe(title, () => {
        let wcmeCreateStreamSpy;
        beforeEach(() => {
          sinon.restore();
          wcmeCreateStreamSpy = sinon.stub(InternalMediaCoreModule, spyFn);
        });

        it('can be called without additional options', async () => {
          await createFn();
          assert.calledOnceWithExactly(wcmeCreateStreamSpy, ...classConstructors, undefined);
        });

        it('can be called with additional options', async () => {
          await createFn(additionalOptions);
          assert.calledOnceWithExactly(
            wcmeCreateStreamSpy,
            ...classConstructors,
            additionalOptions
          );
        });
      });
    });

    describe('createDisplayMedia', () => {
      let wcmeCreateDisplayMediaSpy;
      beforeEach(() => {
        sinon.restore();
        wcmeCreateDisplayMediaSpy = sinon.stub(InternalMediaCoreModule, 'createDisplayMedia');
      });

      it('can be called with no options', async () => {
        await createDisplayMedia();
        assert.calledOnceWithExactly(wcmeCreateDisplayMediaSpy, {
          video: {displayStreamConstructor: LocalDisplayStream},
          audio: undefined,
        });
      });

      it('can be called with just video', async () => {
        await createDisplayMedia({video: {}});
        assert.calledOnceWithExactly(wcmeCreateDisplayMediaSpy, {
          video: {displayStreamConstructor: LocalDisplayStream},
          audio: undefined,
        });
      });

      it('can be called with additional video options', async () => {
        const options = {
          video: {
            constraints: {fake: 'constraints'},
            videoContentHint: 'motion',
            preferCurrentTab: true,
            selfBrowserSurface: 'include',
            surfaceSwitching: 'include',
            monitorTypeSurfaces: 'exclude',
          },
        };
        await createDisplayMedia(options);
        assert.calledOnceWithExactly(wcmeCreateDisplayMediaSpy, {
          video: {displayStreamConstructor: LocalDisplayStream, ...options.video},
          audio: undefined,
        });
      });

      it('can be called with just video and audio', async () => {
        await createDisplayMedia({video: {}, audio: {}});
        assert.calledOnceWithExactly(wcmeCreateDisplayMediaSpy, {
          video: {displayStreamConstructor: LocalDisplayStream},
          audio: {systemAudioStreamConstructor: LocalSystemAudioStream},
        });
      });

      it('can be called with additional video and audio options', async () => {
        const options = {
          video: {
            constraints: {fake: 'constraints'},
            videoContentHint: 'motion',
            preferCurrentTab: true,
            selfBrowserSurface: 'include',
            surfaceSwitching: 'include',
            monitorTypeSurfaces: 'exclude',
          },
          audio: {
            constraints: {fake: 'constraints'},
            systemAudio: 'exclude',
          },
        };
        await createDisplayMedia(options);
        assert.calledOnceWithExactly(wcmeCreateDisplayMediaSpy, {
          video: {displayStreamConstructor: LocalDisplayStream, ...options.video},
          audio: {systemAudioStreamConstructor: LocalSystemAudioStream, ...options.audio},
        });
      });
    });
  });
});
