import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import TurnDiscovery from '@webex/plugin-meetings/src/roap/turnDiscovery';
import {ROAP} from '@webex/plugin-meetings/src/constants';

import RoapRequest from '@webex/plugin-meetings/src/roap/request';
import RoapHandler from '@webex/plugin-meetings/src/roap/handler';
import Roap from '@webex/plugin-meetings/src/roap/';
import Meeting from '@webex/plugin-meetings/src/meeting';

describe('Roap', () => {
  describe('doTurnDiscovery', () => {
    it('calls this.turnDiscovery.doTurnDiscovery() and forwards all the arguments', async () => {
      const RESULT = {something: 'some value'};
      const meeting = {id: 'some meeting id'} as Meeting;

      const doTurnDiscoveryStub = sinon
        .stub(TurnDiscovery.prototype, 'doTurnDiscovery')
        .resolves(RESULT);

      const roap = new Roap({}, {parent: 'fake'});

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
    let roapHandlerSubmitStub;
    let meeting;

    beforeEach(() => {
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
        setRoapSeq: sinon.stub(),
        config: {experimental: {enableTurnDiscovery: false}},
        webex: {meetings: {reachability: {isAnyClusterReachable: () => true}}},
      };

      beforeEach(() => {
        sendRoapStub = sinon.stub(RoapRequest.prototype, 'sendRoap').resolves({});
        roapHandlerSubmitStub = sinon.stub(RoapHandler.prototype, 'submit');
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
          const roap = new Roap({}, {parent: 'fake'});

          sinon.stub(roap.turnDiscovery, 'isSkipped').resolves(turnDiscoverySkipped);

          await roap.sendRoapMediaRequest({
            meeting,
            sdp: 'sdp',
            reconnect,
            roapSeq: 1,
          });

          const expectedRoapMessage = {
            messageType: 'OFFER',
            sdps: ['sdp'],
            version: '2',
            seq: 2,
            tieBreaker: 4294967294,
          };

          assert.calledOnce(sendRoapStub);
          assert.calledWith(sendRoapStub, {
            roapMessage: expectedRoapMessage,
            correlationId: meeting.correlationId,
            locusSelfUrl: meeting.selfUrl,
            mediaId: expectEmptyMediaId ? '' : meeting.mediaId,
            audioMuted: meeting.audio?.isLocallyMuted(),
            videoMuted: meeting.video?.isLocallyMuted(),
            meetingId: meeting.id,
          });

          assert.calledTwice(roapHandlerSubmitStub);
          assert.calledWith(roapHandlerSubmitStub, {
            type: ROAP.SEND_ROAP_MSG,
            msg: expectedRoapMessage,
            correlationId: meeting.correlationId,
          });
          assert.calledWith(roapHandlerSubmitStub, {
            type: ROAP.SEND_ROAP_MSG_SUCCESS,
            seq: 2,
            correlationId: meeting.correlationId,
          });

          assert.calledOnce(meeting.setRoapSeq);
          assert.calledWith(meeting.setRoapSeq, 2);
        })
      );
    });
  });
});
