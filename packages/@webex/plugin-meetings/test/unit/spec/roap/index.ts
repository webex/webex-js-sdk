import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import TurnDiscovery from '@webex/plugin-meetings/src/roap/turnDiscovery';
import MockWebex from '@webex/test-helper-mock-webex';

import RoapRequest from '@webex/plugin-meetings/src/roap/request';
import Roap from '@webex/plugin-meetings/src/roap/';
import Meeting from '@webex/plugin-meetings/src/meeting';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';

import { IP_VERSION } from '../../../../src/constants';

describe('Roap', () => {
  describe('doTurnDiscovery', () => {
    it('calls this.turnDiscovery.doTurnDiscovery() and forwards all the arguments', async () => {
      const webex = new MockWebex({});

      const RESULT = {something: 'some value'};
      const meeting = {id: 'some meeting id'} as Meeting;

      const doTurnDiscoveryStub = sinon
        .stub(TurnDiscovery.prototype, 'doTurnDiscovery')
        .resolves(RESULT);

      const roap = new Roap({}, {parent: webex});

      // call with isReconnecting: true
      const result = await roap.doTurnDiscovery(meeting, true);

      assert.calledOnceWithExactly(doTurnDiscoveryStub, meeting, true);
      assert.deepEqual(result, RESULT);

      doTurnDiscoveryStub.resetHistory();

      // and with isReconnecting: false
      const result2 = await roap.doTurnDiscovery(meeting, false);

      assert.calledOnceWithExactly(doTurnDiscoveryStub, meeting, false);
      assert.deepEqual(result2, RESULT);

      sinon.restore();
    });
  });

  describe('sendRoapMediaRequest', () => {
    let sendRoapStub;
    let meeting;

    let webex;
    let roap;

    const fakeLocus = { id: 'fake locus'};

    beforeEach(() => {
      webex = new MockWebex({});
      meeting = {
        id: 'some meeting id',
        correlationId: 'correlation id',
        selfUrl: 'self url',
        mediaId: 'media id',
        audio:{
          isLocallyMuted: () => true,
        },
        video:{
          isLocallyMuted: () => false,
        },
        setRoapSeq: sinon.stub(),
        config: {experimental: {enableTurnDiscovery: false}},
        locusMediaRequest: {fake: true},
        webex: { meetings: { reachability: { isAnyPublicClusterReachable: () => true}}},
        updateMediaConnections: sinon.stub(),
      };

      sinon.stub(MeetingUtil, 'getIpVersion').returns(IP_VERSION.unknown);

      sendRoapStub = sinon.stub(RoapRequest.prototype, 'sendRoap').resolves({});
      meeting.setRoapSeq.resetHistory();

      roap = new Roap({}, {parent: webex});
      sinon.stub(roap.turnDiscovery, 'isSkipped').resolves(false);
    });

    afterEach(() => {
      sinon.restore();
    });

    [
      {reconnect: true, turnDiscoverySkipped: false, expectEmptyMediaId: false},
      {reconnect: true, turnDiscoverySkipped: true, expectEmptyMediaId: true},
      {reconnect: false, turnDiscoverySkipped: false, expectEmptyMediaId: false},
      {reconnect: false, turnDiscoverySkipped: true, expectEmptyMediaId: false},
    ].forEach(({reconnect, turnDiscoverySkipped, expectEmptyMediaId}) =>
      it(`sends roap OFFER with ${expectEmptyMediaId ? 'empty ' : ''}mediaId when ${
        reconnect ? '' : 'not '
      }reconnecting and TURN discovery is ${
        turnDiscoverySkipped ? 'skipped' : 'not skipped'
      }`, async () => {
        roap.turnDiscovery.isSkipped.resolves(turnDiscoverySkipped);

        await roap.sendRoapMediaRequest({
          meeting,
          sdp: 'sdp',
          reconnect,
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
        assert.calledWith(sendRoapStub, sinon.match({
          roapMessage: expectedRoapMessage,
          locusSelfUrl: meeting.selfUrl,
          mediaId: expectEmptyMediaId ? '' : meeting.mediaId,
          meetingId: meeting.id,
          locusMediaRequest: meeting.locusMediaRequest,
        }));
      })
    );

    it('reads SDP answer from the http response', async () => {
      const roapAnswer = {
        seq: 5,
        messageType: 'ANSWER',
        sdps : ['sdp answer'],
        errorType: 'error type', // normally ANSWER would not have errorType or errorCause (only error messages have these)
        errorCause: 'error cause', // but we're just testing here that all the fields are forwarded to the caller of sendRoapMediaRequest()
        headers: ['header1', 'header2'],
      }
      const fakeMediaConnections = [{
        remoteSdp: JSON.stringify({
          roapMessage: roapAnswer
        })
      }];

      sendRoapStub.resolves({
        mediaConnections: fakeMediaConnections,
        locus: fakeLocus
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
        }
      });
    });

    it('handles the case when there is no answer in the http response', async () => {
      const fakeMediaConnections = [{
        // this is the actual value Locus returns to us when they don't send Roap ANSWER in the http response
        remoteSdp: "{\"audioMuted\":false,\"videoMuted\":false,\"csis\":[],\"dtmfReceiveSupported\":true,\"type\":\"SDP\"}",
      }];

      sendRoapStub.resolves({
        mediaConnections: fakeMediaConnections,
        locus: fakeLocus
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
        roapAnswer: undefined
      });
    });

    describe('does not crash when http response is missing things', () => {

    });
    [
      {mediaConnections: undefined, title: 'mediaConnections are undefined'},
      {mediaConnections: [], title: 'mediaConnections are empty array'},
      {mediaConnections: [{}], title: 'mediaConnections[0] has no remoteSdp'},
      {mediaConnections: [{remoteSdp: '{}'}], title: 'mediaConnections[0].remoteSdp is an empty json'},
    ].forEach(({mediaConnections, title}) =>
      it(title, async () => {
        sendRoapStub.resolves({
          mediaConnections,
          locus: fakeLocus
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
          roapAnswer: undefined
        });
      }))
    ;
  });
});
