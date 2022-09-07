/* eslint-disable camelcase */
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import {BNR_STATUS} from '@webex/plugin-meetings/src/constants';

import BEHAVIORAL_METRICS from '@webex/plugin-meetings/src/metrics/constants';
import Meeting from '@webex/plugin-meetings/src/meeting';
import Meetings from '@webex/plugin-meetings';
import Metrics from '@webex/plugin-meetings/src/metrics';
import MediaUtil from '@webex/plugin-meetings/src/media/util';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';
import createEffectsState from '@webex/plugin-meetings/src/meeting/effectsState';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import LoggerConfig from '@webex/plugin-meetings/src/common/logs/logger-config';

describe('plugin-meetings', () => {
  const logger = {
    info: () => {},
    log: () => {},
    error: () => {},
    warn: () => {},
    trace: () => {},
    debug: () => {}
  };

  beforeEach(() => {
    sinon.stub(Metrics, 'sendBehavioralMetric');
  });
  afterEach(() => {
    sinon.restore();
  });

  Object.defineProperty(global.window.navigator, 'mediaDevices', {
    writable: true,
    value: {
      getSupportedConstraints: sinon.stub().returns({
        sampleRate: true
      })
    },
  });
  LoggerConfig.set({verboseEvents: true, enable: false});
  LoggerProxy.set(logger);

  let webex;
  let meeting;
  let uuid1;

  const fakeMediaTrack = () => ({
    id: Date.now().toString(),
    stop: () => {},
    readyState: 'live',
    enabled: true,
    getSettings: () => ({
      sampleRate: 48000
    })
  });

  class FakeMediaStream {
    constructor(tracks) {
      this.active = false;
      this.id = '5146425f-c240-48cc-b86b-27d422988fb7';
      this.tracks = tracks;
    }

    addTrack = () => undefined;

    getAudioTracks = () => this.tracks;
  }

  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.baseLatency = 0.005333333333333333;
      this.currentTime = 2.7946666666666666;
      this.sampleRate = 48000;
      this.audioWorklet = {
        addModule: async () => undefined,
      };
    }

    onstatechange = null;

    createMediaStreamSource() {
      return {
        connect: () => undefined,
        mediaStream: {
          getAudioTracks() {
          // eslint-disable-next-line no-undef
            return [new MediaStreamTrack()];
          },
        },
      };
    }

    createMediaStreamDestination() {
      return {
        stream: {
          getAudioTracks() {
          // eslint-disable-next-line no-undef
            return [new MediaStreamTrack()];
          },
        },
      };
    }
  }

  class FakeAudioWorkletNode {
    constructor() {
      this.port = {
        postMessage: () => undefined,
      };
    }

    connect() {
    /* placeholder method */
    }
  }

  class FakeMediaStreamTrack {
    constructor() {
      this.kind = 'audio';
      this.enabled = true;
      this.label = 'Default - MacBook Pro Microphone (Built-in)';
      this.muted = false;
      this.readyState = 'live';
      this.contentHint = '';
    }

    getSettings() {
      return {
        sampleRate: 48000
      };
    }
  }
  Object.defineProperty(global, 'MediaStream', {
    writable: true,
    value: FakeMediaStream,
  });

  Object.defineProperty(global, 'AudioContext', {
    writable: true,
    value: FakeAudioContext,
  });

  Object.defineProperty(global, 'AudioWorkletNode', {
    writable: true,
    value: FakeAudioWorkletNode,
  });

  Object.defineProperty(global, 'MediaStreamTrack', {
    writable: true,
    value: FakeMediaStreamTrack,
  });

  let effects;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        meetings: Meetings
      }
    });
    MediaUtil.createPeerConnection = sinon.stub().returns({});
    meeting = new Meeting(
      {
        userId: uuid1
      },
      {
        parent: webex
      }
    );

    effects = createEffectsState('BNR');
    meeting.canUpdateMedia = sinon.stub().returns(true);
    MeetingUtil.validateOptions = sinon.stub().returns(Promise.resolve());
    MeetingUtil.updateTransceiver = sinon.stub();

    meeting.addMedia = sinon.stub().returns(Promise.resolve());
    meeting.getMediaStreams = sinon.stub().returns(Promise.resolve());
    sinon.stub(meeting, 'effects').value(effects);
    sinon.replace(meeting, 'addMedia', () => {
      sinon.stub(meeting.mediaProperties, 'audioTrack').value(fakeMediaTrack());
      sinon.stub(meeting.mediaProperties, 'mediaDirection').value({
        receiveAudio: true
      });
    });
  });

  describe('bnr effect library', () => {
    beforeEach(async () => {
      await meeting.getMediaStreams();
      await meeting.addMedia();
    });
    describe('#enableBNR', () => {
      it('should have #enableBnr', () => {
        assert.exists(effects.enableBNR);
      });

      it('does bnr effect enable on audio track', async () => {
        assert.isTrue(await effects.handleClientRequest(true, meeting));
        assert.equal(effects.state.bnr.enabled, BNR_STATUS.ENABLED);

        assert(Metrics.sendBehavioralMetric.calledOnce);
        assert.calledWith(
          Metrics.sendBehavioralMetric,
          BEHAVIORAL_METRICS.ENABLE_BNR_SUCCESS,
        );
      });

      it('does resolve request if bnr is already enabled', async () => {
        effects.state.bnr.enabled = BNR_STATUS.ENABLED;
        assert.isTrue(await effects.handleClientRequest(true, meeting));
        assert.equal(effects.state.bnr.enabled, BNR_STATUS.ENABLED);
      });

      it('if called twice, does bnr effect enable on audio track for the first request and resolves second', async () => {
        Promise.all([effects.handleClientRequest(true, meeting), effects.handleClientRequest(true, meeting)])
          .then((resolveFirst, resolveSecond) => {
            assert.isTrue(resolveFirst);
            assert.isTrue(resolveSecond);
            assert.calledOnce(MediaUtil.createMediaStream);
          });
      });

      it('should throw error for inappropriate sample rate and send error metrics', async () => {
        const fakeMediaTrack1 = () => ({
          id: Date.now().toString(),
          stop: () => {},
          readyState: 'live',
          getSettings: () => ({
            sampleRate: 49000
          })
        });

        sinon.stub(meeting.mediaProperties, 'audioTrack').value(fakeMediaTrack1());

        // eslint-disable-next-line no-undef
        MediaUtil.createMediaStream = sinon.stub().returns(new MediaStream([fakeMediaTrack1()]));
        try {
          await effects.handleClientRequest(true, meeting);
        }
        catch (err) {
          assert(Metrics.sendBehavioralMetric.calledOnce);
          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.ENABLE_BNR_FAILURE, {
              reason: err.message,
              stack: err.stack
            }
          );
          assert.equal(err.message, 'Sample rate of 49000 is not supported.');
        }
      });
    });

    describe('#disableBNR', () => {
      beforeEach(() => {
        effects.state.bnr.enabled = BNR_STATUS.ENABLED;
      });
      it('should have #disableBnr', () => {
        assert.exists(effects.disableBNR);
      });

      it('does bnr disable on audio track', async () => {
        assert.isTrue(await effects.handleClientRequest(false, meeting));
        assert.equal(effects.state.bnr.enabled, BNR_STATUS.NOT_ENABLED);

        assert(Metrics.sendBehavioralMetric.calledOnce);
        assert.calledWith(
          Metrics.sendBehavioralMetric,
          BEHAVIORAL_METRICS.DISABLE_BNR_SUCCESS,
        );
      });

      it('reject request for disable bnr if not enabled', async () => {
        try {
          await effects.handleClientRequest(false, meeting);
        }
        catch (e) {
          assert.equal(e.message, 'Can not disable as BNR is not enabled');
          assert.equal(effects.state.bnr.enabled, BNR_STATUS.ENABLED);

          assert(Metrics.sendBehavioralMetric.calledOnce);
          assert.calledWith(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.DISABLE_BNR_FAILURE,
          );
        }
      });
    });
  });
});
