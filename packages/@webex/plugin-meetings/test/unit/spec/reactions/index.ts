/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import uuid from 'uuid';
import MockWebex from '@webex/test-helper-mock-webex';
import LLMChannel from '@webex/internal-plugin-llm';
import Mercury from '@webex/internal-plugin-mercury';
import Meetings from '@webex/plugin-meetings/src/meetings';
import Members from '@webex/plugin-meetings/src/members';
import Reactions from '@webex/plugin-meetings/src/reactions';
import {REACTION_RELAY_TYPES} from '@webex/plugin-meetings/src/reactions/constants';

describe('plugin-meetings', () => {
  let webex = null;
  let reactions = null;
  let members = null;
  let llm = null;

  const fakeCallbackFunction = sinon.stub();
  const fakeSendersName = 'Fake reactors name';
  const fakeReactionPayload = {
    type: 'fake_type',
    codepoints: 'fake_codepoints',
    shortcodes: 'fake_shortcodes',
    tone: {
      type: 'fake_tone_type',
      codepoints: 'fake_tone_codepoints',
      shortcodes: 'fake_tone_shortcodes',
    },
  };
  const fakeSenderPayload = {
    participantId: 'fake_participant_id',
  };
  const fakeProcessedReaction = {
    reaction: fakeReactionPayload,
    sender: {
      id: fakeSenderPayload.participantId,
      name: fakeSendersName,
    },
  };

  describe('Reactions', () => {
    beforeEach(() => {
      webex = new MockWebex({
        children: {
          meetings: Meetings,
          mercury: Mercury,
          llm: LLMChannel,
        },
      });
      members = new Members({locusUrl: `https://example.com/${uuid.v4()}`}, {parent: webex});
      members.membersCollection.get = sinon.stub().returns({name: fakeSendersName});
      reactions = new Reactions(members, webex.internal.llm);
      llm = webex.internal.llm;
    });

    afterEach(() => {
      sinon.reset();
    });

    describe('#subscribe', () => {
      it('should start listening on relay events', () => {
        const fakeCallbackFunction = sinon.stub();
        reactions.processEvent = fakeCallbackFunction
        const spy = sinon.spy(webex.internal.llm, 'on');

        reactions.subscribe(fakeCallbackFunction);

        assert.calledOnceWithExactly(spy, 'event:relay.event', reactions.processEvent);
      });

      it('should process reaction when one is received', () => {
        reactions.processReaction = sinon.stub().returns(fakeProcessedReaction);
        reactions.subscribe(fakeCallbackFunction);
        llm._emit('event:relay.event', {
          data: {
            relayType: REACTION_RELAY_TYPES.REACTION,
            reaction: fakeReactionPayload,
            sender: fakeSenderPayload,
          },
        });
        assert.calledOnceWithExactly(
          reactions.processReaction,
          fakeReactionPayload,
          fakeSenderPayload
        );
        assert.calledOnceWithExactly(fakeCallbackFunction, fakeProcessedReaction);
      });

      it('should not process reaction when event type is not reaction', () => {
        const processReactionSpy = sinon.spy(reactions, 'processReaction');
        reactions.subscribe(fakeCallbackFunction);
        llm._emit('event:relay.event', {
          data: {
            relayType: 'different_event_type',
            reaction: fakeReactionPayload,
            sender: fakeSenderPayload,
          },
        });
        assert.notCalled(processReactionSpy);
        assert.notCalled(fakeCallbackFunction);
      });
    });

    describe('#unsuscribe', () => {
        it('should stop listening on relay events', () => {
          reactions.processEvent = sinon.stub();
          const spy = sinon.spy(webex.internal.llm, 'off');
  
          reactions.unsubscribe();
  
          assert.calledOnceWithExactly(spy, 'event:relay.event', reactions.processEvent);
        });
      });

    describe('#processReaction', () => {
        it('should stop listening on relay events', () => {
          const result = reactions.processReaction(fakeReactionPayload, fakeSenderPayload);
          assert.match(result, fakeProcessedReaction);
        });
      });
  });
});
