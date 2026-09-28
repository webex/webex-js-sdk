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

  describe('e2ee verification', () => {
    const makeVerification = (deviceUrl, verified) => ({
      deviceUrl,
      verified,
      validationResult: verified ? 0 : 1,
      displayName: 'Alice',
      deviceType: 'WEB',
    });

    it('defaults to an empty verification map and unknown state', () => {
      const freshMember = new Member({controls: {}, status: {}});

      assert.instanceOf(freshMember.e2eeDeviceVerifications, Map);
      assert.equal(freshMember.e2eeDeviceVerifications.size, 0);
      assert.equal(freshMember.e2eeVerificationState, 'unknown');
      assert.deepEqual(freshMember.getE2eeDeviceVerifications(), []);
    });

    it('stores per-device verifications and exposes them by url', () => {
      const freshMember = new Member({controls: {}, status: {}});
      const verificationA = makeVerification('device-a', true);
      const verificationB = makeVerification('device-b', false);

      freshMember.setE2eeDeviceVerifications([verificationA, verificationB]);

      assert.deepEqual(freshMember.getE2eeDeviceVerification('device-a'), verificationA);
      assert.deepEqual(freshMember.getE2eeDeviceVerification('device-b'), verificationB);
      assert.isUndefined(freshMember.getE2eeDeviceVerification('device-missing'));
      assert.deepEqual(freshMember.getE2eeDeviceVerifications(), [verificationA, verificationB]);
    });

    it('replaces (does not merge) the previous verifications on each call', () => {
      const freshMember = new Member({controls: {}, status: {}});

      freshMember.setE2eeDeviceVerifications([makeVerification('device-a', true)]);
      freshMember.setE2eeDeviceVerifications([makeVerification('device-b', false)]);

      assert.isUndefined(freshMember.getE2eeDeviceVerification('device-a'));
      assert.deepEqual(freshMember.getE2eeDeviceVerifications(), [
        makeVerification('device-b', false),
      ]);
    });

    [
      {name: 'all devices verified', verifications: [true, true], expected: 'verified'},
      {name: 'no devices verified', verifications: [false, false], expected: 'unverified'},
      {name: 'some devices verified', verifications: [true, false], expected: 'partiallyVerified'},
      {name: 'no devices present', verifications: [], expected: 'unknown'},
    ].forEach(({name, verifications, expected}) => {
      it(`aggregate state is '${expected}' when ${name}`, () => {
        const freshMember = new Member({controls: {}, status: {}});

        freshMember.setE2eeDeviceVerifications(
          verifications.map((verified, index) => makeVerification(`device-${index}`, verified))
        );

        assert.equal(freshMember.e2eeVerificationState, expected);
      });
    });

    describe('per-device set/remove', () => {
      it('upserts a single device verification and returns true when it changes', () => {
        const freshMember = new Member({controls: {}, status: {}});
        const verification = makeVerification('device-a', true);

        assert.isTrue(freshMember.setE2eeDeviceVerification('device-a', verification));
        assert.deepEqual(freshMember.getE2eeDeviceVerification('device-a'), verification);
        assert.equal(freshMember.e2eeVerificationState, 'verified');
      });

      it('keeps other devices when upserting one', () => {
        const freshMember = new Member({controls: {}, status: {}});
        freshMember.setE2eeDeviceVerification('device-a', makeVerification('device-a', true));

        freshMember.setE2eeDeviceVerification('device-b', makeVerification('device-b', false));

        assert.isTrue(freshMember.getE2eeDeviceVerification('device-a').verified);
        assert.isFalse(freshMember.getE2eeDeviceVerification('device-b').verified);
        assert.equal(freshMember.e2eeVerificationState, 'partiallyVerified');
      });

      it('returns false and does nothing when the verification is unchanged', () => {
        const freshMember = new Member({controls: {}, status: {}});
        freshMember.setE2eeDeviceVerification('device-a', makeVerification('device-a', true));

        assert.isFalse(
          freshMember.setE2eeDeviceVerification('device-a', makeVerification('device-a', true))
        );
      });

      it('removes a single device verification and returns true', () => {
        const freshMember = new Member({controls: {}, status: {}});
        freshMember.setE2eeDeviceVerification('device-a', makeVerification('device-a', true));

        assert.isTrue(freshMember.removeE2eeDeviceVerification('device-a'));
        assert.isUndefined(freshMember.getE2eeDeviceVerification('device-a'));
        assert.equal(freshMember.e2eeVerificationState, 'unknown');
      });

      it('returns false when removing a device that has no verification', () => {
        const freshMember = new Member({controls: {}, status: {}});

        assert.isFalse(freshMember.removeE2eeDeviceVerification('device-missing'));
      });
    });
  });
});
