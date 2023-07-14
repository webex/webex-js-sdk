import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';

import MemberUtil from '@webex/plugin-meetings/src/member/util';
import Member from '@webex/plugin-meetings/src/member';

describe('member', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('checks member properties', () => {
    const member = new Member({});
    assert.exists(member.supportsInterpretation);
    assert.exists(member.supportsBreakouts);
    assert.exists(member.supportLiveAnnotation);
  });

  it('checks that processParticipant calls isHandRaised', () => {
    const participant = {controls: {}};

    const member = new Member({});

    sinon.spy(MemberUtil, 'isHandRaised');
    member.processParticipant(participant);

    assert.calledOnceWithExactly(MemberUtil.isHandRaised, participant);
  });

  describe('roles', () => {
    it('checks that processParticipant calls processRoles', () => {
      const participant = {};

      const member = new Member({});

      sinon.spy(member, 'processRoles');
      member.processParticipant(participant);

      assert.calledOnceWithExactly(member.processRoles, participant);
    });

    it('checks that processRoles calls extractControlRoles', () => {
      const participant = {};

      const member = new Member({});

      sinon.spy(MemberUtil, 'extractControlRoles');
      member.processParticipant(participant);

      assert.calledOnceWithExactly(MemberUtil.extractControlRoles, participant);
    });
  })
});
