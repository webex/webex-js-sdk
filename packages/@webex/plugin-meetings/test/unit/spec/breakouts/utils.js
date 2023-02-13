import {assert} from '@webex/test-helper-chai';
import {getBroadcastRoles} from '@webex/plugin-meetings/src/breakouts/utils'
describe('plugin-meetings', () => {
  describe('Breakouts utils', () => {
    describe('#getBroadcastRoles', () => {
      it('return expect roles', () => {
        let roles = getBroadcastRoles();
        assert.deepEqual(roles, []);

        roles = getBroadcastRoles({cohosts: true});
        assert.deepEqual(roles, ['COHOST']);

        roles = getBroadcastRoles({presenters: true});
        assert.deepEqual(roles, ['PRESENTER']);

        roles = getBroadcastRoles({presenters: true, cohosts: true});
        assert.deepEqual(roles, ['COHOST', 'PRESENTER']);
      });
    });
  });
});
