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
      };

      sinon.stub(MeetingUtil, 'getIpVersion').returns(IP_VERSION.unknown);

      sendRoapStub = sinon.stub(RoapRequest.prototype, 'sendRoap').resolves({});
      meeting.setRoapSeq.resetHistory();
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
        const roap = new Roap({}, {parent: webex});

        sinon.stub(roap.turnDiscovery, 'isSkipped').resolves(turnDiscoverySkipped);

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
        };

        assert.calledOnce(sendRoapStub);
        assert.calledWith(sendRoapStub, sinon.match({
          roapMessage: expectedRoapMessage,
          locusSelfUrl: meeting.selfUrl,
          mediaId: expectEmptyMediaId ? '' : meeting.mediaId,
          audioMuted: meeting.audio?.isLocallyMuted(),
          videoMuted: meeting.video?.isLocallyMuted(),
          meetingId: meeting.id,
          locusMediaRequest: meeting.locusMediaRequest,
        }));
      })
    );
  });
});
