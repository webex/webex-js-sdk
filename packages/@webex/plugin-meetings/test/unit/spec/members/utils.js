import sinon from 'sinon';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import MembersUtil from '@webex/plugin-meetings/src/members/util';

import {CONTROLS, PARTICIPANT} from '@webex/plugin-meetings/src/constants';

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

    describe('#getAddedRoleShape', () => {
      it('returns the correct shape with hostkey', () => {
        const format = {type: 'PRESENTER', hasRole: true, hostKey: '123456'};
        assert.deepEqual(MembersUtil.getAddedRoleShape(format), {
          type: 'PRESENTER',
          hasRole: true,
          hostKey: '123456',
        });
      });

      it('returns the correct shape without hostkey', () => {
        const format = {type: 'PRESENTER', hasRole: true};
        assert.deepEqual(MembersUtil.getAddedRoleShape(format), {
          type: 'PRESENTER',
          hasRole: true,
        });
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
  });
});
