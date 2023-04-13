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
        const roles = [{type: 'PRESENTER', hasRole: true}, {type: 'MODERATOR', hasRole: true}, {type: 'COHOST', hasRole: true}]
        const locusUrl = 'urlTest1';

        assert.deepEqual(MembersUtil.generateRoleAssignmentMemberOptions(memberId, roles, locusUrl), {
          memberId,
          roles,
          locusUrl,
        });
      });
    });

    describe('#getRoleAssignmentMemberRequestParams', () => {
      it('returns the correct request params', () => {
        const format = {locusUrl: 'locusUrl', memberId: 'test', roles: [{type: 'PRESENTER', hasRole: true}, {type: 'MODERATOR', hasRole: false}, {type: 'COHOST', hasRole: true}]};

        assert.deepEqual(MembersUtil.getRoleAssignmentMemberRequestParams(format), {
          method: 'PATCH',
          uri: `locusUrl/${PARTICIPANT}/test/${CONTROLS}`,
          body: {role: {
            roles: [{type: 'PRESENTER', hasRole: true}, {type: 'MODERATOR', hasRole: false}, {type: 'COHOST', hasRole: true}]
          }},
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
      it('returns the correct options', () => {
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
  });
});
