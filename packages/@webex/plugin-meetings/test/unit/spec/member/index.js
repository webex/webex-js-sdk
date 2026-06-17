import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';

import MemberUtil from '@webex/plugin-meetings/src/member/util';
import Member from '@webex/plugin-meetings/src/member';

describe('member', () => {
  const participant = {controls: {}, status: {}};

  const member = new Member(participant);

  afterEach(() => {
    sinon.restore();
  });

  it('checks member properties', () => {
    assert.exists(member.supportsInterpretation);
    assert.exists(member.supportsBreakouts);
    assert.exists(member.supportLiveAnnotation);
    assert.exists(member.canReclaimHost);
    assert.exists(member.canApproveAIEnablement);
  });

  describe('roles', () => {
    it('checks that processParticipant calls processRoles', () => {
      sinon.spy(member, 'processRoles');
      member.processParticipant(participant);

      assert.calledOnceWithExactly(member.processRoles, participant);
    });

    it('checks that processRoles calls extractControlRoles', () => {
      sinon.spy(MemberUtil, 'extractControlRoles');
      member.processParticipant(participant);

      assert.calledOnceWithExactly(MemberUtil.extractControlRoles, participant);
    });
  });

  describe('#processParticipant', () => {
    it('checks that processParticipant calls isHandRaised', () => {
      sinon.spy(MemberUtil, 'isHandRaised');
      member.processParticipant(participant);

      assert.calledOnceWithExactly(MemberUtil.isHandRaised, participant);
    });

    it('checks that processParticipant calls canReclaimHost', () => {
      sinon.spy(MemberUtil, 'canReclaimHost');
      member.processParticipant(participant);

      assert.calledOnceWithExactly(MemberUtil.canReclaimHost, participant);
    });

    it('checks that processParticipant calls isPresenterAssignmentProhibited', () => {
      sinon.spy(MemberUtil, 'isPresenterAssignmentProhibited');
      member.processParticipant(participant);

      assert.calledOnceWithExactly(MemberUtil.isPresenterAssignmentProhibited, participant);
    });

    it('checks that processParticipant calls isAttendeeAssignmentProhibited', () => {
      sinon.spy(MemberUtil, 'isAttendeeAssignmentProhibited');
      member.processParticipant(participant);

      assert.calledOnceWithExactly(MemberUtil.isAttendeeAssignmentProhibited, participant);
    });

    it('checks that processParticipant calls canApproveAIEnablement', () => {
      sinon.spy(MemberUtil, 'canApproveAIEnablement');
      member.processParticipant(participant);

      assert.calledOnceWithExactly(MemberUtil.canApproveAIEnablement, participant);
    });
  });

  describe('#processMember', () => {
    it('checks that processMember calls isRemovable', () => {
      sinon.spy(MemberUtil, 'isRemovable');
      member.processMember();

      assert.calledOnce(MemberUtil.isRemovable);
    });

    it('checks that processMember calls isMutable', () => {
      sinon.spy(MemberUtil, 'isMutable');
      member.processMember();

      assert.calledOnce(MemberUtil.isMutable);
    });

    it('checks that processMember calls extractMediaStatus', () => {
      sinon.spy(MemberUtil, 'extractMediaStatus');
      member.processMember();

      assert.calledOnceWithExactly(MemberUtil.extractMediaStatus, participant);
    });
  });

  describe('canApproveAIEnablement integration', () => {
    it('sets canApproveAIEnablement to the value returned by MemberUtil.canApproveAIEnablement', () => {
      const testParticipant = {controls: {}, status: {}};

      sinon.stub(MemberUtil, 'canApproveAIEnablement').returns(true);
      const memberWithTrue = new Member(testParticipant);
      assert.isTrue(memberWithTrue.canApproveAIEnablement);

      MemberUtil.canApproveAIEnablement.restore();

      sinon.stub(MemberUtil, 'canApproveAIEnablement').returns(false);
      const memberWithFalse = new Member(testParticipant);
      assert.isFalse(memberWithFalse.canApproveAIEnablement);
    });
  });
});
