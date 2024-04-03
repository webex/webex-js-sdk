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
          meetingCollection: {
            get: (id: string) => {
              if (id === 'meeting-id') {
                return {id: 'meeting-id', allowMediaInLobby: true};
              }
            },
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

    it('should save latency correctly by default', () => {
      assert.deepEqual(cdl.precomputedLatencies.size, 0);
      cdl.saveLatency('internal.client.pageJMT', 10);
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 10);
    });

    it('should save latency correctly when overwrite is false', () => {
      assert.deepEqual(cdl.precomputedLatencies.size, 0);
      cdl.saveLatency('internal.client.pageJMT', 10, false);
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 10);
    });

    it('should save latency correctly when overwrite is false and there is existing value', () => {
      assert.deepEqual(cdl.precomputedLatencies.size, 0);
      cdl.saveLatency('internal.client.pageJMT', 10);
      assert.deepEqual(cdl.precomputedLatencies.size, 1);
      assert.deepEqual(cdl.precomputedLatencies.get('internal.client.pageJMT'), 10);
      cdl.saveLatency('internal.client.pageJMT', 10, false);
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
      cdl.clearTimestamps();
      assert.deepEqual(cdl.latencyTimestamps.size, 0);
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
      let callbackStub;
      let saveLatencySpy;

      beforeEach(() => {       
        clock = sinon.useFakeTimers(); 
        
        saveLatencySpy = sinon.stub(cdl, 'saveLatency');
      });

      afterEach(() => {
        clock.restore();
        sinon.restore();
      });
      
      it('checks measureLatency with overwrite false', async () => {
        const key = 'internal.client.pageJMT';
        const overwrite = false;
        callbackStub = sinon.stub().resolves();

        const promise = cdl.measureLatency(callbackStub, 'internal.client.pageJMT', overwrite);
        clock.tick(50);

        await promise;
        assert.calledOnce(callbackStub);
        sinon.assert.calledWith(saveLatencySpy, key, 50, overwrite)       
      });

      it('checks measureLatency with overwrite true', async () => {
        const key = 'internal.client.pageJMT';
        const overwrite = true;
        callbackStub = sinon.stub().resolves();

        const promise = cdl.measureLatency(callbackStub, 'internal.client.pageJMT', overwrite);
        clock.tick(50);

        await promise;
        assert.calledOnce(callbackStub);
        sinon.assert.calledWith(saveLatencySpy, key, 50, overwrite)       
      });

      it('checks measureLatency when callBack rejects', async () => {
        const key = 'internal.client.pageJMT';
        const overwrite = true;
        callbackStub = sinon.stub().rejects(new Error('some error'));

        const promise = cdl.measureLatency(callbackStub, 'internal.client.pageJMT', overwrite);
        clock.tick(50);

        await await assert.isRejected(promise);
        assert.calledOnce(callbackStub);
        sinon.assert.calledWith(saveLatencySpy, key, 50, overwrite)       
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
    });

    it('calculates getShowInterstitialTime correctly', () => {
      cdl.saveTimestamp({key: 'client.interstitial-window.start-launch', value: 10});
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 20});
      assert.deepEqual(cdl.getShowInterstitialTime(), 10);
    });

    it('calculates getCallInitJoinReq correctly', () => {
      cdl.saveTimestamp({key: 'internal.client.interstitial-window.click.joinbutton', value: 10});
      cdl.saveTimestamp({key: 'client.locus.join.request', value: 20});
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
        key: 'client.locus.join.response',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'internal.host.meeting.participant.admitted',
        value: 20,
      });
      assert.deepEqual(cdl.getStayLobbyTime(), 10);
    });

    it('calculates getPageJMT correctly', () => {
      cdl.saveLatency('internal.client.pageJMT', 10);
      assert.deepEqual(cdl.getPageJMT(), 10);
    });

    it('calculates getClickToInterstitial correctly', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.click.joinbutton',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 20,
      });
      assert.deepEqual(cdl.getClickToInterstitial(), 10);
    });

    it('calculates getClickToInterstitial without join button timestamp', () => {
      cdl.saveLatency('internal.click.to.interstitial', 5);
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 20,
      });
      assert.deepEqual(cdl.getClickToInterstitial(), 5);
    });

    it('calculates getInterstitialToJoinOK correctly', () => {
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 20,
      });
      assert.deepEqual(cdl.getInterstitialToJoinOK(), 10);
    });

    it('calculates getCallInitMediaEngineReady correctly', () => {
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.media-engine.ready',
        value: 20,
      });
      assert.deepEqual(cdl.getCallInitMediaEngineReady(), 10);
    });

    it('calculates getTotalJMT correctly', () => {
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'internal.client.meeting.click.joinbutton',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 20,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalJMT(), 45);
    });

    it('calculates getTotalMediaJMT correctly', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.click.joinbutton',
        value: 5,
      });
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 8,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.request',
        value: 12,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 20,
      });
      cdl.saveTimestamp({
        key: 'internal.host.meeting.participant.admitted',
        value: 24,
      });
      cdl.saveTimestamp({
        key: 'client.ice.start',
        value: 30,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalMediaJMT(), 27);
    });

    it('calculates getTotalMediaJMT correctly with allowMediaInLobby true', () => {
      cdl.saveTimestamp({
        key: 'internal.client.meeting.click.joinbutton',
        value: 5,
        options: {meetingId: 'meeting-id'},
      });
      cdl.saveTimestamp({
        key: 'internal.client.meeting.interstitial-window.showed',
        value: 8,
      });
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.request',
        value: 12,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 20,
      });
      cdl.saveTimestamp({
        key: 'internal.host.meeting.participant.admitted',
        value: 24,
      });
      cdl.saveTimestamp({
        key: 'client.ice.start',
        value: 30,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 40,
      });
      assert.deepEqual(cdl.getTotalMediaJMT(), 31);
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

    it('calculates getClientJMT correctly', () => {
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 2,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.request',
        value: 6,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 8,
      });
      cdl.saveTimestamp({
        key: 'client.ice.start',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 11,
      });
      assert.deepEqual(cdl.getClientJMT(), 3);
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
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 4,
      });
      cdl.saveTimestamp({
        key: 'client.locus.join.response',
        value: 10,
      });
      cdl.saveTimestamp({
        key: 'internal.host.meeting.participant.admitted',
        value: 12,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 14,
      });
      assert.deepEqual(cdl.getInterstitialToMediaOKJMT(), 8);
    });

    it('calculates getInterstitialToMediaOKJMT correctly without lobby', () => {
      cdl.saveTimestamp({
        key: 'internal.client.interstitial-window.click.joinbutton',
        value: 4,
      });
      cdl.saveTimestamp({
        key: 'client.ice.end',
        value: 14,
      });
      assert.deepEqual(cdl.getInterstitialToMediaOKJMT(), 10);
    });

    it('calculates getDownloadTimeJMT correctly', () => {
      cdl.saveLatency('internal.download.time', 1000);
      assert.deepEqual(cdl.getDownloadTimeJMT(), 1000);
    });
  });
});
