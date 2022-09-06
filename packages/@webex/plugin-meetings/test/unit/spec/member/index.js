import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';

import MemberUtil from '@webex/plugin-meetings/src/member/util';
import Member from '@webex/plugin-meetings/src/member';


describe('member', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('checks that processParticipant calls isHandRaised', () => {
    const participant = {controls: {}};

    const member = new Member({});

    sinon.spy(MemberUtil, 'isHandRaised');
    member.processParticipant(participant);

    assert.calledOnceWithExactly(MemberUtil.isHandRaised, participant);
  });
});
