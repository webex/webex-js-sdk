const testUser = require('@webex/test-helper-test-users');
const testUsers = require('@webex/test-users');

/**
 * Create users and finish optional meeting-site provisioning before SDK registration.
 * @param {Object} options test-user count, Whistler selection, and CIG configuration
 * @returns {Promise<Array>} created test users with post-provisioning tokens
 */
const createTestUsers = async (options = {}) => {
  const config = {
    ...options.config,
    orgId: options.config?.orgId || process.env.WEBEX_CONVERGED_ORG_ID,
  };
  const webexSite = config.webexSite || process.env.WEBEX_SITE;
  const provisionMeetingSite = Boolean(webexSite && !options.whistler);

  if (provisionMeetingSite) {
    if (!process.env.IDENTITY_BASE_URL) {
      throw new Error('Meeting-site provisioning requires IDENTITY_BASE_URL');
    }

    const clientId = config.clientId || process.env.WEBEX_CLIENT_ID;
    const clientSecret = config.clientSecret || process.env.WEBEX_CLIENT_SECRET;
    const licenseIds =
      config.licenseIds ||
      (process.env.WEBEX_TEST_USERS_LICENSE_IDS || '').split(/[,\s]+/).filter(Boolean);
    let orgAdminAuthorization =
      config.orgAdminAuthorization || process.env.WEBEX_TEST_USERS_ORG_ADMIN_AUTHORIZATION;

    if (!orgAdminAuthorization) {
      const email = process.env.WEBEX_TEST_USERS_ORG_ADMIN_USER;
      const password = process.env.WEBEX_TEST_USERS_ORG_ADMIN_PASSWORD;

      if (!email || !password) {
        throw new Error(
          'Meeting-site provisioning requires org-admin authorization or credentials'
        );
      }

      const token = await testUsers.loginTestUser({
        clientId,
        clientSecret,
        email,
        password,
        orgId: config.orgId,
        scopes: 'webexsquare:admin',
      });

      orgAdminAuthorization = token.authorization;
    }

    const scopes = new Set(
      (config.scope || process.env.WEBEX_SCOPE || '').split(/\s+/).filter(Boolean)
    );

    scopes.add('meeting:preferences_read');
    Object.assign(config, {
      clientId,
      clientSecret,
      scope: [...scopes].join(' '),
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
      syncInWebexSites: [webexSite],
      licenseIds: licenseIds.length ? licenseIds : undefined,
      orgAdminAuthorization,
    });
  }

  const users = await testUser.create({...options, config});

  if (!Array.isArray(users) || users.length !== (options.count || 1)) {
    throw new Error('Test users not created');
  }

  if (provisionMeetingSite) {
    await Promise.all(
      users.map(async (user) => {
        await testUsers.setPreferredSite({
          authorization: user.token.authorization,
          orgId: config.orgId,
          userId: user.id,
          preferredSite: webexSite,
          identityServiceUrl: process.env.IDENTITY_BASE_URL,
        });

        // CIG issues its initial token before assigning the meeting-site license.
        // eslint-disable-next-line no-param-reassign
        user.token = await testUsers.loginTestUser({
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          email: user.emailAddress || user.email,
          password: user.password,
          orgId: config.orgId,
          scopes: config.scope,
        });
      })
    );
  }

  return users;
};

module.exports = createTestUsers;
