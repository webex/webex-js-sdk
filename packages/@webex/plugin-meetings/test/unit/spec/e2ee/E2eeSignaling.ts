/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import E2eeSignaling from '@webex/plugin-meetings/src/e2ee/E2eeSignaling';
import {
  LLM_ONLINE_EVENT,
  MEDIA_ENCRYPTION_MERCURY_EVENTS,
} from '@webex/plugin-meetings/src/e2ee/constants';

describe('plugin-meetings', () => {
  describe('E2eeSignaling', () => {
    let session;
    let llm;
    let signaling;

    beforeEach(() => {
      llm = {
        on: sinon.stub(),
        off: sinon.stub(),
        isConnected: sinon.stub().returns(false),
        getLocusUrl: sinon.stub().returns('locus-1'),
      };
      session = {
        handleEvent: sinon.stub(),
        setLlmConnectedBeforeJoin: sinon.stub(),
        notifyLlmConnected: sinon.stub(),
      };
      signaling = new E2eeSignaling({llm, getLocusUrl: () => 'locus-1', session});
    });

    afterEach(() => {
      sinon.restore();
    });

    it('subscribes to every mercury event on start', () => {
      signaling.start();

      MEDIA_ENCRYPTION_MERCURY_EVENTS.forEach((event) => {
        assert.calledWith(llm.on, event, sinon.match.func);
      });
    });

    it('forwards mercury event data to the session as JSON bytes', () => {
      signaling.start();

      const handler = llm.on.getCall(0).args[1];

      handler({data: {foo: 'bar'}});

      assert.calledOnce(session.handleEvent);
      const bytes = session.handleEvent.firstCall.args[0];

      assert.instanceOf(bytes, Uint8Array);
      assert.deepEqual(JSON.parse(new TextDecoder().decode(bytes)), {foo: 'bar'});
    });

    it('tells the engine the channel is already connected when online for this meeting', () => {
      llm.isConnected.returns(true);
      llm.getLocusUrl.returns('locus-1');

      signaling.start();

      assert.calledOnceWithExactly(session.setLlmConnectedBeforeJoin, true);
      assert.neverCalledWith(llm.on, LLM_ONLINE_EVENT, sinon.match.func);
    });

    it('waits for online and notifies only when it is for this meeting', () => {
      signaling.start();

      const onlineCall = llm.on.getCalls().find((call) => call.args[0] === LLM_ONLINE_EVENT);

      assert.isDefined(onlineCall);
      const onOnline = onlineCall.args[1];

      // Online for a different meeting -> no notify.
      llm.isConnected.returns(true);
      llm.getLocusUrl.returns('other-locus');
      onOnline();
      assert.notCalled(session.notifyLlmConnected);

      // Online for our meeting -> notify.
      llm.getLocusUrl.returns('locus-1');
      onOnline();
      assert.calledOnce(session.notifyLlmConnected);
    });

    it('removes all subscriptions on stop', () => {
      signaling.start();
      signaling.stop();

      MEDIA_ENCRYPTION_MERCURY_EVENTS.forEach((event) => {
        assert.calledWith(llm.off, event, sinon.match.func);
      });
      assert.calledWith(llm.off, LLM_ONLINE_EVENT, sinon.match.func);
    });

    it('is idempotent across repeated start/stop calls', () => {
      signaling.start();
      const onCountAfterStart = llm.on.callCount;

      signaling.start();
      assert.equal(llm.on.callCount, onCountAfterStart);

      signaling.stop();
      const offCountAfterStop = llm.off.callCount;

      signaling.stop();
      assert.equal(llm.off.callCount, offCountAfterStop);
    });
  });
});
