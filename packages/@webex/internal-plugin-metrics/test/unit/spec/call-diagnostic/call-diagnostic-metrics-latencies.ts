import {assert} from '@webex/test-helper-chai';
import CallDiagnosticLatencies from '../../../../src/call-diagnostic/call-diagnostic-metrics-latencies';
import sinon from 'sinon';

describe('internal-plugin-metrics', () => {
  describe('CallDiagnosticLatencies', () => {
    let cdl: CallDiagnosticLatencies;
    var now = new Date();

    beforeEach(() => {
      sinon.createSandbox();
      sinon.useFakeTimers(now.getTime());
      const webex = {
        meetings: {
          getBasicMeetingInformation: (id: string) => {
            if (id === 'meeting-id') {
              return {id: 'meeting-id', allowMediaInLobby: true};
            }
          },
        },
      };

      cdl = new CallDiagnosticLatencies(
        {},
        {
          parent: webex,
        }
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should save timestamp correctly', () => {
      assert.deepEqual(cdl.latencyTimestamps.size, 0);
      cdl.saveTimestamp({key: 'client.alert.displayed'});
      assert.deepEqual(cdl.latencyTimestamps.size, 1);
      assert.deepEqual(cdl.latencyTimestamps.get('client.alert.displayed'), now.getTime());
    });

    it('should save latency correctly by default and overwrites', () => {
      assert.deepEqual(cdl.precomputedLatencies.size, 0);
      cdl.saveLatency('internal.client.pageJMT', 10);
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 10);
      cdl.saveLatency('internal.client.pageJMT', 20);
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 20);
    });

    it('should overwrite latency when accumulate is false', () => {
      assert.deepEqual(cdl.precomputedLatencies.size, 0);
      cdl.saveLatency('internal.client.pageJMT', 10, false);
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 10);
      cdl.saveLatency('internal.client.pageJMT', 20, false);
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 20);
    });

    it('should save latency correctly when accumulate is true', () => {
      assert.deepEqual(cdl.precomputedLatencies.size, 0);
      cdl.saveLatency('internal.client.pageJMT', 10, true);
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 10);
    });

    it('should save latency correctly when accumulate is true and there is existing value', () => {
      assert.deepEqual(cdl.precomputedLatencies.size, 0);
      cdl.saveLatency('internal.client.pageJMT', 10);
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 10);
      cdl.saveLatency('internal.client.pageJMT', 10, true);
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 20);
    });

    it('should save only first timestamp correctly', () => {
      assert.deepEqual(cdl.latencyTimestamps.size, 0);
      cdl.saveFirstTimestampOnly('client.alert.displayed', 10);
      cdl.saveFirstTimestampOnly('client.alert.displayed', 20);
      assert.deepEqual(cdl.latencyTimestamps.get('client.alert.displayed'), 10);
    });

    it('should save only first timestamp correctly for client.media.tx.start and client.media.rx.start', () => {
      assert.deepEqual(cdl.latencyTimestamps.size, 0);
      cdl.saveFirstTimestampOnly('client.media.tx.start', 10);
      cdl.saveFirstTimestampOnly('client.media.tx.start', 20);
      cdl.saveFirstTimestampOnly('client.media.rx.start', 12);
      cdl.saveFirstTimestampOnly('client.media.rx.start', 22);
      assert.deepEqual(cdl.latencyTimestamps.get('client.media.tx.start'), 10);
      assert.deepEqual(cdl.latencyTimestamps.get('client.media.rx.start'), 12);
    });

    it('should update existing property and now add new keys', () => {
      assert.deepEqual(cdl.latencyTimestamps.size, 0);
      cdl.saveTimestamp({key: 'client.alert.displayed'});
      assert.deepEqual(cdl.latencyTimestamps.get('client.alert.displayed'), now.getTime());
      cdl.saveTimestamp({key: 'client.alert.displayed', value: 1234});
      assert.deepEqual(cdl.latencyTimestamps.get('client.alert.displayed'), 1234);
      assert.deepEqual(cdl.latencyTimestamps.size, 1);
    });

    it('should clear all timestamps correctly', () => {
      cdl.saveTimestamp({key: 'client.alert.displayed'});
      cdl.saveTimestamp({key: 'client.alert.removed'});
      assert.deepEqual(cdl.latencyTimestamps.size, 2);
      cdl.saveLatency('internal.api.fetch.intelligence.models', 42);
      assert.deepEqual(cdl.precomputedLatencies.size, 1);

      cdl.clearTimestamps();

      assert.deepEqual(cdl.latencyTimestamps.size, 0);
      assert.deepEqual(cdl.precomputedLatencies.size, 0);
    });

    it('should calculate diff between timestamps correctly', () => {
      cdl.saveTimestamp({key: 'client.alert.displayed', value: 10});
      cdl.saveTimestamp({key: 'client.alert.removed', value: 20});
      const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed');
      assert.deepEqual(res, 10);
    });

    it('it returns undefined if either one is doesnt exist', () => {
      cdl.saveTimestamp({key: 'client.alert.displayed', value: 10});
      const res1 = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed');
      assert.deepEqual(res1, undefined);
      const res2 = cdl.getDiffBetweenTimestamps('client.alert.removed', 'client.alert.displayed');
      assert.deepEqual(res2, undefined);
    });

    describe('getDiffBetweenTimestamps with clamping', () => {
      it('should apply default clamping (min: 0, max: 2147483647) when no clampValues provided', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 10});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 50});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed');
        assert.deepEqual(res, 40);
      });

      it('should return diff without clamping when value is within range', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 10});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 50});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed', {
          minimum: 0,
          maximum: 100,
        });
        assert.deepEqual(res, 40);
      });

      it('should clamp to minimum when diff is below minimum', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 50});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 45});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed', {
          minimum: 10,
          maximum: 100,
        });
        assert.deepEqual(res, 10);
      });

      it('should clamp to maximum when diff is above maximum', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 10});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 210});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed', {
          minimum: 0,
          maximum: 100,
        });
        assert.deepEqual(res, 100);
      });

      it('should use default minimum of 0 when only maximum is specified', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 50});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 45});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed', {
          maximum: 100,
        });
        assert.deepEqual(res, 0);
      });

      it('should not clamp maximum when maximum is undefined', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 10});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 2000});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed', {
          minimum: 5,
        });
        assert.deepEqual(res, 1990);
      });

      it('should handle negative differences correctly with clamping', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 100});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 50});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed', {
          minimum: 10,
          maximum: 1000,
        });
        assert.deepEqual(res, 10);
      });

      it('should return undefined when timestamps are missing even with clamping', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 10});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed', {
          minimum: 0,
          maximum: 100,
        });
        assert.deepEqual(res, undefined);
      });

      it('should apply default minimum clamping (0) when no clampValues provided and diff is negative', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 100});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 50});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed');
        assert.deepEqual(res, 0);
      });

      it('should clamp the value when a number greater than 2147483647', () => {
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 0});
        cdl.saveTimestamp({key: 'client.alert.removed', value: 2147483648});
        const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed');
        assert.deepEqual(res, 2147483647);
      });
    });

    it('calculates getMeetingInfoReqResp correctly', () => {
      cdl.saveTimestamp({key: 'internal.client.meetinginfo.request', value: 10});
      cdl.saveTimestamp({key: 'internal.client.meetinginfo.response', value: 20});
      assert.deepEqual(cdl.getMeetingInfoReqResp(), 10);
    });

    it('calculates getMeetingInfoReqResp correctly when duplicate requests/responses are sent', () => {
      cdl.saveTimestamp({key: 'internal.client.meetinginfo.request', value: 8});
      cdl.saveTimestamp({key: 'internal.client.meetinginfo.response', value: 18});
      cdl.saveTimestamp({key: 'internal.client.meetinginfo.request', value: 47});
      cdl.saveTimestamp({key: 'internal.client.meetinginfo.response', value: 48});
      assert.deepEqual(cdl.getMeetingInfoReqResp(), 10);
    });

    describe('measureLatency', () => {
      let clock;
      let saveLatencySpy;

      beforeEach(() => {
        clock = sinon.useFakeTimers();

        saveLatencySpy = sinon.stub(cdl, 'saveLatency');
      });

      afterEach(() => {
        clock.restore();
        sinon.restore();
      });

      it('checks measureLatency with accumulate false', async () => {
        const key = 'internal.client.pageJMT';
        const accumulate = false;

        const callbackStub = sinon.stub().callsFake(() => {
          clock.tick(50);
          return Promise.resolve('test');
        });

        // accumulate should be false by default
        const promise = cdl.measureLatency(callbackStub, 'internal.client.pageJMT');

        const resolvedValue = await promise;
        assert.deepEqual(resolvedValue, 'test');
        assert.calledOnceWithExactly(callbackStub);
        assert.calledOnceWithExactly(saveLatencySpy, key, 50, accumulate);
      });

      it('checks measureLatency with accumulate true', async () => {
        const key = 'internal.download.time';
        const accumulate = true;
        const callbackStub = sinon.stub().callsFake(() => {
          clock.tick(20);
          return Promise.resolve('test123');
        });

        const promise = cdl.measureLatency(callbackStub, 'internal.download.time', accumulate);

        const resolvedValue = await promise;
        assert.deepEqual(resolvedValue, 'test123');
        assert.calledOnceWithExactly(callbackStub);
        assert.calledOnceWithExactly(saveLatencySpy, key, 20, accumulate);
      });

      it('checks measureLatency when callBack rejects', async () => {
        const key = 'internal.client.pageJMT';
        const accumulate = false;
        const error = new Error('some error');
        const callbackStub = sinon.stub().callsFake(() => {
          clock.tick(50);
          return Promise.reject(error);
        });

        const promise = cdl.measureLatency(callbackStub, 'internal.client.pageJMT', accumulate);

        const rejectedValue = await assert.isRejected(promise);
        assert.deepEqual(rejectedValue, error);
        assert.calledOnceWithExactly(callbackStub);
        assert.calledOnceWithExactly(saveLatencySpy, key, 50, accumulate);
      });
    });

    describe('getRefreshCaptchaReqResp', () => {
      it('returns undefined when no precomputed value available', () => {
        assert.deepEqual(cdl.getRefreshCaptchaReqResp(), undefined);
      });

      it('returns the correct value', () => {
        cdl.saveLatency('internal.refresh.captcha.time', 123);

        assert.deepEqual(cdl.getRefreshCaptchaReqResp(), 123);
      });

      it('returns the correct whole number', () => {
        cdl.saveLatency('internal.refresh.captcha.time', 321.44);

        assert.deepEqual(cdl.getRefreshCaptchaReqResp(), 321);
      });

      it('returns the correct number when it is greater than 2147483647', () => {
        cdl.saveLatency('internal.refresh.captcha.time', 4294967400);

        assert.deepEqual(cdl.getRefreshCaptchaReqResp(), 2147483647);
      });
    });

    describe('getReachabilityClustersReqResp', () => {
      it('returns undefined when no precomputed value available', () => {
        assert.deepEqual(cdl.getReachabilityClustersReqResp(), undefined);
      });

      it('returns the correct value', () => {
        cdl.saveLatency('internal.get.cluster.time', 123);

        assert.deepEqual(cdl.getReachabilityClustersReqResp(), 123);
      });

      it('returns the correct whole number', () => {
        cdl.saveLatency('internal.get.cluster.time', 321.44);

        assert.deepEqual(cdl.getReachabilityClustersReqResp(), 321);
      });

      it('returns the correct number when it is greater than 2147483647', () => {
        cdl.saveLatency('internal.get.cluster.time', 4294967400);

        assert.deepEqual(cdl.getReachabilityClustersReqResp(), 2147483647);
      });
    });

    describe('getExchangeCITokenJMT', () => {
      it('returns undefined when no precomputed value available', () => {
        assert.deepEqual(cdl.getExchangeCITokenJMT(), undefined);
      });

      it('returns the correct value', () => {
        cdl.saveLatency('internal.exchange.ci.token.time', 123);

        assert.deepEqual(cdl.getExchangeCITokenJMT(), 123);
      });

      it('returns the correct whole number', () => {
        cdl.saveLatency('internal.exchange.ci.token.time', 321.44);

        assert.deepEqual(cdl.getExchangeCITokenJMT(), 321);
      });

      it('returns the correct number when it is greater than 2147483647', () => {
        cdl.saveLatency('internal.exchange.ci.token.time', 4294967400);

        assert.deepEqual(cdl.getExchangeCITokenJMT(), 2147483647);
      });
    });

    describe('saveTimestamp', () => {
      afterEach(() => {
        sinon.restore();
      });

      it('calls saveFirstTimestamp for meeting info request', () => {
        const saveFirstTimestamp = sinon.stub(cdl, 'saveFirstTimestampOnly');
        cdl.saveTimestamp({key: 'internal.client.meetinginfo.request', value: 10});
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 15});
        assert.deepEqual(saveFirstTimestamp.callCount, 1);
      });

      it('calls saveFirstTimestamp for meeting info response', () => {
        const saveFirstTimestamp = sinon.stub(cdl, 'saveFirstTimestampOnly');
        cdl.saveTimestamp({key: 'client.alert.displayed', value: 15});
        cdl.saveTimestamp({key: 'internal.client.meetinginfo.response', value: 20});
        assert.deepEqual(saveFirstTimestamp.callCount, 1);
      });

      it('calls saveFirstTimestamp for remote SDP received', () => {
        const saveFirstTimestamp = sinon.stub(cdl, 'saveFirstTimestampOnly');
        cdl.saveTimestamp({key: 'client.media-engine.remote-sdp-received', value: 10});
        assert.deepEqual(saveFirstTimestamp.callCount, 1);
      });

      it('clears timestamp for remote SDP received when local SDP generated', () => {
        cdl.saveTimestamp({key: 'client.media-engine.remote-sdp-received', value: 10});
        cdl.saveTimestamp({key: 'client.media-engine.local-sdp-generated', value: 20});
        assert.isUndefined(cdl.latencyTimestamps.get('client.media-engine.remote-sdp-received'));
      });
    });

    it('calculates getShowInterstitialTime correctly', () => {
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 10});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 20});
      assert.deepEqual(cdl.getShowInterstitialTime(), 10);
    });

    it('calculates getCallInitJoinReq correctly', () => {
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 5});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 10});
      cdl.saveTimestamp({key: 'client.locus.join.request', value: 20});
      // showedToJoinReq = 20-5 = 15, showInterstitialTime = 10-5 = 5, result = 15-5 = 10
      assert.deepEqual(cdl.getCallInitJoinReq(), 10);
    });

    it('calculates getRegisterWDMDeviceJMT correctly', () => {
      cdl.saveTimestamp({key: 'internal.register.device.request', value: 10});
      cdl.saveTimestamp({key: 'internal.register.device.response', value: 20});
      assert.deepEqual(cdl.getRegisterWDMDeviceJMT(), 10);
    });

    it('calculates getJoinReqResp correctly', () => {
      cdl.saveTimestamp({
        key: 'client.locus.join.request',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 20,
      });
      assert.deepEqual(cdl.getJoinReqResp(), 10);
    });

    it('calculates getTurnDiscoveryTime correctly', () => {
      cdl.saveTimestamp({
        key: 'internal.client.add-media.turn-discovery.start',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'internal.client.add-media.turn-discovery.end',
        value: 20,
      });
      assert.deepEqual(cdl.getTurnDiscoveryTime(), 10);
    });

    it('calculates getLocalSDPGenRemoteSDPRecv correctly', () => {
      cdl.saveTimestamp({
        key: 'client.media-engine.local-sdp-generated',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.media-engine.remote-sdp-received',
        value: 20,
      });
      assert.deepEqual(cdl.getLocalSDPGenRemoteSDPRecv(), 10);
    });

    it('calculates getICESetupTime correctly', () => {
      cdl.saveTimestamp({
        key: 'client.ice.start',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 20,
      });
      assert.deepEqual(cdl.getICESetupTime(), 10);
    });

    it('calculates getAudioICESetupTime correctly', () => {
      cdl.saveTimestamp({
        key: 'client.ice.start',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 20,
      });
      assert.deepEqual(cdl.getAudioICESetupTime(), 10);
    });

    it('calculates getVideoICESetupTime correctly', () => {
      cdl.saveTimestamp({
        key: 'client.ice.start',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 20,
      });
      assert.deepEqual(cdl.getVideoICESetupTime(), 10);
    });

    it('calculates getShareICESetupTime correctly', () => {
      cdl.saveTimestamp({
        key: 'client.ice.start',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 20,
      });
      assert.deepEqual(cdl.getShareICESetupTime(), 10);
    });

    it('calculates getStayLobbyTime correctly', () => {
      cdl.saveTimestamp({
        key: 'client.lobby.entered',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.lobby.exited',
        value: 20,
      });
      assert.deepEqual(cdl.getStayLobbyTime(), 10);
    });

    describe('getStayLobbyTimeCappedBy', () => {
      it('returns 0 when lobbyStartTimestamp is missing', () => {
        cdl.saveTimestamp({key: 'client.media-engine.ready', value: 100});
        assert.deepEqual(cdl.getStayLobbyTimeCappedBy('client.media-engine.ready'), 0);
      });

      it('returns undefined when endTimestampKey is missing', () => {
        cdl.saveTimestamp({key: 'client.lobby.entered', value: 10});
        assert.deepEqual(cdl.getStayLobbyTimeCappedBy('client.media-engine.ready'), undefined);
      });

      it('uses maximumEndTimestamp when lobby end does not exist', () => {
        cdl.saveTimestamp({key: 'client.lobby.entered', value: 10});
        cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
        assert.deepEqual(cdl.getStayLobbyTimeCappedBy('client.media-engine.ready'), 40);
      });

      it('uses lobby end when it is before maximumEndTimestamp', () => {
        cdl.saveTimestamp({key: 'client.lobby.entered', value: 10});
        cdl.saveTimestamp({key: 'client.lobby.exited', value: 30});
        cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
        assert.deepEqual(cdl.getStayLobbyTimeCappedBy('client.media-engine.ready'), 20);
      });

      it('uses maximumEndTimestamp when lobby end is after it', () => {
        cdl.saveTimestamp({key: 'client.lobby.entered', value: 10});
        cdl.saveTimestamp({key: 'client.lobby.exited', value: 60});
        cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
        assert.deepEqual(cdl.getStayLobbyTimeCappedBy('client.media-engine.ready'), 40);
      });

      it('clamps to 0 when result would be negative', () => {
        cdl.saveTimestamp({key: 'client.lobby.entered', value: 100});
        cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
        assert.deepEqual(cdl.getStayLobbyTimeCappedBy('client.media-engine.ready'), 0);
      });

      it('clamps to MAX_INTEGER when result is very large', () => {
        cdl.saveTimestamp({key: 'client.lobby.entered', value: 0});
        cdl.saveTimestamp({key: 'client.media-engine.ready', value: 2147483648});
        assert.deepEqual(cdl.getStayLobbyTimeCappedBy('client.media-engine.ready'), 2147483647);
      });
    });

    it('calculates getPageJMT correctly', () => {
      cdl.saveLatency('internal.client.pageJMT', 10);
      assert.deepEqual(cdl.getPageJMT(), 10);
    });

    it('calculates getPageJMT correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveLatency('internal.client.pageJMT', 2147483648);
      assert.deepEqual(cdl.getPageJMT(), 2147483647);
    });

    it('calculates getClickToInterstitial correctly', () => {
      cdl.saveLatency('internal.click.to.interstitial', 5);
      assert.deepEqual(cdl.getClickToInterstitial(), 5);
    });

    it('calculates getClickToInterstitial correctly when it is 0', () => {
      cdl.saveLatency('internal.click.to.interstitial', 0);
      assert.deepEqual(cdl.getClickToInterstitial(), 0);
    });

    it('calculates getClickToInterstitial correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveLatency('internal.click.to.interstitial', 2147483648);
      assert.deepEqual(cdl.getClickToInterstitial(), 2147483647);
    });

    it('calculates getClickToInterstitialWithUserDelay correctly', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 5);
      assert.deepEqual(cdl.getClickToInterstitialWithUserDelay(), 5);
    });

    it('calculates getClickToInterstitialWithUserDelay correctly when it is 0', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 0);
      assert.deepEqual(cdl.getClickToInterstitialWithUserDelay(), 0);
    });

    it('calculates getClickToInterstitialWithUserDelay correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 2147483648);
      assert.deepEqual(cdl.getClickToInterstitialWithUserDelay(), 2147483647);
    });

    it('calculates getInterstitialToJoinOK correctly', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 20,
      });
      // showedToJoinResp = 20-5 = 15, showInterstitialTime = 10-5 = 5, result = 15-5 = 10
      assert.deepEqual(cdl.getInterstitialToJoinOK(), 10);
    });

    it('calculates getInterstitialToJoinOK correctly when one value is not a number', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 'ten' as unknown as number,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 20,
      });
      assert.deepEqual(cdl.getInterstitialToJoinOK(), undefined);
    });

    it('calculates getCallInitMediaEngineReady correctly', () => {
      sinon.stub(cdl, 'getInterstitialToMediaOKJMT').returns(42);
      assert.deepEqual(cdl.getCallInitMediaEngineReady(), 42);
    });

    it('calculates getTotalJMT correctly', () => {
      cdl.saveLatency('internal.click.to.interstitial', 10);
      cdl.saveTimestamp({
        key: 'internal.client.meeting.click.joinbutton',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 20,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 25,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      // clickToInterstitial = 20-10 = 10
      // showedToJoinLocusResponse = 40-20 = 20
      // showInterstitialTime = 25-20 = 5
      // total = 10 + 20 - 5 = 25
      assert.deepEqual(cdl.getTotalJMT(), 25);
    });

    it('calculates getTotalJMT correctly when clickToInterstitial is 0', () => {
      cdl.saveLatency('internal.click.to.interstitial', 0);
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 20,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      // showedToJoinLocusResponse = 40-20 = 20, showInterstitialTime = 0
      // total = 0 + 20 - 0 = 20
      assert.deepEqual(cdl.getTotalJMT(), 20);
    });

    it('calculates getTotalJMT correctly when interstitialClickJoinToJoinLocusResponse is 0', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 40,
      });
      cdl.saveLatency('internal.click.to.interstitial', 12);
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      // showedToJoinLocusResponse = 0, showInterstitialTime = 0
      // total = 12 + 0 - 0 = 12
      assert.deepEqual(cdl.getTotalJMT(), 12);
    });

    it('calculates getTotalJMT correctly when both clickToInterstitial and interstitialClickJoinToJoinLocusResponse are 0', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 40,
      });
      cdl.saveLatency('internal.click.to.interstitial', 0);
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMT(), 0);
    });

    it('calculates getTotalJMT correctly when both clickToInterstitial is not a number', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 40,
      });
      cdl.saveLatency('internal.click.to.interstitial', 'eleven' as unknown as number);
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMT(), undefined);
    });

    it('calculates getTotalJMT correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      cdl.saveLatency('internal.click.to.interstitial', 2147483648);
      assert.deepEqual(cdl.getTotalJMT(), 2147483647);
    });

    it('calculates getTotalJMTWithUserDelay correctly', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 10);
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 20,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMTWithUserDelay(), 30);
    });

    it('calculates getTotalJMTWithUserDelay correctly when clickToInterstitialWithUserDelay is 0', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 0);
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 20,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMTWithUserDelay(), 20);
    });

    it('calculates getTotalJMTWithUserDelay correctly when interstitialShowedToJoinLocusResponse is 0', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 40,
      });
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 12);
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMTWithUserDelay(), 12);
    });

    it('calculates getTotalJMTWithUserDelay correctly when both clickToInterstitialWithUserDelay and interstitialShowedToJoinLocusResponse are 0', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 40,
      });
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 0);
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMTWithUserDelay(), 0);
    });

    it('calculates getTotalJMTWithUserDelay correctly when both clickToInterstitialWithUserDelay is not a number', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 40,
      });
      cdl.saveLatency(
        'internal.click.to.interstitial.with.user.delay',
        'eleven' as unknown as number
      );
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMTWithUserDelay(), undefined);
    });

    it('calculates getTotalJMTWithUserDelay correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 2147483648);
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 20,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMTWithUserDelay(), 2147483647);
    });

    it('calculates getTotalMediaJMT correctly with lobby exiting before media-engine.ready', () => {
      cdl.saveLatency('internal.click.to.interstitial', 3);
      // clickToInterstitial = 3
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 8});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 10});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
      // interstitialShowedToMediaEngineReady = 50 - 8 = 42
      // showInterstitialTime = 10 - 8 = 2
      cdl.saveTimestamp({key: 'client.lobby.entered', value: 20});
      cdl.saveTimestamp({key: 'client.lobby.exited', value: 30});
      // stayLobbyTimeCappedByMediaEngineReady = min(30, 50) - 20 = 10
      // total = 3 + 42 - 2 - 10 = 33
      assert.deepEqual(cdl.getTotalMediaJMT(), 33);
    });

    it('calculates getTotalMediaJMT correctly without lobby', () => {
      cdl.saveLatency('internal.click.to.interstitial', 3);
      // clickToInterstitial = 3
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 8});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 10});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
      // interstitialShowedToMediaEngineReady = 50 - 8 = 42
      // showInterstitialTime = 10 - 8 = 2
      // no client.lobby.entered → stayLobbyTimeCappedByMediaEngineReady = 0
      // total = 3 + 42 - 2 - 0 = 43
      assert.deepEqual(cdl.getTotalMediaJMT(), 43);
    });

    it('calculates getTotalMediaJMT correctly with lobby exiting after media-engine.ready', () => {
      cdl.saveLatency('internal.click.to.interstitial', 3);
      // clickToInterstitial = 3
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 8});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 10});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
      // interstitialShowedToMediaEngineReady = 50 - 8 = 42
      // showInterstitialTime = 10 - 8 = 2
      cdl.saveTimestamp({key: 'client.lobby.entered', value: 20});
      cdl.saveTimestamp({key: 'client.lobby.exited', value: 60});
      // stayLobbyTimeCappedByMediaEngineReady = min(60, 50) - 20 = 30
      // total = 3 + 42 - 2 - 30 = 13
      assert.deepEqual(cdl.getTotalMediaJMT(), 13);
    });

    it('calculates getTotalMediaJMT correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveLatency('internal.click.to.interstitial', 5);
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 10});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 10});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 4294967400});
      cdl.saveTimestamp({key: 'client.lobby.entered', value: 28});
      cdl.saveTimestamp({key: 'client.lobby.exited', value: 30});
      assert.deepEqual(cdl.getTotalMediaJMT(), 2147483647);
    });

    it('returns undefined for getTotalMediaJMT when media-engine.ready is missing', () => {
      cdl.saveLatency('internal.click.to.interstitial', 3);
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 8});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 10});
      cdl.saveTimestamp({key: 'client.locus.join.response', value: 20});
      assert.deepEqual(cdl.getTotalMediaJMT(), undefined);
    });

    it('calculates getTotalMediaJMT correctly when there is no lobby and stayLobbyTime defaults to 0', () => {
      cdl.saveLatency('internal.click.to.interstitial', 3);
      // clickToInterstitial = 3
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 8});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 10});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
      // interstitialShowedToMediaEngineReady = 50 - 8 = 42
      // showInterstitialTime = 10 - 8 = 2
      // no client.lobby.entered → stayLobbyTimeCappedByMediaEngineReady = 0
      // total = 3 + 42 - 2 - 0 = 43
      assert.deepEqual(cdl.getTotalMediaJMT(), 43);
    });

    it('calculates getTotalMediaJMTWithUserDelay correctly', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 7);
      // clickToInterstitialWithUserDelay = 7
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 10});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
      // interstitialShowedToMediaEngineReady = 50 - 10 = 40
      // total = 7 + 40 = 47
      assert.deepEqual(cdl.getTotalMediaJMTWithUserDelay(), 47);
    });

    it('calculates getTotalMediaJMTWithUserDelay correctly for guest join', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 3);
      // clickToInterstitialWithUserDelay = 3
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 8});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
      // interstitialShowedToMediaEngineReady = 50 - 8 = 42
      // total = 3 + 42 = 45
      assert.deepEqual(cdl.getTotalMediaJMTWithUserDelay(), 45);
    });

    it('returns undefined for getTotalMediaJMTWithUserDelay when media-engine.ready is missing', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 7);
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 10});
      assert.deepEqual(cdl.getTotalMediaJMTWithUserDelay(), undefined);
    });

    it('calculates getTotalMediaJMTWithUserDelay correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveLatency('internal.click.to.interstitial.with.user.delay', 2147483648);
      cdl.saveTimestamp({key: 'internal.client.meeting.interstitial-window.showed', value: 10});
      cdl.saveTimestamp({key: 'client.media-engine.ready', value: 50});
      assert.deepEqual(cdl.getTotalMediaJMTWithUserDelay(), 2147483647);
    });

    it('calculates getJoinConfJMT correctly', () => {
      cdl.saveTimestamp({
        key: 'client.locus.join.request',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 20,
      });
      cdl.saveTimestamp({
        key: 'client.ice.start',
        value: 30,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 40,
      });
      assert.deepEqual(cdl.getJoinConfJMT(), 20);
    });

    it('calculates getJoinConfJMT correctly when it is greater than MAX_INTEGER', () => {
      // Since both getJoinReqResp and getICESetupTime are individually clamped to 1200000,
      // the maximum possible sum is 2400000, which is less than MAX_INTEGER (2147483647).
      // This test should verify that the final clamping works by mocking the intermediate methods
      // to return values that would sum to more than MAX_INTEGER.

      const originalGetJoinReqResp = cdl.getJoinReqResp;
      const originalGetICESetupTime = cdl.getICESetupTime;

      // Mock the methods to return large values that would exceed MAX_INTEGER when summed
      cdl.getJoinReqResp = () => 1500000000;
      cdl.getICESetupTime = () => 1000000000;

      const result = cdl.getJoinConfJMT();

      // Restore original methods
      cdl.getJoinReqResp = originalGetJoinReqResp;
      cdl.getICESetupTime = originalGetICESetupTime;

      assert.deepEqual(result, 2147483647);
    });

    it('calculates getClientJMT correctly', () => {
      cdl.saveLatency('internal.click.to.interstitial.for.client.jmt', 5);
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 1,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 2,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.request',
        value: 6,
      });
      // showedToLocusJoinRequest = 6-1 = 5, showInterstitialTime = 2-1 = 1
      // clickToInterstitialForClientJmt (5) + 5 - 1 = 9
      assert.deepEqual(cdl.getClientJMT(), 9);
    });

    it('returns undefined for getClientJMT when clickToInterstitialForClientJmt is missing', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 1,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 2,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.request',
        value: 6,
      });
      assert.deepEqual(cdl.getClientJMT(), undefined);
    });

    it('returns undefined for getClientJMT when interstitialJoinToLocusJoinRequest is missing', () => {
      cdl.saveLatency('internal.click.to.interstitial.for.client.jmt', 5);
      assert.deepEqual(cdl.getClientJMT(), undefined);
    });

    it('calculates getAudioJoinRespRxStart correctly', () => {
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'client.media.rx.start',
        value: 7,
      });
      assert.deepEqual(cdl.getAudioJoinRespRxStart(), 2);
    });

    it('calculates getVideoJoinRespRxStart correctly', () => {
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'client.media.rx.start',
        value: 7,
      });
      assert.deepEqual(cdl.getVideoJoinRespRxStart(), 2);
    });

    it('calculates getAudioJoinRespTxStart correctly', () => {
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'client.media.tx.start',
        value: 7,
      });
      assert.deepEqual(cdl.getAudioJoinRespTxStart(), 2);
    });

    it('calculates getVideoJoinRespTxStart correctly', () => {
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'client.media.tx.start',
        value: 7,
      });
      assert.deepEqual(cdl.getVideoJoinRespTxStart(), 2);
    });

    it('calculates getInterstitialToMediaOKJMT correctly', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 2,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 4,
      });
      cdl.saveTimestamp({
        key: 'client.lobby.entered',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.lobby.exited',
        value: 12,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 14,
      });
      // showedToIceEnd = 14-2 = 12, showInterstitialTime = 4-2 = 2
      // stayLobbyTimeCappedByIceEnd = min(12,14)-10 = 2
      // result = 12 - 2 - 2 = 8
      assert.deepEqual(cdl.getInterstitialToMediaOKJMT(), 8);
    });

    it('calculates getInterstitialToMediaOKJMT correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 4,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 4,
      });
      cdl.saveTimestamp({
        key: 'client.lobby.entered',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.lobby.exited',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 2147483700,
      });
      assert.deepEqual(cdl.getInterstitialToMediaOKJMT(), 2147483647);
    });

    it('calculates getInterstitialToMediaOKJMT correctly without lobby', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 2,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 4,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 14,
      });
      // showedToIceEnd = 14-2 = 12, showInterstitialTime = 4-2 = 2
      // stayLobbyTimeCappedByIceEnd = 0 (no lobby)
      // result = 12 - 2 - 0 = 10
      assert.deepEqual(cdl.getInterstitialToMediaOKJMT(), 10);
    });

    it('calculates getInterstitialToMediaOKJMT correctly when there is no lobby and stayLobbyTime defaults to 0', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 2,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 4,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 14,
      });
      // showedToIceEnd = 14-2 = 12, showInterstitialTime = 4-2 = 2
      // stayLobbyTimeCappedByIceEnd = 0 (no lobby)
      // result = 12 - 2 - 0 = 10
      assert.deepEqual(cdl.getInterstitialToMediaOKJMT(), 10);
    });

    it('calculates getShareDuration correctly', () => {
      cdl.saveTimestamp({
        key: 'internal.client.share.initiated',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'internal.client.share.stopped',
        value: 7,
      });
      assert.deepEqual(cdl.getShareDuration(), 2);
    });

    describe('calculates getU2CTime correctly', () => {
      it('returns undefined when no precomputed value available', () => {
        assert.deepEqual(cdl.getU2CTime(), undefined);
      });

      it('returns the correct value', () => {
        cdl.saveLatency('internal.get.u2c.time', 123);

        assert.deepEqual(cdl.getU2CTime(), 123);
      });

      it('returns the correct whole number', () => {
        cdl.saveLatency('internal.get.u2c.time', 321.44);

        assert.deepEqual(cdl.getU2CTime(), 321);
      });
    });

    it('calculates getDownloadTimeJMT correctly', () => {
      cdl.saveLatency('internal.download.time', 1000);
      assert.deepEqual(cdl.getDownloadTimeJMT(), 1000);
    });

    it('calculates getDownloadTimeJMT correctly when it is greater than MAX_INTEGER', () => {
      cdl.saveLatency('internal.download.time', 2147483648);
      assert.deepEqual(cdl.getDownloadTimeJMT(), 2147483647);
    });

    describe('getOtherAppApiReqResp', () => {
      it('returns undefined when no precomputed value available', () => {
        assert.deepEqual(cdl.getOtherAppApiReqResp(), undefined);
      });

      it('returns undefined if it is less than 0', () => {
        cdl.saveLatency('internal.other.app.api.time', 0);

        assert.deepEqual(cdl.getOtherAppApiReqResp(), undefined);
      });

      it('returns the correct value', () => {
        cdl.saveLatency('internal.other.app.api.time', 123);

        assert.deepEqual(cdl.getOtherAppApiReqResp(), 123);
      });

      it('returns the correct whole number', () => {
        cdl.saveLatency('internal.other.app.api.time', 321.44);

        assert.deepEqual(cdl.getOtherAppApiReqResp(), 321);
      });

      it('returns the correct number when it is greater than 2147483647', () => {
        cdl.saveLatency('internal.other.app.api.time', 4294967400);

        assert.deepEqual(cdl.getOtherAppApiReqResp(), 2147483647);
      });
    });
  });
});
