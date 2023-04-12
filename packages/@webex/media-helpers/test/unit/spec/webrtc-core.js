import {assert, expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {LocalCameraTrack, LocalMicrophoneTrack, LocalMicrophoneTrackEvents, LocalCameraTrackEvents, LocalDisplayTrack, createCameraTrack, createMicrophoneTrack, createDisplayTrack} from '@webex/media-helpers';
import * as wcmetracks from '@webex/internal-media-core';

describe('media-helpers', () => {
  describe('webrtc-core', () => {

    const classesToTest = [
      {className: LocalCameraTrack, title: 'LocalCameraTrack', event: LocalCameraTrackEvents, createFn: createCameraTrack, spyFn: 'createCameraTrack'},
      {className: LocalMicrophoneTrack, title: 'LocalMicrophoneTrack', event: LocalMicrophoneTrackEvents, createFn: createMicrophoneTrack, spyFn: 'createMicrophoneTrack'},
    ];

    classesToTest.forEach(({className, title, event, createFn, spyFn}) =>
      describe(title, () => {
        const fakeStream = {
          getTracks: sinon.stub().returns([{
            label: 'fake track',
            id: 'fake track id',
          }])
        };
        const track = new className(fakeStream);

        afterEach(() => {
          sinon.restore();
        });

        it('by default allows unmuting', async () => {
          assert.equal(track.isUnmuteAllowed(), true);
          await track.setMuted(false);
        })

        it('rejects setMute(false) if unmute is not allowed', async () => {
          track.setUnmuteAllowed(false);

          assert.equal(track.isUnmuteAllowed(), false);
          const fn = () => track.setMuted(false);
          expect(fn).to.throw(/Unmute is not allowed/);
        });

        it('resolves setMute(false) if unmute is allowed', async () => {
          track.setUnmuteAllowed(true);

          assert.equal(track.isUnmuteAllowed(), true);
          track.setMuted(false);
        });

        it('tests setServerMuted- true to false', async () => {
          track.underlyingTrack.enabled = true; //start with unmuted
  
          track.setMuted(true); //this.muted is true, call setServerMuted with false
          assert.equal(track.muted, true);
          
          const spy = sinon.stub(track, 'emit');
          track.setServerMuted(false, 'remotelyMuted');
          
          assert.equal(track.muted, false);
          
          const spyCall = spy.getCall(1);
          assert.equal(spyCall.calledWithExactly(event.ServerMuted, {muted: false, reason: 'remotelyMuted' }), true);
        });

        it('tests setServerMuted- false to true', async () => {
          track.underlyingTrack.enabled = false; //start with muted
  
          track.setMuted(false); //this.muted is false, call setServerMuted with true
          assert.equal(track.muted, false);
          
          const spy = sinon.stub(track, 'emit');
          track.setServerMuted(true, 'remotelyMuted');
          
          assert.equal(track.muted, true);
          
          const spyCall = spy.getCall(1);
          assert.equal(spyCall.calledWithExactly(event.ServerMuted, {muted: true, reason: 'remotelyMuted' }), true);
        });

        it('tests setServerMuted - true to true', async () => {
          track.underlyingTrack.enabled = true; //start with unmuted
  
          track.setMuted(true); //this.muted is true, call setServerMuted with true
          assert.equal(track.muted, true);
          
          const spy = sinon.stub(track, 'emit');
          track.setServerMuted(true, 'remotelyMuted');
          
          assert.equal(track.muted, true);
          
          const spyCall = spy.getCall(1);
          assert.equal(spyCall, null);
        });

        it('tests setServerMuted- false to false', async () => {
          track.underlyingTrack.enabled = false; //muted
  
          track.setMuted(false); //this.muted is false, call setServerMuted with false
          assert.equal(track.muted, false);
          
          const spy = sinon.stub(track, 'emit');
          track.setServerMuted(false, 'remotelyMuted');
          
          assert.equal(track.muted, false);
          
          const spyCall = spy.getCall(1);
          assert.equal(spyCall, null);
        });

        it('checks creating tracks', async () => {
          const constraints = {devideId: 'abc'};

          const spy = sinon.stub(wcmetracks, spyFn).returns('something');
          const result = createFn(constraints);

          assert.equal(result, 'something');
          assert.calledOnceWithExactly(spy, className, constraints);
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

    });
  });
});
