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
          locusUrl
        });
      });
    });
    describe('#generateLowerAllHandsMemberOptions', () => {
      it('returns the correct options', () => {
        const requestingParticipantId = 'test';
        const locusUrl = 'urlTest1';

        assert.deepEqual(MembersUtil.generateLowerAllHandsMemberOptions(requestingParticipantId, locusUrl), {
          requestingParticipantId,
          locusUrl
        });
      });
    });
  });
});
