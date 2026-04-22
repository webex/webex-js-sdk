import {assert} from '@webex/test-helper-chai';
import {getAIEnablementApprover} from '../../../../src/aiEnableRequest/utils';
import {Meeting} from '../../../../src';

describe('AI Enable Request Utils', () => {
  describe('#getAIEnablementApprover', () => {
    const createMember = (id, roles, canApproveAIEnablement) => ({
      id,
      roles,
      canApproveAIEnablement,
    });

    const createMeeting = (members) =>
      ({
        members: {
          membersCollection: {
            members: members.reduce((acc, member) => {
              acc[member.id] = member;
              return acc;
            }, {}),
          },
        },
      } as Meeting);

    it('should return host id when host has moderator role and canApproveAIEnablement', () => {
      const host = createMember('host-123', {moderator: true, cohost: false}, true);
      const member1 = createMember('member-456', {moderator: false, cohost: false}, false);
      const meeting = createMeeting([host, member1]);

      const result = getAIEnablementApprover(meeting);

      assert.equal(result, 'host-123');
    });

    it('should return null when host exists but does not have canApproveAIEnablement', () => {
      const host = createMember('host-123', {moderator: true, cohost: false}, false);
      const member1 = createMember('member-456', {moderator: false, cohost: false}, false);
      const meeting = createMeeting([host, member1]);

      const result = getAIEnablementApprover(meeting);

      assert.isNull(result);
    });

    it('should return first cohost id (alphabetically) when host does not have capability but cohosts do', () => {
      const host = createMember('host-123', {moderator: true, cohost: false}, false);
      const cohost1 = createMember('cohost-zzz', {moderator: false, cohost: true}, true);
      const cohost2 = createMember('cohost-aaa', {moderator: false, cohost: true}, true);
      const cohost3 = createMember('cohost-mmm', {moderator: false, cohost: true}, true);
      const meeting = createMeeting([host, cohost1, cohost2, cohost3]);

      const result = getAIEnablementApprover(meeting);

      assert.equal(result, 'cohost-aaa');
    });

    it('should return null when no host exists and no cohosts have capability', () => {
      const member1 = createMember('member-123', {moderator: false, cohost: false}, false);
      const member2 = createMember('member-456', {moderator: false, cohost: false}, false);
      const meeting = createMeeting([member1, member2]);

      const result = getAIEnablementApprover(meeting);

      assert.isNull(result);
    });

    it('should return null when cohosts exist but none have canApproveAIEnablement', () => {
      const host = createMember('host-123', {moderator: true, cohost: false}, false);
      const cohost1 = createMember('cohost-111', {moderator: false, cohost: true}, false);
      const cohost2 = createMember('cohost-222', {moderator: false, cohost: true}, false);
      const meeting = createMeeting([host, cohost1, cohost2]);

      const result = getAIEnablementApprover(meeting);

      assert.isNull(result);
    });

    it('should prioritize host over cohosts even if cohosts have capability', () => {
      const host = createMember('host-zzz', {moderator: true, cohost: false}, true);
      const cohost1 = createMember('cohost-aaa', {moderator: false, cohost: true}, true);
      const meeting = createMeeting([cohost1, host]);

      const result = getAIEnablementApprover(meeting);

      assert.equal(result, 'host-zzz');
    });

    it('should handle a single cohost with capability when no host has capability', () => {
      const host = createMember('host-123', {moderator: true, cohost: false}, false);
      const cohost = createMember('cohost-999', {moderator: false, cohost: true}, true);
      const meeting = createMeeting([host, cohost]);

      const result = getAIEnablementApprover(meeting);

      assert.equal(result, 'cohost-999');
    });

    it('should handle empty members collection', () => {
      const meeting = createMeeting([]);

      const result = getAIEnablementApprover(meeting);

      assert.isNull(result);
    });

    it('should correctly sort cohosts by id string (not numeric)', () => {
      const host = createMember('host-123', {moderator: true, cohost: false}, false);
      const cohost1 = createMember('cohost-20', {moderator: false, cohost: true}, true);
      const cohost2 = createMember('cohost-100', {moderator: false, cohost: true}, true);
      const cohost3 = createMember('cohost-3', {moderator: false, cohost: true}, true);
      const meeting = createMeeting([host, cohost1, cohost2, cohost3]);

      const result = getAIEnablementApprover(meeting);

      // Alphabetically: "cohost-100" < "cohost-20" < "cohost-3"
      assert.equal(result, 'cohost-100');
    });

    it('should handle members with both moderator and cohost roles', () => {
      // If someone is both moderator and cohost with capability, they should be found as host
      const hostCohost = createMember('host-cohost-123', {moderator: true, cohost: true}, true);
      const member = createMember('member-456', {moderator: false, cohost: false}, false);
      const meeting = createMeeting([hostCohost, member]);

      const result = getAIEnablementApprover(meeting);

      assert.equal(result, 'host-cohost-123');
    });
  });
});
