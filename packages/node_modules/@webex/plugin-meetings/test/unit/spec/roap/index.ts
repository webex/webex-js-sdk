import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import TurnDiscovery from '@webex/plugin-meetings/src/roap/turnDiscovery';
import {ROAP} from '@webex/plugin-meetings/src/constants';

import RoapRequest from '@webex/plugin-meetings/src/roap/request';
import RoapHandler from '@webex/plugin-meetings/src/roap/handler';
import Roap from '@webex/plugin-meetings/src/roap/';

describe('Roap', () => {
  describe('doTurnDiscovery', () => {
    it('calls this.turnDiscovery.doTurnDiscovery() and forwards all the arguments', async () => {
      const RESULT = {something: 'some value'};
      const meeting = {id: 'some meeting id'};

      const doTurnDiscoveryStub = sinon.stub(TurnDiscovery.prototype, 'doTurnDiscovery').resolves(RESULT);

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

    const meeting = {
      id: 'some meeting id',
      correlationId: 'correlation id',
      selfUrl: 'self url',
      mediaId: 'media id',
      isAudioMuted: () => true,
      isVideoMuted: () => false,
      setRoapSeq: sinon.stub(),
      config: {experimental: {enableTurnDiscovery: false}},
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
      {reconnect: true, enableTurnDiscovery: true, expectEmptyMediaId: false},
      {reconnect: true, enableTurnDiscovery: false, expectEmptyMediaId: true},
      {reconnect: false, enableTurnDiscovery: true, expectEmptyMediaId: false},
      {reconnect: false, enableTurnDiscovery: false, expectEmptyMediaId: false},
    ].forEach(({reconnect, enableTurnDiscovery, expectEmptyMediaId}) =>
      it(`sends roap OFFER with ${expectEmptyMediaId ? 'empty ' : ''}mediaId when ${reconnect ? '' : 'not '}reconnecting and TURN discovery is ${enableTurnDiscovery ? 'enabled' : 'disabled'}`, async () => {
        meeting.config.experimental.enableTurnDiscovery = enableTurnDiscovery;

        const roap = new Roap({}, {parent: 'fake'});

        await roap.sendRoapMediaRequest({
          meeting, sdp: 'sdp', reconnect, roapSeq: 1
        });

        const expectedRoapMessage = {
          messageType: 'OFFER',
          sdps: ['sdp'],
          version: '2',
          seq: 2,
          tieBreaker: 4294967294
        };

        assert.calledOnce(sendRoapStub);
        assert.calledWith(sendRoapStub, {
          roapMessage: expectedRoapMessage,
          correlationId: meeting.correlationId,
          locusSelfUrl: meeting.selfUrl,
          mediaId: expectEmptyMediaId ? '' : meeting.mediaId,
          audioMuted: meeting.isAudioMuted(),
          videoMuted: meeting.isVideoMuted(),
          meetingId: meeting.id
        });

        assert.calledTwice(roapHandlerSubmitStub);
        assert.calledWith(roapHandlerSubmitStub, {
          type: ROAP.SEND_ROAP_MSG,
          msg: expectedRoapMessage,
          correlationId: meeting.correlationId
        });
        assert.calledWith(roapHandlerSubmitStub, {
          type: ROAP.SEND_ROAP_MSG_SUCCESS,
          seq: 2,
          correlationId: meeting.correlationId
        });

        assert.calledOnce(meeting.setRoapSeq);
        assert.calledWith(meeting.setRoapSeq, 2);
      }));
  });
});
