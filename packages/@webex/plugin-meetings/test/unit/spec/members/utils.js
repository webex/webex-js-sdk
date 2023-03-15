import sinon from 'sinon';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import MembersUtil from '@webex/plugin-meetings/src/members/util';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('plugin-meetings', () => {
  describe('members utils library', () => {
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
  });
});
