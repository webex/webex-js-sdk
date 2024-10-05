import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import TurnDiscovery from '@webex/plugin-meetings/src/roap/turnDiscovery';
import MockWebex from '@webex/test-helper-mock-webex';

import RoapRequest from '@webex/plugin-meetings/src/roap/request';
import Roap from '@webex/plugin-meetings/src/roap/';
import Meeting from '@webex/plugin-meetings/src/meeting';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';
import Metrics from '@webex/plugin-meetings/src/metrics';
import BEHAVIORAL_METRICS from '@webex/plugin-meetings/src/metrics/constants';

import { IP_VERSION } from '../../../../src/constants';

describe('Roap', () => {
  let webex;

  const RESULT = {something: 'some value'};
  const meeting = {id: 'some meeting id'} as Meeting;

  beforeEach(() => {
    webex = new MockWebex({});
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('doTurnDiscovery', () => {
    [false, true].forEach(function (isReconnecting) {
      [false, true, undefined].forEach(function (isForced) {
        it(`calls this.turnDiscovery.doTurnDiscovery() and forwards all the arguments when isReconnecting = ${isReconnecting} and isForced = ${isForced}`, async () => {
          const doTurnDiscoveryStub = sinon
            .stub(TurnDiscovery.prototype, 'doTurnDiscovery')
            .resolves(RESULT);

          const roap = new Roap({}, {parent: webex});

          const result = await roap.doTurnDiscovery(meeting, isReconnecting, isForced);

          assert.calledOnceWithExactly(doTurnDiscoveryStub, meeting, isReconnecting, isForced);
          assert.deepEqual(result, RESULT);
        });
      });
    });

    describe('generateTurnDiscoveryRequestMessage', () => {
      [false, true].forEach(function (isForced) {
        it(`calls this.turnDiscovery.generateTurnDiscoveryRequestMessage with isForced=${isForced}`, async () => {
          const generateTurnDiscoveryRequestMessageStub = sinon
            .stub(TurnDiscovery.prototype, 'generateTurnDiscoveryRequestMessage')
            .resolves(RESULT);

          const roap = new Roap({}, {parent: webex});

          const result = await roap.generateTurnDiscoveryRequestMessage(meeting, isForced);

          assert.calledOnceWithExactly(generateTurnDiscoveryRequestMessageStub, meeting, isForced);
          assert.deepEqual(result, RESULT);
        });
      });
    });

    describe('handleTurnDiscoveryHttpResponse', () => {
      it('calls this.turnDiscovery.handleTurnDiscoveryHttpResponse', async () => {
        const handleTurnDiscoveryHttpResponseStub = sinon
          .stub(TurnDiscovery.prototype, 'handleTurnDiscoveryHttpResponse')
          .resolves(RESULT);

        const httpReponse = {some: 'http response'};

        const roap = new Roap({}, {parent: webex});

        const result = await roap.handleTurnDiscoveryHttpResponse(meeting, httpReponse);

        assert.calledOnceWithExactly(handleTurnDiscoveryHttpResponseStub, meeting, httpReponse);
        assert.deepEqual(result, RESULT);
      });
    });

    describe('abortTurnDiscovery', () => {
      it('calls this.turnDiscovery.abort', async () => {
        const abortStub = sinon
          .stub(TurnDiscovery.prototype, 'abort')
          .returns(RESULT);

        const roap = new Roap({}, {parent: webex});

        const result = await roap.abortTurnDiscovery();

        assert.calledOnceWithExactly(abortStub);
        assert.deepEqual(result, RESULT);
      });
    });
  });

  describe('sendRoapMediaRequest', () => {
    let sendRoapStub;
    let meeting;

    let webex;
    let roap;

    const fakeLocus = {id: 'fake locus'};

    beforeEach(() => {
      webex = new MockWebex({});
      meeting = {
        id: 'some meeting id',
        correlationId: 'correlation id',
        selfUrl: 'self url',
        mediaId: 'media id',
        audio: {
          isLocallyMuted: () => true,
        },
        video: {
          isLocallyMuted: () => false,
        },
        isMultistream: true,
        setRoapSeq: sinon.stub(),
        locusMediaRequest: {fake: true},
        webex: {meetings: {reachability: {isAnyPublicClusterReachable: () => true}}},
        updateMediaConnections: sinon.stub(),
      };

      sinon.stub(MeetingUtil, 'getIpVersion').returns(IP_VERSION.unknown);
      sinon.stub(Metrics, 'sendBehavioralMetric');

      sendRoapStub = sinon.stub(RoapRequest.prototype, 'sendRoap').resolves({});
      meeting.setRoapSeq.resetHistory();

      roap = new Roap({}, {parent: webex});
      sinon.stub(roap.turnDiscovery, 'isSkipped').resolves(false);
    });

    afterEach(() => {
      sinon.restore();
    });

    it(`sends roap OFFER`, async () => {
      await roap.sendRoapMediaRequest({
        meeting,
        sdp: 'sdp',
        seq: 2,
        tieBreaker: 4294967294,
      });

      const expectedRoapMessage = {
        messageType: 'OFFER',
        sdps: ['sdp'],
        version: '2',
        seq: 2,
        tieBreaker: 4294967294,
        headers: ['includeAnswerInHttpResponse', 'noOkInTransaction'],
      };

      assert.calledOnce(sendRoapStub);
      assert.calledWith(
        sendRoapStub,
        sinon.match({
          roapMessage: expectedRoapMessage,
          locusSelfUrl: meeting.selfUrl,
          mediaId: meeting.mediaId,
          meetingId: meeting.id,
          locusMediaRequest: meeting.locusMediaRequest,
        })
      );
    });

    it('reads SDP answer from the http response', async () => {
      const roapAnswer = {
        seq: 5,
        messageType: 'ANSWER',
        sdps: ['sdp answer'],
        errorType: 'error type', // normally ANSWER would not have errorType or errorCause (only error messages have these)
        errorCause: 'error cause', // but we're just testing here that all the fields are forwarded to the caller of sendRoapMediaRequest()
        headers: ['header1', 'header2'],
      };
      const fakeMediaConnections = [
        {
          remoteSdp: JSON.stringify({
            roapMessage: roapAnswer,
          }),
        },
      ];

      sendRoapStub.resolves({
        mediaConnections: fakeMediaConnections,
        locus: fakeLocus,
      });

      const result = await roap.sendRoapMediaRequest({
        meeting,
        sdp: 'sdp',
        reconnect: false,
        seq: 1,
        tieBreaker: 4294967294,
      });

      assert.calledOnce(sendRoapStub);
      assert.calledOnceWithExactly(meeting.updateMediaConnections, fakeMediaConnections);
      assert.deepEqual(result, {
        locus: fakeLocus,
        roapAnswer: {
          seq: 5,
          messageType: 'ANSWER',
          sdp: 'sdp answer',
          errorType: 'error type',
          errorCause: 'error cause',
          headers: ['header1', 'header2'],
        },
      });
    });

    it('handles the case when there is no answer in the http response', async () => {
      const fakeMediaConnections = [
        {
          // this is the actual value Locus returns to us when they don't send Roap ANSWER in the http response
          remoteSdp:
            '{"audioMuted":false,"videoMuted":false,"csis":[],"dtmfReceiveSupported":true,"type":"SDP"}',
        },
      ];

      sendRoapStub.resolves({
        mediaConnections: fakeMediaConnections,
        locus: fakeLocus,
      });

      const result = await roap.sendRoapMediaRequest({
        meeting,
        sdp: 'sdp',
        reconnect: false,
        seq: 1,
        tieBreaker: 4294967294,
      });

      assert.calledOnce(sendRoapStub);
      assert.calledOnceWithExactly(meeting.updateMediaConnections, fakeMediaConnections);
      assert.deepEqual(result, {
        locus: fakeLocus,
        roapAnswer: undefined,
      });
      assert.calledOnceWithExactly(
        Metrics.sendBehavioralMetric,
        BEHAVIORAL_METRICS.ROAP_HTTP_RESPONSE_MISSING,
        {
          correlationId: meeting.correlationId,
          messageType: 'ANSWER',
          isMultistream: meeting.isMultistream,
        }
      );
    });

    describe('does not crash when http response is missing things', () => {
      [
        {mediaConnections: undefined, title: 'mediaConnections are undefined'},
        {mediaConnections: [], title: 'mediaConnections are empty array'},
        {mediaConnections: [{}], title: 'mediaConnections[0] has no remoteSdp'},
        {
          mediaConnections: [{remoteSdp: '{}'}],
          title: 'mediaConnections[0].remoteSdp is an empty json',
        },
      ].forEach(({mediaConnections, title}) =>
        it(title, async () => {
          sendRoapStub.resolves({
            mediaConnections,
            locus: fakeLocus,
          });

          const result = await roap.sendRoapMediaRequest({
            meeting,
            sdp: 'sdp',
            reconnect: false,
            seq: 1,
            tieBreaker: 4294967294,
          });

          assert.calledOnce(sendRoapStub);
          assert.deepEqual(result, {
            locus: fakeLocus,
            roapAnswer: undefined,
          });

          assert.calledOnceWithExactly(
            Metrics.sendBehavioralMetric,
            BEHAVIORAL_METRICS.ROAP_HTTP_RESPONSE_MISSING,
            {
              correlationId: meeting.correlationId,
              messageType: 'ANSWER',
              isMultistream: meeting.isMultistream,
            }
          );
        })
      );
    });
  });
});
