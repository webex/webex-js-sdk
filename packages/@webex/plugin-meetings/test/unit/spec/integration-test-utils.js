import {EventEmitter} from 'events';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {Defer} from '@webex/common';

import integrationTestUtils from '../../utils/integrationTestUtils';

const MEDIA_DEADLINE = 80000;

describe('meeting browser media setup helper', () => {
  let clock;
  let meeting;
  let sdk;
  let streams;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    sdk = new Defer();
    streams = {microphone: {id: 'microphone'}, camera: {id: 'camera'}};
    meeting = new EventEmitter();
    meeting.mediaProperties = {};
    meeting.addMedia = sinon.stub().callsFake(({localStreams}) => {
      meeting.mediaProperties.audioStream = localStreams.microphone;
      meeting.mediaProperties.videoStream = localStreams.camera;

      return sdk.promise;
    });
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  const ready = (...types) => types.forEach((type) => meeting.emit('media:ready', {type}));
  const start = (options = {}) =>
    integrationTestUtils.addMedia({meeting}, {...streams, ...options});

  it('registers remote media listeners before calling the SDK and removes them after success', async () => {
    meeting.addMedia.callsFake(({localStreams}) => {
      meeting.mediaProperties.audioStream = localStreams.microphone;
      meeting.mediaProperties.videoStream = localStreams.camera;
      ready('remoteAudio', 'remoteVideo');

      return Promise.resolve();
    });

    await start();

    assert.calledOnceWithExactly(meeting.addMedia, {localStreams: streams});
    assert.equal(meeting.listenerCount('media:ready'), 0);
    assert.equal(clock.countTimers(), 0);
  });

  it('waits for SDK completion as well as both media events beyond the old 30-second cutoff', async () => {
    const done = sinon.spy();
    const operation = start().then(done);
    ready('remoteAudio', 'remoteVideo');
    await clock.tickAsync(35000);
    assert.notCalled(done);

    sdk.resolve();
    await operation;

    assert.calledOnce(done);
    assert.equal(meeting.listenerCount('media:ready'), 0);
    assert.equal(clock.countTimers(), 0);
  });

  it('identifies a pending SDK call at its deadline and removes the event listener', async () => {
    const rejected = sinon.spy();
    const operation = start().catch(rejected);
    ready('remoteAudio', 'remoteVideo');
    await clock.tickAsync(MEDIA_DEADLINE);

    assert.calledOnce(rejected);
    assert.include(rejected.firstCall.args[0].message, 'SDK addMedia()');
    assert.include(rejected.firstCall.args[0].message, '80000');
    assert.equal(meeting.listenerCount('media:ready'), 0);
    assert.equal(clock.countTimers(), 0);
    await operation;
  });

  it('identifies the missing remote media type after the SDK completes', async () => {
    const rejected = sinon.spy();
    const operation = start().catch(rejected);
    sdk.resolve();
    ready('remoteAudio');
    await clock.tickAsync(MEDIA_DEADLINE);

    assert.calledOnce(rejected);
    assert.include(rejected.firstCall.args[0].message, 'remoteVideo');
    assert.notInclude(rejected.firstCall.args[0].message, 'SDK addMedia()');
    assert.equal(meeting.listenerCount('media:ready'), 0);
    assert.equal(clock.countTimers(), 0);
    await operation;
  });

  it('propagates an SDK failure unchanged and cleans up immediately', async () => {
    const error = new Error('SDK media failure');
    const rejected = sinon.spy();
    const operation = start().catch(rejected);
    sdk.reject(error);
    await operation;

    assert.calledOnceWithExactly(rejected, error);
    assert.equal(meeting.listenerCount('media:ready'), 0);
    assert.equal(clock.countTimers(), 0);
  });

  it('cleans up when the SDK throws synchronously', async () => {
    const error = new Error('invalid SDK media operation');
    meeting.addMedia.throws(error);
    await assert.isRejected(start(), error.message);
    assert.equal(meeting.listenerCount('media:ready'), 0);
    assert.equal(clock.countTimers(), 0);
  });

  [
    {name: 'multistream', options: {multistream: true}, events: []},
    {
      name: 'an explicit subset',
      options: {expectedMediaReadyTypes: ['remoteAudio', null]},
      events: ['remoteAudio'],
    },
    {name: 'no expected remote types', options: {expectedMediaReadyTypes: []}, events: []},
  ].forEach(({name, options, events}) => {
    it(`preserves the expected media behavior for ${name}`, async () => {
      const operation = start(options);
      ready(...events);
      sdk.resolve();
      await operation;
      assert.calledOnceWithExactly(meeting.addMedia, {localStreams: streams});
      assert.equal(meeting.listenerCount('media:ready'), 0);
      assert.equal(clock.countTimers(), 0);
    });
  });
});
