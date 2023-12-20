import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import TurnDiscovery from '@webex/plugin-meetings/src/roap/turnDiscovery';

import Metrics from '@webex/plugin-meetings/src/metrics';
import BEHAVIORAL_METRICS from '@webex/plugin-meetings/src/metrics/constants';
import RoapRequest from '@webex/plugin-meetings/src/roap/request';

import testUtils from '../../../utils/testUtils';

describe('TurnDiscovery', () => {
  let clock;
  let mockRoapRequest: RoapRequest;
  let testMeeting: any;

  const FAKE_TURN_URL = 'turns:fakeTurnServer.com:443?transport=tcp';
  const FAKE_TURN_USERNAME = 'someUsernameFromServer';
  const FAKE_TURN_PASSWORD = 'fakePasswordFromServer';
  const FAKE_LOCUS_ID = '09493311-f5d5-3e58-b491-009cc628162e';
  const FAKE_MEDIA_CONNECTIONS_FROM_LOCUS = [{mediaId: '464ff97f-4bda-466a-ad06-3a22184a2274'}];

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    sinon.stub(Metrics, 'sendBehavioralMetric');

    mockRoapRequest = {
      sendRoap: sinon.fake.resolves({mediaConnections: FAKE_MEDIA_CONNECTIONS_FROM_LOCUS}),
    } as unknown as RoapRequest;

    testMeeting = {
      id: 'fake meeting id',
      config: {
        experimental: {
          enableTurnDiscovery: true,
        },
      },
      correlationId: 'fake correlation id',
      selfUrl: 'fake self url',
      mediaId: 'fake media id',
      locusUrl: `https://locus-a.wbx2.com/locus/api/v1/loci/${FAKE_LOCUS_ID}`,
      roapSeq: -1,
      audio:{
        isLocallyMuted: () => true,
      },
      video:{
        isLocallyMuted: () => false,
      },
      setRoapSeq: sinon.fake((newSeq) => {
        testMeeting.roapSeq = newSeq;
      }),
      updateMediaConnections: sinon.stub(),
      webex: {meetings: {reachability: {isAnyClusterReachable: () => false}}},
    };
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  const checkRoapMessageSent = async (
    messageType,
    expectedSeq,
    expectedMediaId = testMeeting.mediaId
  ) => {
    await testUtils.flushPromises();

    assert.calledOnce(mockRoapRequest.sendRoap);
    assert.calledWith(mockRoapRequest.sendRoap, {
      roapMessage: {
        messageType,
        version: '2',
        seq: expectedSeq,
      },
      correlationId: testMeeting.correlationId,
      locusSelfUrl: testMeeting.selfUrl,
      mediaId: expectedMediaId,
      audioMuted: testMeeting.audio?.isLocallyMuted(),
      videoMuted: testMeeting.video?.isLocallyMuted(),
      meetingId: testMeeting.id,
    });

    if (messageType === 'TURN_DISCOVERY_REQUEST') {
      // check also that we've applied the media connections from the response
      assert.calledOnce(testMeeting.updateMediaConnections);
      assert.calledWith(testMeeting.updateMediaConnections, FAKE_MEDIA_CONNECTIONS_FROM_LOCUS);
    }
  };

  const checkFailureMetricsSent = () => {
    assert.calledOnce(Metrics.sendBehavioralMetric);
    assert.calledWith(
      Metrics.sendBehavioralMetric,
      BEHAVIORAL_METRICS.TURN_DISCOVERY_FAILURE,
      sinon.match({
        correlation_id: testMeeting.correlationId,
        locus_id: FAKE_LOCUS_ID,
      })
    );
  };

  describe('doTurnDiscovery', () => {
    it('sends TURN_DISCOVERY_REQUEST, waits for response and sends OK', async () => {
      const td = new TurnDiscovery(mockRoapRequest);

      const result = td.doTurnDiscovery(testMeeting, false);

      // check that TURN_DISCOVERY_REQUEST was sent
      await checkRoapMessageSent('TURN_DISCOVERY_REQUEST', 0);
      // @ts-ignore
      mockRoapRequest.sendRoap.resetHistory();

      // simulate the response
      td.handleTurnDiscoveryResponse({
        headers: [
          `x-cisco-turn-url=${FAKE_TURN_URL}`,
          `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
          `x-cisco-turn-password=${FAKE_TURN_PASSWORD}`,
        ],
      });

      await testUtils.flushPromises();

      // check that we've sent OK
      await checkRoapMessageSent('OK', 0);

      const {turnServerInfo, turnDiscoverySkippedReason} = await result;

      assert.deepEqual(turnServerInfo, {
        url: FAKE_TURN_URL,
        username: FAKE_TURN_USERNAME,
        password: FAKE_TURN_PASSWORD,
      });

      assert.isUndefined(turnDiscoverySkippedReason);
    });

    it('sends TURN_DISCOVERY_REQUEST with empty mediaId when isReconnecting is true', async () => {
      const td = new TurnDiscovery(mockRoapRequest);

      const result = td.doTurnDiscovery(testMeeting, true);

      // check that TURN_DISCOVERY_REQUEST was sent with empty mediaId
      await checkRoapMessageSent('TURN_DISCOVERY_REQUEST', 0, '');

      // the main part of the test is complete now, checking the remaining part of the flow just for completeness
      // @ts-ignore
      mockRoapRequest.sendRoap.resetHistory();

      // simulate the response
      td.handleTurnDiscoveryResponse({
        headers: [
          `x-cisco-turn-url=${FAKE_TURN_URL}`,
          `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
          `x-cisco-turn-password=${FAKE_TURN_PASSWORD}`,
        ],
      });

      await testUtils.flushPromises();

      // check that we've sent OK
      await checkRoapMessageSent('OK', 0);

      const {turnServerInfo, turnDiscoverySkippedReason} = await result;

      assert.deepEqual(turnServerInfo, {
        url: FAKE_TURN_URL,
        username: FAKE_TURN_USERNAME,
        password: FAKE_TURN_PASSWORD,
      });
      assert.isUndefined(turnDiscoverySkippedReason);
    });

    it('ignores any extra, unexpected headers in the response', async () => {
      const td = new TurnDiscovery(mockRoapRequest);
      const result = td.doTurnDiscovery(testMeeting, false);

      // check that TURN_DISCOVERY_REQUEST was sent
      await checkRoapMessageSent('TURN_DISCOVERY_REQUEST', 0);
      // @ts-ignore
      mockRoapRequest.sendRoap.resetHistory();

      // simulate the response with some extra headers
      td.handleTurnDiscoveryResponse({
        headers: [
          'x-cisco-turn-unexpected-header=xxx',
          `x-cisco-turn-url=${FAKE_TURN_URL}`,
          'x-cisco-some-other-header',
          `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
          `x-cisco-turn-password=${FAKE_TURN_PASSWORD}`,
          'another-header-at-the-end=12345',
        ],
      });

      await testUtils.flushPromises();

      // check that we've sent OK and still parsed the headers we care about
      await checkRoapMessageSent('OK', 0);

      const {turnServerInfo, turnDiscoverySkippedReason} = await result;
      assert.deepEqual(turnServerInfo, {
        url: FAKE_TURN_URL,
        username: FAKE_TURN_USERNAME,
        password: FAKE_TURN_PASSWORD,
      });
      assert.isUndefined(turnDiscoverySkippedReason);
    });

    it('resolves with undefined if turn discovery feature is disabled in config', async () => {
      const prevConfigValue = testMeeting.config.experimental.enableTurnDiscovery;

      testMeeting.config.experimental.enableTurnDiscovery = false;
      // @ts-ignore
      const result = await new TurnDiscovery(mockRoapRequest).doTurnDiscovery(testMeeting);

      const {turnServerInfo, turnDiscoverySkippedReason} = result;

      assert.isUndefined(turnServerInfo);
      assert.equal(turnDiscoverySkippedReason, 'config');
      assert.notCalled(mockRoapRequest.sendRoap);
      assert.notCalled(Metrics.sendBehavioralMetric);

      // restore previous config
      testMeeting.config.experimental.enableTurnDiscovery = prevConfigValue;
    });

    it('resolves with undefined if sending the request fails', async () => {
      const td = new TurnDiscovery(mockRoapRequest);

      mockRoapRequest.sendRoap = sinon.fake.rejects(new Error('fake error'));

      const result = await td.doTurnDiscovery(testMeeting, false);

      const {turnServerInfo, turnDiscoverySkippedReason} = result;

      assert.isUndefined(turnServerInfo);
      assert.isUndefined(turnDiscoverySkippedReason);
      checkFailureMetricsSent();
    });

    it('resolves with undefined when cluster is reachable', async () => {
      const prev = testMeeting.webex.meetings.reachability.isAnyClusterReachable;
      testMeeting.webex.meetings.reachability.isAnyClusterReachable = () => true;
      const result = await new TurnDiscovery(mockRoapRequest).doTurnDiscovery(testMeeting);

      const {turnServerInfo, turnDiscoverySkippedReason} = result;

      assert.isUndefined(turnServerInfo);
      assert.equal(turnDiscoverySkippedReason, 'reachability');
      assert.notCalled(mockRoapRequest.sendRoap);
      assert.notCalled(Metrics.sendBehavioralMetric);
      testMeeting.webex.meetings.reachability.isAnyClusterReachable = prev;
    });

    it("resolves with undefined if we don't get a response within 10s", async () => {
      const td = new TurnDiscovery(mockRoapRequest);

      const promise = td.doTurnDiscovery(testMeeting, false);

      await clock.tickAsync(10 * 1000);
      await testUtils.flushPromises();

      const {turnServerInfo, turnDiscoverySkippedReason} = await promise;

      assert.isUndefined(turnServerInfo);
      assert.isUndefined(turnDiscoverySkippedReason);
      checkFailureMetricsSent();
    });

    it('resolves with undefined if the response does not have all the headers we expect', async () => {
      const td = new TurnDiscovery(mockRoapRequest);
      const turnDiscoveryPromise = td.doTurnDiscovery(testMeeting, false);

      // simulate the response without the password
      td.handleTurnDiscoveryResponse({
        headers: [
          `x-cisco-turn-url=${FAKE_TURN_URL}`,
          `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
        ],
      });
      await testUtils.flushPromises();
      const {turnServerInfo, turnDiscoverySkippedReason} = await turnDiscoveryPromise;

      assert.isUndefined(turnServerInfo);
      assert.isUndefined(turnDiscoverySkippedReason);
      checkFailureMetricsSent();
    });

    it('resolves with undefined if the response does not have any headers', async () => {
      const td = new TurnDiscovery(mockRoapRequest);
      const turnDiscoveryPromise = td.doTurnDiscovery(testMeeting, false);

      // simulate the response without the headers
      td.handleTurnDiscoveryResponse({});

      await testUtils.flushPromises();
      const {turnServerInfo, turnDiscoverySkippedReason} = await turnDiscoveryPromise;

      assert.isUndefined(turnServerInfo);
      assert.isUndefined(turnDiscoverySkippedReason);
      checkFailureMetricsSent();
    });

    it('resolves with undefined if the response has empty headers array', async () => {
      const td = new TurnDiscovery(mockRoapRequest);
      const turnDiscoveryPromise = td.doTurnDiscovery(testMeeting, false);

      // simulate the response without the headers
      td.handleTurnDiscoveryResponse({headers: []});

      await testUtils.flushPromises();
      const {turnServerInfo, turnDiscoverySkippedReason} = await turnDiscoveryPromise;

      assert.isUndefined(turnServerInfo);
      assert.isUndefined(turnDiscoverySkippedReason);
      checkFailureMetricsSent();
    });

    it('resolves with undefined if failed to send OK', async () => {
      const td = new TurnDiscovery(mockRoapRequest);

      const turnDiscoveryPromise = td.doTurnDiscovery(testMeeting, false);

      // check that TURN_DISCOVERY_REQUEST was sent
      await checkRoapMessageSent('TURN_DISCOVERY_REQUEST', 0);
      // @ts-ignore
      mockRoapRequest.sendRoap.resetHistory();

      // setup the mock so that sending of OK fails
      mockRoapRequest.sendRoap = sinon.fake.rejects(new Error('fake error'));

      // simulate the response
      td.handleTurnDiscoveryResponse({
        headers: [
          `x-cisco-turn-url=${FAKE_TURN_URL}`,
          `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
          `x-cisco-turn-password=${FAKE_TURN_PASSWORD}`,
        ],
      });

      await testUtils.flushPromises();

      // check that we've sent OK
      await checkRoapMessageSent('OK', 0);

      const {turnServerInfo, turnDiscoverySkippedReason} = await turnDiscoveryPromise;

      assert.isUndefined(turnServerInfo);
      assert.isUndefined(turnDiscoverySkippedReason);
      checkFailureMetricsSent();
    });
  });

  describe('isSkipped', () => {
    [
      {enabledInConfig: true, isAnyClusterReachable: true, expectedIsSkipped: true},
      {enabledInConfig: true, isAnyClusterReachable: false, expectedIsSkipped: false},
      {enabledInConfig: false, isAnyClusterReachable: true, expectedIsSkipped: true},
      {enabledInConfig: false, isAnyClusterReachable: false, expectedIsSkipped: true},
    ].forEach(({enabledInConfig, isAnyClusterReachable, expectedIsSkipped}) => {
      it(`returns ${expectedIsSkipped} when TURN discovery is ${enabledInConfig ? '' : 'not '} enabled in config and isAnyClusterReachable() returns ${isAnyClusterReachable ? 'true' : 'false'}`, async () => {
        testMeeting.config.experimental.enableTurnDiscovery = enabledInConfig;

        sinon.stub(testMeeting.webex.meetings.reachability, 'isAnyClusterReachable').resolves(isAnyClusterReachable);

        const td = new TurnDiscovery(mockRoapRequest);

        const isSkipped = await td.isSkipped(testMeeting);

        assert.equal(isSkipped, expectedIsSkipped);
      })
    })
  })

  describe('handleTurnDiscoveryResponse', () => {
    it("doesn't do anything if turn discovery was not started", () => {
      const td = new TurnDiscovery(mockRoapRequest);

      // there is not much we can check, but we mainly want to make
      // sure that it doesn't crash
      td.handleTurnDiscoveryResponse({
        headers: [
          `x-cisco-turn-url=${FAKE_TURN_URL}`,
          `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
          `x-cisco-turn-password=${FAKE_TURN_PASSWORD}`,
        ],
      });

      assert.notCalled(mockRoapRequest.sendRoap);
    });
  });
});
