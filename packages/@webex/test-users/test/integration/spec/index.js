import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import uuid from 'uuid';
import {createTestUser, removeTestUser, loginTestUser} from '@webex/test-users';
import {request} from '@webex/http-core';
import {nodeOnly} from '@webex/test-helper-mocha';

const {assert} = chai;

chai.use(chaiAsPromised);

assert.hasAccessToken = (user) => {
  assert.isDefined(user.token.access_token, 'user.token.access_token is defined');
  assert.isDefined(user.token.expires_in, 'user.token.expires_in is defined');
  assert.isDefined(user.token.token_type, 'user.token.token_type is defined');
  assert.isDefined(user.token.refresh_token, 'user.token.refresh_token is defined');
  assert.isDefined(
    user.token.refresh_token_expires_in,
    'user.token.refresh_token_expires_in is defined'
  );
  assert.isDefined(user.token.expires, 'user.token.expires is defined');
  assert.isDefined(user.token.refresh_token_expires, 'user.token.refresh_token_expires is defined');
};

assert.hasAuthorizationCode = (user) => {
  assert.isDefined(user.token, 'user.token is defined');
  assert.isDefined(user.token.auth_code, 'user.token.auth_code is defined');
};

assert.hasRefreshToken = (user) => {
  assert.isDefined(user.token, 'user.token is defined');
  assert.isDefined(user.token.refresh_token, 'user.token.refresh_token is defined');
  assert.isDefined(
    user.token.refresh_token_expires_in,
    'user.token.refresh_token_expires_in is defined'
  );
  assert.isDefined(user.token.refresh_token_expires, 'user.token.refresh_token_expires is defined');
};

assert.isTestUser = (user) => {
  assert.isDefined(user, 'user is defined');
  assert.isDefined(user.displayName, 'user.displayName is defined');
  assert.isDefined(user.email, 'user.email is defined');
  assert.isDefined(user.emailAddress, 'user.emailAddress is defined');
  assert.isDefined(user.id, 'user.id is defined');
  assert.isDefined(user.password, 'user.password is defined');
};

nodeOnly(describe)('test-users', () => {
  const emailAddress = `test-${uuid.v4()}@wx2.example.com`;
  const password = `${uuid.v4()}1@A`;
  const displayName = uuid.v4();

  function prune(user) {
    return {
      id: user.id,
      email: user.emailAddress || user.email,
      password: user.password,
    };
  }

  function refresh(user) {
    assert.hasRefreshToken(user);

    return request({
      method: 'POST',
      uri: `${
        process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com'
      }/idb/oauth2/v1/access_token`,
      form: {
        /* eslint-disable camelcase */
        grant_type: 'refresh_token',
        redirect_uri: process.env.WEBEX_REDIRECT_URI,
        refresh_token: user.token.refresh_token,
        /* eslint-enable */
      },
      auth: {
        user: process.env.WEBEX_CLIENT_ID,
        pass: process.env.WEBEX_CLIENT_SECRET,
      },
    });
  }

  describe('createTestUser()', () => {
    it('creates a test user', () =>
      createTestUser().then((u) => {
        assert.isTestUser(u);
        assert.hasAccessToken(u);
      }));

    it('creates a test user with a custom email address', () =>
      createTestUser({emailAddress}).then((u) => {
        assert.isTestUser(u);
        assert.hasAccessToken(u);
        assert.equal(u.email, emailAddress);
      }));

    it('creates a test user with a custom password', () =>
      createTestUser({password}).then((u) => {
        assert.isTestUser(u);
        assert.hasAccessToken(u);
        assert.equal(u.password, password);
      }));

    it('creates a test user with a custom display name', () =>
      createTestUser({displayName}).then((u) => {
        assert.isTestUser(u);
        assert.hasAccessToken(u);
        assert.equal(u.displayName, displayName);
      }));

    it('creates a test user with a usable refresh token', () =>
      createTestUser({}).then(async (u) => {
        assert.isTestUser(u);
        assert.hasAccessToken(u);

        const res = await refresh(u);

        assert.equal(res.statusCode, 200);
      }));

    it('creates a test user but returns an authorization code', () =>
      createTestUser({authCodeOnly: true}).then((u) => {
        assert.isTestUser(u);
        assert.hasAuthorizationCode(u);
      }));

    it('creates a test user in another org', async () => {
      const u = await createTestUser({
        orgId: 'kmsFederation',
        entitlements: ['webExSquared'],
      });

      assert.isTestUser(u);
      assert.hasAccessToken(u);
    });

    it('creates a machine type test user', () =>
      createTestUser({
        machineType: 'LYRA_SPACE',
        type: 'MACHINE',
      }).then((u) => {
        assert.isTestUser(u);
        assert.equal(u.type, 'MACHINE', 'type is MACHINE');
        assert.equal(u.machineType, 'LYRA_SPACE', 'machineType is LYRA_SPACE');
      }));
  });

  describe('loginTestUser()', () => {
    it('retrieves credentials for the specified user', () =>
      createTestUser()
        .then(prune)
        .then(loginTestUser)
        .then((token) => {
          assert.hasAccessToken({token});
        }));

    it('retrieves credentials with a useable refresh token', () =>
      createTestUser()
        .then(prune)
        .then(loginTestUser)
        .then(async (token) => {
          assert.hasAccessToken({token});
          assert.hasRefreshToken({token});

          const res = await refresh({token});

          assert.equal(res.statusCode, 200);
        }));
  });

  describe('removeTestUser()', () => {
    it('removes the specified test user', () =>
      createTestUser().then(async (u) => {
        const res = await removeTestUser(u);

        assert.equal(res.statusCode, 204);
      }));

    it('removes a test user if no access token is available', () =>
      createTestUser()
        .then(prune)
        .then(async (u) => {
          const res = await removeTestUser(u);

          assert.equal(res.statusCode, 204);
        }));

    it('removes a test user with an access token set to undefined', () =>
      createTestUser()
        .then((user) => {
          user.token = undefined;

          return user;
        })
        .then(async (u) => {
          const res = await removeTestUser(u);

          assert.equal(res.statusCode, 204);
        }));
  });
});
