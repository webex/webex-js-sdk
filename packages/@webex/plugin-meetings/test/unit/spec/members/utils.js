import sinon from 'sinon';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import MembersUtil from '@webex/plugin-meetings/src/members/util';
import {HTTP_VERBS, CONTROLS, PARTICIPANT} from '@webex/plugin-meetings/src/constants';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('plugin-meetings', () => {
  describe('members utils library', () => {
    describe('#generateRoleAssignmentMemberOptions', () => {
      it('returns the correct options', () => {
        const memberId = 'test';
        const roles = [
          {type: 'PRESENTER', hasRole: true},
          {type: 'MODERATOR', hasRole: true},
          {type: 'COHOST', hasRole: true},
        ];
        const locusUrl = 'urlTest1';

        assert.deepEqual(
          MembersUtil.generateRoleAssignmentMemberOptions(memberId, roles, locusUrl),
          {
            memberId,
            roles,
            locusUrl,
          }
        );
      });
    });

    describe('#getRoleAssignmentMemberRequestParams', () => {
      it('returns the correct request params', () => {
        const format = {
          locusUrl: 'locusUrl',
          memberId: 'test',
          roles: [
            {type: 'PRESENTER', hasRole: true},
            {type: 'MODERATOR', hasRole: false},
            {type: 'COHOST', hasRole: true},
          ],
        };

        assert.deepEqual(MembersUtil.getRoleAssignmentMemberRequestParams(format), {
          method: 'PATCH',
          uri: `locusUrl/${PARTICIPANT}/test/${CONTROLS}`,
          body: {
            role: {
              roles: [
                {type: 'PRESENTER', hasRole: true},
                {type: 'MODERATOR', hasRole: false},
                {type: 'COHOST', hasRole: true},
              ],
            },
          },
        });
      });

      it('returns the correct request params with a hostKey', () => {
        const format = {
          locusUrl: 'locusUrl',
          memberId: 'test',
          roles: [
            {type: 'PRESENTER', hasRole: true, hostKey: '123456'},
            {type: 'MODERATOR', hasRole: false, hostKey: '123456'},
            {type: 'COHOST', hasRole: true, hostKey: '123456'},
          ],
        };

        assert.deepEqual(MembersUtil.getRoleAssignmentMemberRequestParams(format), {
          method: 'PATCH',
          uri: `locusUrl/${PARTICIPANT}/test/${CONTROLS}`,
          body: {
            role: {
              roles: [
                {type: 'PRESENTER', hasRole: true, hostKey: '123456'},
                {type: 'MODERATOR', hasRole: false, hostKey: '123456'},
                {type: 'COHOST', hasRole: true, hostKey: '123456'},
              ],
            },
          },
        });
      });
    });

    describe('#generateRaiseHandMemberOptions', () => {
      it('returns the correct options', () => {
        const memberId = 'test';
        const status = true;
        const locusUrl = 'urlTest1';

        assert.deepEqual(MembersUtil.generateRaiseHandMemberOptions(memberId, status, locusUrl), {
          memberId,
          raised: status,
          locusUrl,
        });
      });
    });
    describe('#generateLowerAllHandsMemberOptions', () => {
      it('returns the correct options without roles', () => {
        const requestingParticipantId = 'test';
        const locusUrl = 'urlTest1';

        assert.deepEqual(
          MembersUtil.generateLowerAllHandsMemberOptions(requestingParticipantId, locusUrl),
          {
            requestingParticipantId,
            locusUrl,
          }
        );
      });
      it('returns the correct options with roles', () => {
        const requestingParticipantId = 'test';
        const locusUrl = 'urlTest1';
        const roles = ['panelist'];

        assert.deepEqual(
          MembersUtil.generateLowerAllHandsMemberOptions(requestingParticipantId, locusUrl, roles),
          {
            requestingParticipantId,
            locusUrl,
            roles,
          }
        );
      });
    });
    describe('#generateEditDisplayNameMemberOptions', () => {
      it('returns the correct options', () => {
        const locusUrl = 'urlTest1';
        const memberId = 'test1';
        const requestingParticipantId = 'test2';
        const alias = 'alias';

        assert.deepEqual(
          MembersUtil.generateEditDisplayNameMemberOptions(
            memberId,
            requestingParticipantId,
            alias,
            locusUrl
          ),
          {
            memberId,
            requestingParticipantId,
            alias,
            locusUrl,
          }
        );
      });
    });
    describe('#getAdmitMemberRequestBody', () => {
      it('returns the correct request body', () => {
        const option1 = {memberIds: ['uuid']};

        assert.deepEqual(MembersUtil.getAdmitMemberRequestBody(option1), {
          admit: {participantIds: ['uuid']},
        });

        const option2 = {
          memberIds: ['uuid'],
          sessionLocusUrls: {authorizingLocusUrl: 'authorizingLocusUrl'},
        };

        assert.deepEqual(MembersUtil.getAdmitMemberRequestBody(option2), {
          admit: {participantIds: ['uuid']},
          authorizingLocusUrl: 'authorizingLocusUrl',
        });
      });
    });
    describe('#getAdmitMemberRequestParams', () => {
      it('returns the correct request params', () => {
        const format1 = {memberIds: ['uuid'], locusUrl: 'locusUrl'};

        assert.deepEqual(MembersUtil.getAdmitMemberRequestParams(format1), {
          method: 'PUT',
          uri: 'locusUrl/controls',
          body: {admit: {participantIds: ['uuid']}},
        });

        const format2 = {
          memberIds: ['uuid'],
          sessionLocusUrls: {
            authorizingLocusUrl: 'authorizingLocusUrl',
            mainLocusUrl: 'mainLocusUrl',
          },
          locusUrl: 'locusUrl',
        };

        assert.deepEqual(MembersUtil.getAdmitMemberRequestParams(format2), {
          method: 'PUT',
          uri: 'mainLocusUrl/controls',
          body: {
            admit: {participantIds: ['uuid']},
            authorizingLocusUrl: 'authorizingLocusUrl',
          },
        });
      });
    });

    describe('#generateMuteMemberOptions', () => {
      const testOptions = (isAudio) => {
        const memberId = 'bob';
        const muteStatus = true;
        const locusUrl = 'urlTest1';

        assert.deepEqual(
          MembersUtil.generateMuteMemberOptions(memberId, muteStatus, locusUrl, isAudio),
          {
            memberId,
            muted: muteStatus,
            locusUrl,
            isAudio,
          }
        );
      };

      it('returns the correct options for audio', () => {
        testOptions(true);
      });

      it('returns the correct options for video', () => {
        testOptions(false);
      });
    });

    describe('#getMuteMemberRequestParams', () => {
      const testParams = (isAudio) => {
        const memberId = 'bob';
        const muteStatus = true;
        const locusUrl = 'urlTest1';

        const options = {
          memberId,
          muted: muteStatus,
          locusUrl,
          isAudio,
        };

        const uri = `${options.locusUrl}/${PARTICIPANT}/${options.memberId}/${CONTROLS}`;
        const property = isAudio ? 'audio' : 'video';
        const body = {
          [property]: {
            muted: options.muted,
          },
        };

        assert.deepEqual(MembersUtil.getMuteMemberRequestParams(options), {
          method: HTTP_VERBS.PATCH,
          uri,
          body,
        });
      };

      it('returns the correct params for audio', () => {
        testParams(true);
      });

      it('returns the correct params for video', () => {
        testParams(false);
      });
    });

    describe('#getAddMemberBody', () => {
      it('returns the correct body with email address and roles', () => {
        const options = {
          invitee: {
            emailAddress: 'test@example.com',
            roles: ['role1', 'role2'],
          },
          alertIfActive: true,
        };

        assert.deepEqual(MembersUtil.getAddMemberBody(options), {
          invitees: [
            {
              address: 'test@example.com',
              roles: ['role1', 'role2'],
            },
          ],
          alertIfActive: true,
        });
      });

      it('returns the correct body with phone number and no roles', () => {
        const options = {
          invitee: {
            phoneNumber: '1234567890',
          },
          alertIfActive: false,
        };

        assert.deepEqual(MembersUtil.getAddMemberBody(options), {
          invitees: [
            {
              address: '1234567890',
            },
          ],
          alertIfActive: false,
        });
      });

      it('returns the correct body with fallback to email', () => {
        const options = {
          invitee: {
            email: 'fallback@example.com',
          },
          alertIfActive: true,
        };

        assert.deepEqual(MembersUtil.getAddMemberBody(options), {
          invitees: [
            {
              address: 'fallback@example.com',
            },
          ],
          alertIfActive: true,
        });
      });

      it('handles missing `alertIfActive` gracefully', () => {
        const options = {
          invitee: {
            emailAddress: 'test@example.com',
            roles: ['role1'],
          },
        };

        assert.deepEqual(MembersUtil.getAddMemberBody(options), {
          invitees: [
            {
              address: 'test@example.com',
              roles: ['role1'],
            },
          ],
          alertIfActive: undefined,
        });
      });

      it('ignores roles if not provided', () => {
        const options = {
          invitee: {
            emailAddress: 'test@example.com',
          },
          alertIfActive: false,
        };

        assert.deepEqual(MembersUtil.getAddMemberBody(options), {
          invitees: [
            {
              address: 'test@example.com',
            },
          ],
          alertIfActive: false,
        });
      });
    });
  });
});
