import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {jenkinsOnly} from '@webex/test-helper-mocha';
import {createWhistlerTestUser, removeWhistlerTestUser} from '@webex/test-users';

const {assert} = chai;

chai.use(chaiAsPromised);

assert.hasAccessToken = (user) => {
  assert.isDefined(user.token, 'user.token is defined');
};

assert.isTestUser = (user) => {
  assert.isDefined(user, 'user is defined');
  assert.isDefined(user.displayName, 'user.displayName is defined');
  assert.isDefined(user.emailAddress, 'user.emailAddress is defined');
  assert.isDefined(user.password, 'user.password is defined');
  assert.isDefined(user.reservationUrl, 'user.reservationUrl is defined');
};

jenkinsOnly(describe)('test-users-whistler', () => {
  describe('createWhistlerTestUser()', () => {
    it('creates a test user', () =>
      createWhistlerTestUser().then((u) => {
        assert.isTestUser(u);
        assert.hasAccessToken(u);
      }));
  });

  describe('removeWhistlerTestUser()', () => {
    it('removes the specified test user', () =>
      createWhistlerTestUser().then(async (u) => {
        const res = await removeWhistlerTestUser(u);

        assert.equal(res.statusCode, 204);
      }));
  });
});
