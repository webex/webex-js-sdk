import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import TurnDiscovery from '@webex/plugin-meetings/src/roap/turnDiscovery';

import Metrics from '@webex/plugin-meetings/src/metrics';
import BEHAVIORAL_METRICS from '@webex/plugin-meetings/src/metrics/constants';
import RoapRequest from '@webex/plugin-meetings/src/roap/request';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';

import testUtils from '../../../utils/testUtils';
import { IP_VERSION } from '../../../../src/constants';

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
    sinon.stub(MeetingUtil, 'getIpVersion').returns(IP_VERSION.unknown);

    mockRoapRequest = {
      sendRoap: sinon.fake.resolves({mediaConnections: FAKE_MEDIA_CONNECTIONS_FROM_LOCUS}),
    } as unknown as RoapRequest;

    testMeeting = {
      id: 'fake meeting id',
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
      webex: {meetings: {reachability: {
        isAnyPublicClusterReachable: () => Promise.resolve(false),
      }}},
      isMultistream: false,
      locusMediaRequest: { fake: true },
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

    const expectedSendRoapArgs: any = {
      roapMessage: {
        messageType,
        version: '2',
        seq: expectedSeq,
      },
      locusSelfUrl: testMeeting.selfUrl,
      mediaId: expectedMediaId,
      meetingId: testMeeting.id,
      locusMediaRequest: testMeeting.locusMediaRequest,
    };

    if (messageType === 'TURN_DISCOVERY_REQUEST') {
      expectedSendRoapArgs.ipVersion = 0;
      expectedSendRoapArgs.roapMessage.headers = ['includeAnswerInHttpResponse', 'noOkInTransaction'];
    }

    assert.calledWith(mockRoapRequest.sendRoap, expectedSendRoapArgs);
  };

  const checkFailureMetricsSent = () => {
    assert.calledWith(
      Metrics.sendBehavioralMetric,
      BEHAVIORAL_METRICS.TURN_DISCOVERY_FAILURE,
      sinon.match({
        correlation_id: testMeeting.correlationId,
        locus_id: FAKE_LOCUS_ID,
      })
    );
  };

  const checkHttpResponseMissingMetricsSent = () => {
    assert.calledWith(
      Metrics.sendBehavioralMetric,
      BEHAVIORAL_METRICS.ROAP_HTTP_RESPONSE_MISSING,
      sinon.match({
        correlationId: testMeeting.correlationId,
        messageType: 'TURN_DISCOVERY_RESPONSE',
        isMultistream: testMeeting.isMultistream,
      })
    );
  };

  describe('doTurnDiscovery', () => {
    [false, true].forEach(function (enabledMultistream) {
      describe('when Multistream is ' + (enabledMultistream ? 'enabled' : 'disabled'), () => {
        beforeEach(() => {
          testMeeting.isMultistream = enabledMultistream;
        });

        // checks that OK roap message was sent or not sent and that the result is as expected
        const checkResult = async (resultPromise, expectedRoapMessageSent, expectedResult, expectedSkipReason?: string) => {
          let turnServerInfo, turnDiscoverySkippedReason;

          if (expectedRoapMessageSent === 'OK') {
            await testUtils.flushPromises();

            // check that we've sent OK
            await checkRoapMessageSent('OK', 0);

            assert.calledWith(
              Metrics.sendBehavioralMetric,
              BEHAVIORAL_METRICS.TURN_DISCOVERY_REQUIRES_OK,
              sinon.match({
                correlation_id: testMeeting.correlationId,
                locus_id: FAKE_LOCUS_ID,
              })
            );

            ({turnServerInfo, turnDiscoverySkippedReason} = await resultPromise);
          } else {
            ({turnServerInfo, turnDiscoverySkippedReason} = await resultPromise);

            await testUtils.flushPromises();

            // check that we didn't send OK or any other message
            assert.notCalled(mockRoapRequest.sendRoap);
          }

          assert.deepEqual(turnServerInfo, expectedResult);
          assert.equal(turnDiscoverySkippedReason, expectedSkipReason);
        };

        it('sends TURN_DISCOVERY_REQUEST, waits for response and sends OK', async () => {
          const td = new TurnDiscovery(mockRoapRequest);
          const result = td.doTurnDiscovery(testMeeting, false);

          // check that TURN_DISCOVERY_REQUEST was sent
          await checkRoapMessageSent('TURN_DISCOVERY_REQUEST', 0);

          // check also that we've applied the media connections from the response
          assert.calledOnce(testMeeting.updateMediaConnections);
          assert.calledWith(testMeeting.updateMediaConnections, FAKE_MEDIA_CONNECTIONS_FROM_LOCUS);

          // response is not in http response, so we expect a metric for that
          checkHttpResponseMissingMetricsSent();

          // @ts-ignore
          mockRoapRequest.sendRoap.resetHistory();

          // simulate the response
          td.handleTurnDiscoveryResponse(
            {
              messageType: 'TURN_DISCOVERY_RESPONSE',
              headers: [
                `x-cisco-turn-url=${FAKE_TURN_URL}`,
                `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
                `x-cisco-turn-password=${FAKE_TURN_PASSWORD}`,
              ],
            },
            'from test'
          );

          await checkResult(result, 'OK', {
            url: FAKE_TURN_URL,
            username: FAKE_TURN_USERNAME,
            password: FAKE_TURN_PASSWORD,
          });
        });

        it('sends TURN_DISCOVERY_REQUEST, waits for response and does not send OK if response received from Mercury has "noOkInTransaction" header', async () => {
          const td = new TurnDiscovery(mockRoapRequest);
          const result = td.doTurnDiscovery(testMeeting, false);

          // check that TURN_DISCOVERY_REQUEST was sent
          await checkRoapMessageSent('TURN_DISCOVERY_REQUEST', 0);

          // check also that we've applied the media connections from the response
          assert.calledOnce(testMeeting.updateMediaConnections);
          assert.calledWith(testMeeting.updateMediaConnections, FAKE_MEDIA_CONNECTIONS_FROM_LOCUS);

          // @ts-ignore
          mockRoapRequest.sendRoap.resetHistory();

          // simulate the response
          td.handleTurnDiscoveryResponse(
            {
              messageType: 'TURN_DISCOVERY_RESPONSE',
              headers: [
                `x-cisco-turn-url=${FAKE_TURN_URL}`,
                `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
                `x-cisco-turn-password=${FAKE_TURN_PASSWORD}`,
                'noOkInTransaction',
              ],
            },
            'from test'
          );

          await checkResult(result, undefined, {
            url: FAKE_TURN_URL,
            username: FAKE_TURN_USERNAME,
            password: FAKE_TURN_PASSWORD,
          });
        });

        it('sends TURN_DISCOVERY_REQUEST, handles http response and does not send OK if received response has "noOkInTransaction" header', async () => {
          mockRoapRequest.sendRoap = sinon.fake.resolves({
            mediaConnections: [
              {
                mediaId: '464ff97f-4bda-466a-ad06-3a22184a2274',
                remoteSdp: `{"roapMessage": {"messageType":"TURN_DISCOVERY_RESPONSE","seq":"0","headers": ["x-cisco-turn-url=${FAKE_TURN_URL}","x-cisco-turn-username=${FAKE_TURN_USERNAME}","x-cisco-turn-password=${FAKE_TURN_PASSWORD}", "noOkInTransaction"]}}`,
              },
            ],
          });

          const td = new TurnDiscovery(mockRoapRequest);
          const result = td.doTurnDiscovery(testMeeting, false);

          // check that TURN_DISCOVERY_REQUEST was sent
          await checkRoapMessageSent('TURN_DISCOVERY_REQUEST', 0);

          // @ts-ignore
          mockRoapRequest.sendRoap.resetHistory();

          await checkResult(result, undefined, {
            url: FAKE_TURN_URL,
            username: FAKE_TURN_USERNAME,
            password: FAKE_TURN_PASSWORD,
          });
        });

        it('sends TURN_DISCOVERY_REQUEST, handles http response and sends OK if received response does not have "noOkInTransaction" header', async () => {
          let sendRoapPromiseResolve;
          const sendRoapResult = {
            mediaConnections: [
              {
                mediaId: '464ff97f-4bda-466a-ad06-3a22184a2274',
                remoteSdp: `{"roapMessage": {"messageType":"TURN_DISCOVERY_RESPONSE","seq":"0","headers": ["x-cisco-turn-url=${FAKE_TURN_URL}","x-cisco-turn-username=${FAKE_TURN_USERNAME}","x-cisco-turn-password=${FAKE_TURN_PASSWORD}"]}}`,
              },
            ],
          };
          mockRoapRequest.sendRoap = sinon.fake.returns(new Promise((resolve) => {
            sendRoapPromiseResolve = resolve;
          }));

          const td = new TurnDiscovery(mockRoapRequest);
          const result = td.doTurnDiscovery(testMeeting, false);

          // check that TURN_DISCOVERY_REQUEST was sent
          await checkRoapMessageSent('TURN_DISCOVERY_REQUEST', 0);

          // @ts-ignore
          mockRoapRequest.sendRoap.resetHistory();
          // simulate the http response without 'noOkInTransaction' header
          sendRoapPromiseResolve(sendRoapResult);

          await checkResult(result, 'OK', {
            url: FAKE_TURN_URL,
            username: FAKE_TURN_USERNAME,
            password: FAKE_TURN_PASSWORD,
          });
        });

        it('handles http response that has invalid JSON in the remoteSdp field', async () => {
          mockRoapRequest.sendRoap = sinon.fake.resolves({
            mediaConnections: [
              {
                mediaId: '464ff97f-4bda-466a-ad06-3a22184a2274',
                remoteSdp: `not a json`,
              },
            ],
          });

          const td = new TurnDiscovery(mockRoapRequest);
          const result = td.doTurnDiscovery(testMeeting, false);

          // check that TURN_DISCOVERY_REQUEST was sent
          await checkRoapMessageSent('TURN_DISCOVERY_REQUEST', 0);

          // @ts-ignore
          mockRoapRequest.sendRoap.resetHistory();

          await checkResult(result, undefined, undefined, 'failure: Unexpected token o in JSON at position 1');
          checkFailureMetricsSent();
        });

        it('waits for response from Mercury if http response does not contain a roapMessage', async () => {
          mockRoapRequest.sendRoap = sinon.fake.resolves({
            mediaConnections: [
              {
                mediaId: '464ff97f-4bda-466a-ad06-3a22184a2274',
                remoteSdp: `{"something": "whatever"}`,
              },
            ],
          });

          const td = new TurnDiscovery(mockRoapRequest);
          const result = td.doTurnDiscovery(testMeeting, false);

          // check that TURN_DISCOVERY_REQUEST was sent
          await checkRoapMessageSent('TURN_DISCOVERY_REQUEST', 0);

          checkHttpResponseMissingMetricsSent();

          // @ts-ignore
          mockRoapRequest.sendRoap.resetHistory();

          // simulate the response coming from Mercury
          td.handleTurnDiscoveryResponse(
            {
              messageType: 'TURN_DISCOVERY_RESPONSE',
              headers: [
                `x-cisco-turn-url=${FAKE_TURN_URL}`,
                `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
                `x-cisco-turn-password=${FAKE_TURN_PASSWORD}`,
              ],
            },
            'from test'
          );

          await checkResult(result, 'OK', {
            url: FAKE_TURN_URL,
            username: FAKE_TURN_USERNAME,
            password: FAKE_TURN_PASSWORD,
          });
        });

        it('handles unexpected roap message type in http response', async () => {
          mockRoapRequest.sendRoap = sinon.fake.resolves({
            mediaConnections: [
              {
                mediaId: '464ff97f-4bda-466a-ad06-3a22184a2274',
                remoteSdp: `{"roapMessage": {"messageType":"ERROR","seq":"0"}}`,
              },
            ],
          });

          const td = new TurnDiscovery(mockRoapRequest);
          const result = td.doTurnDiscovery(testMeeting, false);

          // check that TURN_DISCOVERY_REQUEST was sent
          await checkRoapMessageSent('TURN_DISCOVERY_REQUEST', 0);

          // @ts-ignore
          mockRoapRequest.sendRoap.resetHistory();

          await checkResult(result, undefined, undefined, 'failure: TURN_DISCOVERY_RESPONSE in http response has unexpected messageType: {"seq":"0","messageType":"ERROR"}');
        });
      });
    });

    it('sends TURN_DISCOVERY_REQUEST, waits for response and sends OK when isForced = true when cluster is reachable', async () => {
      const prev = testMeeting.webex.meetings.reachability.isAnyPublicClusterReachable;
      testMeeting.webex.meetings.reachability.isAnyPublicClusterReachable = sinon
        .stub()
        .resolves(true);

      const td = new TurnDiscovery(mockRoapRequest);
      const result = td.doTurnDiscovery(testMeeting, false, true);

      // We ignore reachability results so we don't get skip reason
      assert.notCalled(testMeeting.webex.meetings.reachability.isAnyPublicClusterReachable);

      // check that TURN_DISCOVERY_REQUEST was sent
      await checkRoapMessageSent('TURN_DISCOVERY_REQUEST', 0);
      // @ts-ignore
      mockRoapRequest.sendRoap.resetHistory();
      // simulate the response
      td.handleTurnDiscoveryResponse(
        {
          messageType: 'TURN_DISCOVERY_RESPONSE',
          headers: [
            `x-cisco-turn-url=${FAKE_TURN_URL}`,
            `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
            `x-cisco-turn-password=${FAKE_TURN_PASSWORD}`,
          ],
        },
        'from test'
      );
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

      // restore previous callback
      testMeeting.webex.meetings.reachability.isAnyPublicClusterReachable = prev;
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
      td.handleTurnDiscoveryResponse(
        {
          messageType: 'TURN_DISCOVERY_RESPONSE',
          headers: [
            `x-cisco-turn-url=${FAKE_TURN_URL}`,
            `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
            `x-cisco-turn-password=${FAKE_TURN_PASSWORD}`,
          ],
        },
        'from test'
      );

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
      td.handleTurnDiscoveryResponse(
        {
          messageType: 'TURN_DISCOVERY_RESPONSE',
          headers: [
            'x-cisco-turn-unexpected-header=xxx',
            `x-cisco-turn-url=${FAKE_TURN_URL}`,
            'x-cisco-some-other-header',
            `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
            `x-cisco-turn-password=${FAKE_TURN_PASSWORD}`,
            'another-header-at-the-end=12345',
          ],
        },
        'from test'
      );

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

    it('resolves with undefined turnServerInfo if sending the request fails', async () => {
      const td = new TurnDiscovery(mockRoapRequest);

      mockRoapRequest.sendRoap = sinon.fake.rejects(new Error('fake error'));

      const result = await td.doTurnDiscovery(testMeeting, false);

      const {turnServerInfo, turnDiscoverySkippedReason} = result;

      assert.isUndefined(turnServerInfo);
      assert.equal(turnDiscoverySkippedReason, 'failure: fake error');
      checkFailureMetricsSent();
    });

    it('resolves with undefined turnServerInfo when cluster is reachable', async () => {
      const prev = testMeeting.webex.meetings.reachability.isAnyPublicClusterReachable;
      testMeeting.webex.meetings.reachability.isAnyPublicClusterReachable = () =>
        Promise.resolve(true);
      const result = await new TurnDiscovery(mockRoapRequest).doTurnDiscovery(testMeeting);

      const {turnServerInfo, turnDiscoverySkippedReason} = result;

      assert.isUndefined(turnServerInfo);
      assert.equal(turnDiscoverySkippedReason, 'reachability');
      assert.notCalled(mockRoapRequest.sendRoap);
      assert.notCalled(Metrics.sendBehavioralMetric);
      testMeeting.webex.meetings.reachability.isAnyPublicClusterReachable = prev;
    });

    it("resolves with undefined turnServerInfo if we don't get a response within 10s", async () => {
      const td = new TurnDiscovery(mockRoapRequest);

      const promise = td.doTurnDiscovery(testMeeting, false);

      await clock.tickAsync(10 * 1000);
      await testUtils.flushPromises();

      const {turnServerInfo, turnDiscoverySkippedReason} = await promise;

      assert.isUndefined(turnServerInfo);
      assert.equal(turnDiscoverySkippedReason, 'failure: Timed out waiting for TURN_DISCOVERY_RESPONSE');
      checkFailureMetricsSent();
    });

    it('resolves with undefined turnServerInfo if the response does not have all the headers we expect', async () => {
      const td = new TurnDiscovery(mockRoapRequest);
      const turnDiscoveryPromise = td.doTurnDiscovery(testMeeting, false);

      await testUtils.flushPromises();

      // simulate the response without the password
      td.handleTurnDiscoveryResponse(
        {
          messageType: 'TURN_DISCOVERY_RESPONSE',
          headers: [
            `x-cisco-turn-url=${FAKE_TURN_URL}`,
            `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
          ],
        },
        'from test'
      );
      await testUtils.flushPromises();
      const {turnServerInfo, turnDiscoverySkippedReason} = await turnDiscoveryPromise;

      assert.isUndefined(turnServerInfo);
      assert.equal(turnDiscoverySkippedReason, `failure: TURN_DISCOVERY_RESPONSE from test missing some headers: ["x-cisco-turn-url=${FAKE_TURN_URL}","x-cisco-turn-username=${FAKE_TURN_USERNAME}"]`);
      checkFailureMetricsSent();
    });

    it('resolves with undefined turnServerInfo if the response does not have any headers', async () => {
      const td = new TurnDiscovery(mockRoapRequest);
      const turnDiscoveryPromise = td.doTurnDiscovery(testMeeting, false);

      await testUtils.flushPromises();

      // simulate the response without the headers
      td.handleTurnDiscoveryResponse({messageType: 'TURN_DISCOVERY_RESPONSE'}, 'from test');

      await testUtils.flushPromises();
      const {turnServerInfo, turnDiscoverySkippedReason} = await turnDiscoveryPromise;

      assert.isUndefined(turnServerInfo);
      assert.equal(turnDiscoverySkippedReason, 'failure: TURN_DISCOVERY_RESPONSE from test missing some headers: undefined');
      checkFailureMetricsSent();
    });

    it('resolves with undefined turnServerInfo if the response has empty headers array', async () => {
      const td = new TurnDiscovery(mockRoapRequest);
      const turnDiscoveryPromise = td.doTurnDiscovery(testMeeting, false);

      await testUtils.flushPromises();

      // simulate the response without the headers
      td.handleTurnDiscoveryResponse(
        {messageType: 'TURN_DISCOVERY_RESPONSE', headers: []},
        'from test'
      );

      await testUtils.flushPromises();
      const {turnServerInfo, turnDiscoverySkippedReason} = await turnDiscoveryPromise;

      assert.isUndefined(turnServerInfo);
      assert.equal(turnDiscoverySkippedReason, 'failure: TURN_DISCOVERY_RESPONSE from test missing some headers: []');
      checkFailureMetricsSent();
    });

    it('resolves with undefined if failed to send OK', async () => {
      const td = new TurnDiscovery(mockRoapRequest);

      const turnDiscoveryPromise = td.doTurnDiscovery(testMeeting, false);

      await testUtils.flushPromises();

      // check that TURN_DISCOVERY_REQUEST was sent
      await checkRoapMessageSent('TURN_DISCOVERY_REQUEST', 0);
      // @ts-ignore
      mockRoapRequest.sendRoap.resetHistory();

      // setup the mock so that sending of OK fails
      mockRoapRequest.sendRoap = sinon.fake.rejects(new Error('fake error'));

      // simulate the response
      td.handleTurnDiscoveryResponse(
        {
          messageType: 'TURN_DISCOVERY_RESPONSE',
          headers: [
            `x-cisco-turn-url=${FAKE_TURN_URL}`,
            `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
            `x-cisco-turn-password=${FAKE_TURN_PASSWORD}`,
          ],
        },
        'from test'
      );

      await testUtils.flushPromises();

      // check that we've sent OK
      await checkRoapMessageSent('OK', 0);

      const {turnServerInfo, turnDiscoverySkippedReason} = await turnDiscoveryPromise;

      assert.isUndefined(turnServerInfo);
      assert.equal(turnDiscoverySkippedReason, 'failure: fake error');
      checkFailureMetricsSent();
    });
  });

  describe('isSkipped', () => {
    [
      {isAnyPublicClusterReachable: true, expectedIsSkipped: true},
      {isAnyPublicClusterReachable: false, expectedIsSkipped: false},
    ].forEach(({isAnyPublicClusterReachable, expectedIsSkipped}) => {
      it(`returns ${expectedIsSkipped} when isAnyPublicClusterReachable() returns ${isAnyPublicClusterReachable ? 'true' : 'false'}`, async () => {
        sinon.stub(testMeeting.webex.meetings.reachability, 'isAnyPublicClusterReachable').resolves(isAnyPublicClusterReachable);

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
        messageType: 'TURN_DISCOVERY_RESPONSE',
        headers: [
          `x-cisco-turn-url=${FAKE_TURN_URL}`,
          `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
          `x-cisco-turn-password=${FAKE_TURN_PASSWORD}`,
        ],
      }, 'from test');

      assert.notCalled(mockRoapRequest.sendRoap);
    });
  });

  describe('generateTurnDiscoveryRequestMessage', () => {
    let td;

    beforeEach(() => {
      td = new TurnDiscovery(mockRoapRequest);
      sinon.stub(td, 'getSkipReason').resolves(undefined);
    });

    it('generates TURN_DISCOVERY_REQUEST message irrespective of skip reason when called with isForced=true', async () => {
      td.getSkipReason.resolves('reachability');

      const result = await td.generateTurnDiscoveryRequestMessage(testMeeting, true);

      assert.deepEqual(result, {
        roapMessage: {
          messageType: 'TURN_DISCOVERY_REQUEST',
          version: '2',
          seq: 0,
          headers: ['includeAnswerInHttpResponse', 'noOkInTransaction'],
        },
        turnDiscoverySkippedReason: undefined,
      });
    });

    it('takes into account skip reason when called with isForced=false', async () => {
      td.getSkipReason.resolves('reachability');

      const result = await td.generateTurnDiscoveryRequestMessage(testMeeting, false);

      assert.deepEqual(result, {
        roapMessage: undefined,
        turnDiscoverySkippedReason: 'reachability',
      });
    });

    it('generates TURN_DISCOVERY_REQUEST message if there is no skip reason when called with isForced=false', async () => {
      const result = await td.generateTurnDiscoveryRequestMessage(testMeeting, false);

      assert.deepEqual(result, {
        roapMessage: {
          messageType: 'TURN_DISCOVERY_REQUEST',
          version: '2',
          seq: 0,
          headers: ['includeAnswerInHttpResponse', 'noOkInTransaction'],
        },
        turnDiscoverySkippedReason: undefined,
      });
    });

    it('returns "already in progress" if TURN_DISCOVERY_REQUEST was already generated', async () => {
      // 1st call
      await td.generateTurnDiscoveryRequestMessage(testMeeting, true);

      // 2nd call
      const result = await td.generateTurnDiscoveryRequestMessage(testMeeting, true);

      assert.deepEqual(result, {
        roapMessage: undefined,
        turnDiscoverySkippedReason: 'already in progress',
      });
    });

    it('returns "already in progress" if doTurnDiscovery was called and not completed', async () => {
      let promiseResolve;

      // set it up so that doTurnDiscovery doesn't complete
      mockRoapRequest.sendRoap = sinon.fake.returns(new Promise((resolve) => {
        promiseResolve = resolve;
      }));
      td.doTurnDiscovery(testMeeting, false, true);

      // now call generateTurnDiscoveryRequestMessage
      const result = await td.generateTurnDiscoveryRequestMessage(testMeeting, true);

      assert.deepEqual(result, {
        roapMessage: undefined,
        turnDiscoverySkippedReason: 'already in progress',
      });

      // resolve the promise, just so that we don't leave it hanging
      promiseResolve();
    });
  });

  describe('handleTurnDiscoveryHttpResponse', () => {
    let td;
    let roapMessage;

    beforeEach(() => {
      roapMessage = {
        seq: 1,
        messageType: 'TURN_DISCOVERY_RESPONSE',
        errorType: undefined,
        errorCause: undefined,
        headers: [
          `x-cisco-turn-url=${FAKE_TURN_URL}`,
          `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
          `x-cisco-turn-password=${FAKE_TURN_PASSWORD}`,
          'noOkInTransaction'
        ],
      }

      td = new TurnDiscovery(mockRoapRequest);
    });

    // checks if another TURN discovery can be started without any problem
    const checkNextTurnDiscovery = async () => {
        // after each test check that another TURN discovery can be started without any problems
        const secondMessage = await td.generateTurnDiscoveryRequestMessage(testMeeting, true);

        assert.isDefined(secondMessage.roapMessage);
    };

    it('works as expected when called with undefined httpResponse', async () => {
      await td.generateTurnDiscoveryRequestMessage(testMeeting, true);

      const result = await td.handleTurnDiscoveryHttpResponse(testMeeting, undefined);

      assert.deepEqual(result, {
        turnServerInfo: undefined,
        turnDiscoverySkippedReason: 'missing http response',
      });
    });

    [
      {testCase: 'is missing mediaConnections', httpResponse: {}},
      {testCase: 'is missing mediaConnections[0]', httpResponse: {mediaConnections: []}},
      {testCase: 'is missing mediaConnections[0].remoteSdp', httpResponse: {mediaConnections: [{}]}},
      {testCase: 'is missing roapMesssage in mediaConnections[0].remoteSdp', httpResponse: {mediaConnections: [{remoteSdp: JSON.stringify({something: "whatever"})}]}},
    ].forEach(({testCase, httpResponse}) => {
      it(`handles httpResponse that ${testCase}`, async () => {
        await td.generateTurnDiscoveryRequestMessage(testMeeting, true);

        const result = await td.handleTurnDiscoveryHttpResponse(testMeeting, httpResponse);

        assert.deepEqual(result, {
          turnServerInfo: undefined,
          turnDiscoverySkippedReason: 'missing http response',
        });
      });
      });

      it('handles httpResponse with invalid JSON in mediaConnections[0].remoteSdp', async () => {
        await td.generateTurnDiscoveryRequestMessage(testMeeting, true);

        const result = await td.handleTurnDiscoveryHttpResponse(testMeeting, {mediaConnections: [{remoteSdp: 'not a json'}]});

        assert.deepEqual(result, {
          turnServerInfo: undefined,
          turnDiscoverySkippedReason: 'failure: Unexpected token o in JSON at position 1',
        });
      });

      it('fails when called before generateTurnDiscoveryRequestMessage() was called', async () => {
        const httpResponse = {mediaConnections: [{remoteSdp: JSON.stringify({roapMessage})}]};
        await assert.isRejected(td.handleTurnDiscoveryHttpResponse(testMeeting, httpResponse),
          'handleTurnDiscoveryHttpResponse() called before generateTurnDiscoveryRequestMessage()');
      });

      it('works as expected when called with valid httpResponse', async () => {
        const httpResponse = {mediaConnections: [{remoteSdp: JSON.stringify({roapMessage})}]};

        // we spy on handleTurnDiscoveryResponse and check that it's called so that we don't have to repeat
        // all the edge case tests here, they're already covered in other tests that call handleTurnDiscoveryResponse
        const handleTurnDiscoveryResponseSpy = sinon.spy(td, 'handleTurnDiscoveryResponse');

        await td.generateTurnDiscoveryRequestMessage(testMeeting, true);
        const result = await td.handleTurnDiscoveryHttpResponse(testMeeting, httpResponse);

        assert.deepEqual(result, {
          turnServerInfo: {
            url: FAKE_TURN_URL,
            username: FAKE_TURN_USERNAME,
            password: FAKE_TURN_PASSWORD,
          },
          turnDiscoverySkippedReason: undefined,
        });

        assert.calledOnceWithExactly(handleTurnDiscoveryResponseSpy, roapMessage, 'in http response');
      });

      it('works as expected when httpResponse is missing some headers', async () => {
        roapMessage.headers = [
          `x-cisco-turn-url=${FAKE_TURN_URL}`, // missing headers for username and password
        ];

        const httpResponse = {mediaConnections: [{remoteSdp: JSON.stringify({roapMessage})}]};

        // we spy on handleTurnDiscoveryResponse and check that it's called so that we don't have to repeat
        // all the edge case tests here, they're already covered in other tests that call handleTurnDiscoveryResponse
        // we test just this 1 edge case here to confirm that when handleTurnDiscoveryResponse rejects, we get the correct result
        const handleTurnDiscoveryResponseSpy = sinon.spy(td, 'handleTurnDiscoveryResponse');

        await td.generateTurnDiscoveryRequestMessage(testMeeting, true);
        const result = await td.handleTurnDiscoveryHttpResponse(testMeeting, httpResponse);

        assert.deepEqual(result, {
          turnServerInfo: undefined,
          turnDiscoverySkippedReason: 'failure: TURN_DISCOVERY_RESPONSE in http response missing some headers: ["x-cisco-turn-url=turns:fakeTurnServer.com:443?transport=tcp"]',
        });
        assert.calledOnceWithExactly(handleTurnDiscoveryResponseSpy, roapMessage, 'in http response');

        checkNextTurnDiscovery();
      });

      it('sends OK when required', async () => {
        roapMessage.headers = [
          `x-cisco-turn-url=${FAKE_TURN_URL}`,
          `x-cisco-turn-username=${FAKE_TURN_USERNAME}`,
          `x-cisco-turn-password=${FAKE_TURN_PASSWORD}`,
          // noOkInTransaction is missing
        ];
        const httpResponse = {mediaConnections: [{remoteSdp: JSON.stringify({roapMessage})}]};

        await td.generateTurnDiscoveryRequestMessage(testMeeting, true);
        const result = await td.handleTurnDiscoveryHttpResponse(testMeeting, httpResponse);

        assert.deepEqual(result, {
          turnServerInfo: {
            url: FAKE_TURN_URL,
            username: FAKE_TURN_USERNAME,
            password: FAKE_TURN_PASSWORD,
          },
          turnDiscoverySkippedReason: undefined,
        });

        // check that OK was sent along with the metric for it
        await checkRoapMessageSent('OK', 0);

        assert.calledWith(
          Metrics.sendBehavioralMetric,
          BEHAVIORAL_METRICS.TURN_DISCOVERY_REQUIRES_OK,
          sinon.match({
            correlation_id: testMeeting.correlationId,
            locus_id: FAKE_LOCUS_ID,
          })
        );

        checkNextTurnDiscovery();
      });

      describe('abort', () => {
        it('allows starting a new TURN discovery', async () => {
          let result;

          // this mock is required for doTurnDiscovery() to work
          mockRoapRequest.sendRoap = sinon.fake.resolves({
            mediaConnections: [
              {
                mediaId: '464ff97f-4bda-466a-ad06-3a22184a2274',
                remoteSdp: `{"roapMessage": {"messageType":"TURN_DISCOVERY_RESPONSE","seq":"0","headers": ["x-cisco-turn-url=${FAKE_TURN_URL}","x-cisco-turn-username=${FAKE_TURN_USERNAME}","x-cisco-turn-password=${FAKE_TURN_PASSWORD}", "noOkInTransaction"]}}`,
              },
            ],
          });

          result = await td.generateTurnDiscoveryRequestMessage(testMeeting, true);
          assert.isDefined(result.roapMessage);

          td.abort();

          result = await td.generateTurnDiscoveryRequestMessage(testMeeting, true);
          assert.isDefined(result.roapMessage);

          td.abort();

          // check also that doTurnDiscovery()  works after abort()
          result = await td.doTurnDiscovery(testMeeting, false);
        });

        it('does nothing when called outside of a TURN discovery', async () => {
          let result;

          // call abort() without any other calls before it - it should do nothing
          // there is not much we can check, so afterwards we just check that we can start a new TURN discovery
          td.abort();

          result = await td.generateTurnDiscoveryRequestMessage(testMeeting, true);
          assert.isDefined(result.roapMessage);
        });
      });
  });
});
