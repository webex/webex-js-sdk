import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

const testUser = require('@webex/test-helper-test-users');
const testUsers = require('@webex/test-users');
const createTestUsers = require('../../utils/create-test-users');

describe('meeting test-user provisioning', () => {
  const environmentKeys = [
    'WEBEX_SITE',
    'WEBEX_CONVERGED_ORG_ID',
    'WEBEX_CLIENT_ID',
    'WEBEX_CLIENT_SECRET',
    'WEBEX_SCOPE',
    'IDENTITY_BASE_URL',
    'ATLAS_SERVICE_URL',
    'WEBEX_TEST_USERS_LICENSE_IDS',
    'WEBEX_TEST_USERS_ORG_ADMIN_AUTHORIZATION',
    'WEBEX_TEST_USERS_ORG_ADMIN_USER',
    'WEBEX_TEST_USERS_ORG_ADMIN_PASSWORD',
  ];
  let environment;
  let sandbox;
  let user;
  let freshToken;
  let create;
  let login;
  let preferredSite;
  let discoverLicenses;

  beforeEach(() => {
    environment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
    environmentKeys.forEach((key) => Reflect.deleteProperty(process.env, key));
    Object.assign(process.env, {
      WEBEX_CONVERGED_ORG_ID: 'test-org',
      WEBEX_CLIENT_ID: 'test-client',
      WEBEX_CLIENT_SECRET: 'test-secret',
      WEBEX_SCOPE: 'spark:kms meeting:preferences_read',
      IDENTITY_BASE_URL: 'https://identity.example.test',
      ATLAS_SERVICE_URL: 'https://atlas.example.test/admin/api/v1',
    });
    user = {
      id: 'test-user',
      emailAddress: 'user@example.test',
      password: 'test-password',
      token: {authorization: 'Bearer initial-token'},
    };
    freshToken = {authorization: 'Bearer licensed-user-token'};
    sandbox = sinon.createSandbox();
    create = sandbox.stub(testUser, 'create').resolves([user]);
    login = sandbox.stub(testUsers, 'loginTestUser').resolves(freshToken);
    preferredSite = sandbox.stub(testUsers, 'setPreferredSite').resolves();
    discoverLicenses = sandbox.stub(testUsers, 'getMeetingTestUserProvisioning').resolves({
      webexSite: 'meetings.example.webex.com',
      licenseIds: ['FTM_discovered', 'FTC_discovered', 'FMS_discovered', 'WXSFREE_discovered'],
    });
  });

  afterEach(() => {
    sandbox.restore();
    environmentKeys.forEach((key) => {
      if (environment[key] === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = environment[key];
    });
  });

  const configureSite = () => {
    process.env.WEBEX_SITE = 'meetings.example.webex.com';
    process.env.WEBEX_TEST_USERS_ORG_ADMIN_AUTHORIZATION = 'Bearer admin-token';
    process.env.WEBEX_TEST_USERS_LICENSE_IDS = 'FTM_example, WXSFREE_example\nFMS_example';
  };

  it('preserves default CIG creation and does not mutate the caller configuration', async () => {
    const options = {count: 1, config: {orgId: 'custom-org'}};

    assert.deepEqual(await createTestUsers(options), [user]);
    assert.calledOnceWithExactly(create, options);
    assert.deepEqual(options, {count: 1, config: {orgId: 'custom-org'}});
    assert.notCalled(login);
    assert.notCalled(preferredSite);
    assert.notCalled(discoverLicenses);
  });

  it('preserves Whistler creation even when meeting provisioning is configured', async () => {
    configureSite();

    await createTestUsers({count: 1, whistler: true});

    assert.calledOnceWithExactly(create, {
      count: 1,
      whistler: true,
      config: {orgId: 'test-org'},
    });
    assert.notCalled(login);
    assert.notCalled(preferredSite);
    assert.notCalled(discoverLicenses);
  });

  it('assigns explicit licenses and refreshes the token after preferred-site setup', async () => {
    configureSite();

    const users = await createTestUsers({count: 1});

    assert.calledOnceWithExactly(create, {
      count: 1,
      config: {
        orgId: 'test-org',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        scope: 'spark:kms meeting:preferences_read',
        entitlements: [
          'spark',
          'squaredCallInitiation',
          'squaredRoomModeration',
          'squaredInviter',
          'webExSquared',
          'basicMessage',
          'basicMeeting',
        ],
        forceCreate: true,
        ensureExistsInWebexSites: true,
        syncInWebexSites: ['meetings.example.webex.com'],
        licenseIds: ['FTM_example', 'WXSFREE_example', 'FMS_example'],
        orgAdminAuthorization: 'Bearer admin-token',
      },
    });
    assert.calledOnceWithExactly(preferredSite, {
      authorization: 'Bearer initial-token',
      orgId: 'test-org',
      userId: 'test-user',
      preferredSite: 'meetings.example.webex.com',
      identityServiceUrl: 'https://identity.example.test',
    });
    assert.calledOnceWithExactly(login, {
      clientId: 'test-client',
      clientSecret: 'test-secret',
      email: 'user@example.test',
      password: 'test-password',
      orgId: 'test-org',
      scopes: 'spark:kms meeting:preferences_read',
    });
    assert.callOrder(create, preferredSite, login);
    assert.notCalled(discoverLicenses);
    assert.strictEqual(users[0], user);
    assert.strictEqual(users[0].token, freshToken);
  });

  it('obtains org-admin authorization before creating users when credentials are configured', async () => {
    configureSite();
    Reflect.deleteProperty(process.env, 'WEBEX_SITE');
    Reflect.deleteProperty(process.env, 'WEBEX_TEST_USERS_ORG_ADMIN_AUTHORIZATION');
    Reflect.deleteProperty(process.env, 'WEBEX_TEST_USERS_LICENSE_IDS');
    process.env.WEBEX_TEST_USERS_ORG_ADMIN_USER = 'admin@example.test';
    process.env.WEBEX_TEST_USERS_ORG_ADMIN_PASSWORD = 'admin-password';
    login.onFirstCall().resolves({authorization: 'Bearer acquired-admin-token'});

    await createTestUsers({count: 1});

    assert.calledWithExactly(login.firstCall, {
      clientId: 'test-client',
      clientSecret: 'test-secret',
      email: 'admin@example.test',
      password: 'admin-password',
      orgId: 'test-org',
      scopes: 'webexsquare:admin',
    });
    assert.equal(
      create.firstCall.args[0].config.orgAdminAuthorization,
      'Bearer acquired-admin-token'
    );
    assert.calledOnceWithExactly(discoverLicenses, {
      authorization: 'Bearer acquired-admin-token',
      orgId: 'test-org',
      webexSite: undefined,
      licenseIds: [],
      atlasServiceUrl: 'https://atlas.example.test/admin/api/v1',
    });
    assert.callOrder(login, discoverLicenses, create);
    assert.isTrue(login.firstCall.calledBefore(create.firstCall));
    assert.isTrue(preferredSite.firstCall.calledBefore(login.secondCall));
    assert.strictEqual(user.token, freshToken);
  });

  it('honors explicit configuration without adding scopes', async () => {
    configureSite();
    const options = {
      count: 1,
      config: {
        orgId: 'custom-org',
        clientId: 'custom-client',
        clientSecret: 'custom-secret',
        webexSite: 'custom.webex.com',
        scope: 'spark:kms',
        licenseIds: ['custom-license'],
        orgAdminAuthorization: 'Bearer custom-admin',
      },
    };

    await createTestUsers(options);

    const {config} = create.firstCall.args[0];

    assert.deepEqual(config.licenseIds, ['custom-license']);
    assert.deepEqual(config.syncInWebexSites, ['custom.webex.com']);
    assert.equal(config.orgAdminAuthorization, 'Bearer custom-admin');
    assert.equal(config.scope, 'spark:kms');
    assert.equal(login.firstCall.args[0].scopes, 'spark:kms');
    assert.equal(login.firstCall.args[0].clientId, 'custom-client');
    assert.equal(login.firstCall.args[0].orgId, 'custom-org');
    assert.notProperty(options.config, 'forceCreate');
  });

  it('discovers licenses once before creating a batch when no explicit IDs are configured', async () => {
    configureSite();
    Reflect.deleteProperty(process.env, 'WEBEX_TEST_USERS_LICENSE_IDS');
    create.resolves([user, {...user, id: 'second-user', emailAddress: 'second@example.test'}]);

    await createTestUsers({count: 2});

    assert.calledOnceWithExactly(discoverLicenses, {
      authorization: 'Bearer admin-token',
      orgId: 'test-org',
      webexSite: 'meetings.example.webex.com',
      licenseIds: [],
      atlasServiceUrl: 'https://atlas.example.test/admin/api/v1',
    });
    assert.deepEqual(create.firstCall.args[0].config.licenseIds, [
      'FTM_discovered',
      'FTC_discovered',
      'FMS_discovered',
      'WXSFREE_discovered',
    ]);
    assert.callOrder(discoverLicenses, create);
  });

  it('discovers the site and licenses with only org-admin authorization configured', async () => {
    process.env.WEBEX_TEST_USERS_ORG_ADMIN_AUTHORIZATION = 'Bearer admin-token';

    await createTestUsers({count: 1});

    assert.calledOnceWithExactly(discoverLicenses, {
      authorization: 'Bearer admin-token',
      orgId: 'test-org',
      webexSite: undefined,
      licenseIds: [],
      atlasServiceUrl: 'https://atlas.example.test/admin/api/v1',
    });
    assert.deepEqual(create.firstCall.args[0].config.syncInWebexSites, [
      'meetings.example.webex.com',
    ]);
    assert.equal(preferredSite.firstCall.args[0].preferredSite, 'meetings.example.webex.com');
    assert.callOrder(discoverLicenses, create, preferredSite, login);
  });

  it('passes explicit license IDs into site discovery when no site override is set', async () => {
    configureSite();
    Reflect.deleteProperty(process.env, 'WEBEX_SITE');
    const licenseIds = ['FTM_override', 'WXSFREE_override'];
    discoverLicenses.resolves({webexSite: 'override.webex.com', licenseIds});

    await createTestUsers({count: 1, config: {licenseIds}});

    assert.deepEqual(discoverLicenses.firstCall.args[0].licenseIds, licenseIds);
    assert.strictEqual(create.firstCall.args[0].config.licenseIds, licenseIds);
    assert.deepEqual(create.firstCall.args[0].config.syncInWebexSites, ['override.webex.com']);
    assert.equal(preferredSite.firstCall.args[0].preferredSite, 'override.webex.com');
  });

  ['IDENTITY_BASE_URL', 'WEBEX_TEST_USERS_ORG_ADMIN_AUTHORIZATION'].forEach((missing) => {
    it(`rejects missing ${missing} before creating users`, async () => {
      configureSite();
      Reflect.deleteProperty(process.env, missing);

      await createTestUsers({count: 1}).then(
        () => assert.fail('Expected configuration failure'),
        (error) => assert.match(error.message, /Meeting-site provisioning requires/)
      );
      assert.notCalled(create);
      assert.notCalled(login);
    });
  });

  ['admin login', 'license discovery', 'creation', 'preferred site', 'fresh login'].forEach(
    (stage) => {
      it(`propagates ${stage} errors`, async () => {
        configureSite();
        const error = new Error(`${stage} failed`);

        if (stage === 'admin login') {
          Reflect.deleteProperty(process.env, 'WEBEX_TEST_USERS_ORG_ADMIN_AUTHORIZATION');
          process.env.WEBEX_TEST_USERS_ORG_ADMIN_USER = 'admin@example.test';
          process.env.WEBEX_TEST_USERS_ORG_ADMIN_PASSWORD = 'admin-password';
          login.rejects(error);
        } else if (stage === 'license discovery') {
          Reflect.deleteProperty(process.env, 'WEBEX_TEST_USERS_LICENSE_IDS');
          discoverLicenses.rejects(error);
        } else if (stage === 'creation') create.rejects(error);
        else if (stage === 'preferred site') preferredSite.rejects(error);
        else login.rejects(error);

        await createTestUsers({count: 1}).then(
          () => assert.fail('Expected provisioning failure'),
          (failure) => assert.strictEqual(failure, error)
        );
        if (stage === 'license discovery') assert.notCalled(create);
      });
    }
  );

  it('rejects incomplete user creation results', async () => {
    create.resolves([]);

    await createTestUsers({count: 1}).then(
      () => assert.fail('Expected incomplete creation failure'),
      (error) => assert.equal(error.message, 'Test users not created')
    );
  });
});
