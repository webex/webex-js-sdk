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

  describe('#processParticipant', ()=>{
    it('checks that processParticipant calls isHandRaised', () => {
      sinon.spy(MemberUtil, 'isHandRaised');
      member.processParticipant(participant);
  
      assert.calledOnceWithExactly(MemberUtil.isHandRaised, participant);
    });
  })

  describe('#processMember', ()=>{
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
  })
});
