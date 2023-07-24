import {assert} from '@webex/test-helper-chai';
import CallDiagnosticLatencies from '../../../../src/call-diagnostic/call-diagnostic-metrics-latencies'
import sinon from 'sinon';

describe("internal-plugin-metrics", () => {
  describe("CallDiagnosticLatencies", () => {
    let cdl: CallDiagnosticLatencies;
    var now = new Date();


    beforeEach(() => {
      sinon.createSandbox();
      sinon.useFakeTimers(now.getTime());
      cdl = new CallDiagnosticLatencies();
    });

    afterEach(() => {
      sinon.restore();
    })

    it('should save timestamp correctly', () => {
      assert.deepEqual(cdl.latencyTimestamps.size, 0);
      cdl.saveTimestamp('client.alert.displayed');
      assert.deepEqual(cdl.latencyTimestamps.size, 1);
      assert.deepEqual(cdl.latencyTimestamps.get('client.alert.displayed'), now.getTime())
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
      cdl.saveTimestamp('client.alert.displayed');
      assert.deepEqual(cdl.latencyTimestamps.get('client.alert.displayed'), now.getTime());
      cdl.saveTimestamp('client.alert.displayed', 1234);
      assert.deepEqual(cdl.latencyTimestamps.get('client.alert.displayed'), 1234);
      assert.deepEqual(cdl.latencyTimestamps.size, 1);

    })

    it('should clear all timestamps correctly', () => {
      cdl.saveTimestamp('client.alert.displayed');
      cdl.saveTimestamp('client.alert.removed');
      assert.deepEqual(cdl.latencyTimestamps.size, 2);
      cdl.clearTimestamps();
      assert.deepEqual(cdl.latencyTimestamps.size, 0);
    });

    it('should calculate diff between timestamps correctly', () => {
      cdl.saveTimestamp('client.alert.displayed', 10);
      cdl.saveTimestamp('client.alert.removed', 20);
      const res = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed');
      assert.deepEqual(res, 10);
    });

    it('it returns undefined if either one is doesnt exist', () => {
      cdl.saveTimestamp('client.alert.displayed', 10);
      const res1 = cdl.getDiffBetweenTimestamps('client.alert.displayed', 'client.alert.removed');
      assert.deepEqual(res1, undefined);
      const res2 = cdl.getDiffBetweenTimestamps('client.alert.removed', 'client.alert.displayed');
      assert.deepEqual(res2, undefined);
    });

    it('calculates getMeetingInfoReqResp correctly', () => {
      cdl.saveTimestamp('internal.client.meetinginfo.request', 10);
      cdl.saveTimestamp('internal.client.meetinginfo.response', 20);
      assert.deepEqual(cdl.getMeetingInfoReqResp(), 10);
    });

    it('calculates getShowInterstitialTime correctly', () => {
      cdl.saveTimestamp('internal.client.interstitial-window.launched', 10);
      cdl.saveTimestamp('internal.client.interstitial-window.click.joinbutton', 20);
      assert.deepEqual(cdl.getShowInterstitialTime(), 10);
    });

    it('calculates getCallInitJoinReq correctly', () => {
      cdl.saveTimestamp('internal.client.meeting.click.joinbutton', 10);
      cdl.saveTimestamp('client.locus.join.request', 20);
      assert.deepEqual(cdl.getCallInitJoinReq(), 10);
    });

    it('calculates getJoinReqResp correctly', () => {
      cdl.saveTimestamp('client.locus.join.request', 10);
      cdl.saveTimestamp('client.locus.join.response', 20);
      assert.deepEqual(cdl.getJoinReqResp(), 10);
    });

    it('calculates getLocalSDPGenRemoteSDPRecv correctly', () => {
      cdl.saveTimestamp('client.media-engine.local-sdp-generated', 10);
      cdl.saveTimestamp('client.media-engine.remote-sdp-received', 20);
      assert.deepEqual(cdl.getLocalSDPGenRemoteSDPRecv(), 10);
    });

    it('calculates getICESetupTime correctly', () => {
      cdl.saveTimestamp('client.ice.start', 10);
      cdl.saveTimestamp('client.ice.end', 20);
      assert.deepEqual(cdl.getICESetupTime(), 10);
    });

    it('calculates getAudioICESetupTime correctly', () => {
      cdl.saveTimestamp('client.ice.start', 10);
      cdl.saveTimestamp('client.ice.end', 20);
      assert.deepEqual(cdl.getAudioICESetupTime(), 10);
    });

    it('calculates getVideoICESetupTime correctly', () => {
      cdl.saveTimestamp('client.ice.start', 10);
      cdl.saveTimestamp('client.ice.end', 20);
      assert.deepEqual(cdl.getVideoICESetupTime(), 10);
    });

    it('calculates getShareICESetupTime correctly', () => {
      cdl.saveTimestamp('client.ice.start', 10);
      cdl.saveTimestamp('client.ice.end', 20);
      assert.deepEqual(cdl.getShareICESetupTime(), 10);
    });

    it('calculates getStayLobbyTime correctly', () => {
      cdl.saveTimestamp('client.locus.join.response', 10);
      cdl.saveTimestamp('internal.host.meeting.participant.admitted', 20);
      assert.deepEqual(cdl.getStayLobbyTime(), 10);
    });

    it('calculates getPageJMT correctly', () => {
      cdl.saveTimestamp('internal.client.pageJMT.received', 10);
      assert.deepEqual(cdl.getPageJMT(), 10);
    });

    it('calculates getClickToInterstitial correctly', () => {
      cdl.saveTimestamp('internal.client.meeting.click.joinbutton', 10);
      cdl.saveTimestamp('internal.client.meeting.interstitial-window.showed', 20);
      assert.deepEqual(cdl.getClickToInterstitial(), 10);
    });

    it('calculates getInterstitialToJoinOK correctly', () => {
      cdl.saveTimestamp('internal.client.interstitial-window.click.joinbutton', 10);
      cdl.saveTimestamp('client.locus.join.response', 20);
      assert.deepEqual(cdl.getInterstitialToJoinOK(), 10);
    });

    it('calculates getCallInitMediaEngineReady correctly', () => {
      cdl.saveTimestamp('internal.client.interstitial-window.click.joinbutton', 10);
      cdl.saveTimestamp('client.media-engine.ready', 20);
      assert.deepEqual(cdl.getCallInitMediaEngineReady(), 10);
    });

    it('calculates getTotalJMT correctly', () => {
      cdl.saveTimestamp('internal.client.interstitial-window.click.joinbutton', 5);
      cdl.saveTimestamp('internal.client.meeting.click.joinbutton', 10);
      cdl.saveTimestamp('internal.client.meeting.interstitial-window.showed', 20);
      cdl.saveTimestamp('client.locus.join.response', 40);
      assert.deepEqual(cdl.getTotalJMT(), 45);
    });

    it('calculates getJoinConfJMT correctly', () => {
      cdl.saveTimestamp('client.locus.join.request', 10);
      cdl.saveTimestamp('client.locus.join.response', 20);
      cdl.saveTimestamp('client.ice.start', 30);
      cdl.saveTimestamp('client.ice.end', 40);
      assert.deepEqual(cdl.getJoinConfJMT(), 20);
    });

    it('calculates getClientJMT correctly', () => {
      cdl.saveTimestamp('internal.client.interstitial-window.click.joinbutton', 2);
      cdl.saveTimestamp('client.locus.join.request', 6);
      cdl.saveTimestamp('client.locus.join.response', 8);
      cdl.saveTimestamp('client.ice.start', 10);
      cdl.saveTimestamp('client.ice.end', 11);
      assert.deepEqual(cdl.getClientJMT(), 3);
    });

    it('calculates getAudioJoinRespRxStart correctly', () => {
      cdl.saveTimestamp('client.locus.join.response', 5);
      cdl.saveTimestamp('client.media.rx.start', 7);
      assert.deepEqual(cdl.getAudioJoinRespRxStart(), 2);
    });

    it('calculates getVideoJoinRespRxStart correctly', () => {
      cdl.saveTimestamp('client.locus.join.response', 5);
      cdl.saveTimestamp('client.media.rx.start', 7);
      assert.deepEqual(cdl.getVideoJoinRespRxStart(), 2);
    });

    it('calculates getAudioJoinRespTxStart correctly', () => {
      cdl.saveTimestamp('client.locus.join.response', 5);
      cdl.saveTimestamp('client.media.tx.start', 7);
      assert.deepEqual(cdl.getAudioJoinRespTxStart(), 2);
    });

    it('calculates getVideoJoinRespTxStart correctly', () => {
      cdl.saveTimestamp('client.locus.join.response', 5);
      cdl.saveTimestamp('client.media.tx.start', 7);
      assert.deepEqual(cdl.getVideoJoinRespTxStart(), 2);
    });

    it('calculates getInterstitialToMediaOKJMT correctly', () => {
      cdl.saveTimestamp('internal.client.interstitial-window.click.joinbutton', 4);
      cdl.saveTimestamp('client.locus.join.response', 10);
      cdl.saveTimestamp('internal.host.meeting.participant.admitted', 12);
      cdl.saveTimestamp('client.media.rx.start', 14);
      cdl.saveTimestamp('client.media.tx.start', 15);
      cdl.saveTimestamp('client.media.rx.start', 16);
      assert.deepEqual(cdl.getInterstitialToMediaOKJMT(), 8);
    });
  })
})
