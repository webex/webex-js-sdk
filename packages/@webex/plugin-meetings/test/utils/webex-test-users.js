/* eslint-disable no-console */

const WebexCore = require('@webex/webex-core').default;
const testUser = require('@webex/test-helper-test-users');
const {setPreferredSite} = require('@webex/test-users');
const sinon = require('sinon');

const config = require('./webex-config');

// Include the plugins which you feel will be used by the webex instance
require('@webex/internal-plugin-mercury');
require('@webex/internal-plugin-llm');
require('@webex/internal-plugin-user');
require('@webex/internal-plugin-device');
require('@webex/internal-plugin-conversation');
require('@webex/internal-plugin-support');
require('@webex/plugin-people');
require('@webex/plugin-rooms');
require('@webex/plugin-meetings');

const generateTestUsers = async (options = {}) => {
  options.config = options.config || {};
  options.config.orgId = options.config.orgId || process.env.WEBEX_CONVERGED_ORG_ID;
  const webexSite = options.config.webexSite || process.env.WEBEX_SITE;
  const provisionMeetingSite = !!webexSite && !options.whistler;

  if (provisionMeetingSite) {
    const orgAdminAuthorization =
      options.config.orgAdminAuthorization || process.env.WEBEX_TEST_USERS_ORG_ADMIN_AUTHORIZATION;

    if (!orgAdminAuthorization || !process.env.IDENTITY_BASE_URL) {
      throw new Error(
        'Meeting site provisioning requires org admin authorization and IDENTITY_BASE_URL'
      );
    }

    Object.assign(options.config, {
      clientId:
        options.config.clientId ||
        process.env.WEBEX_TEST_USERS_CLIENT_ID ||
        process.env.WEBEX_CLIENT_ID,
      clientSecret:
        options.config.clientSecret ||
        process.env.WEBEX_TEST_USERS_CLIENT_SECRET ||
        process.env.WEBEX_CLIENT_SECRET,
      entitlements: [
        'spark',
        'squaredCallInitiation',
        'squaredRoomModeration',
        'squaredInviter',
        'basicMessage',
        'basicMeeting',
        'webExSquared',
      ],
      forceCreate: true,
      ensureExistsInWebexSites: true,
      syncInWebexSites: [webexSite],
      orgAdminAuthorization,
    });
  }

  return testUser
    .create(options)
    .then(async (userSet) => {
      if (userSet.length !== options.count) {
        return Promise.reject(new Error('Test users not created'));
      }

      if (provisionMeetingSite) {
        await Promise.all(
          userSet.map((user) =>
            setPreferredSite({
              authorization: user.token.authorization,
              orgId: options.config.orgId,
              userId: user.id,
              preferredSite: webexSite,
              identityServiceUrl: process.env.IDENTITY_BASE_URL,
            })
          )
        );
        console.info('Meeting site synchronization and preferred-site provisioning completed');
      }

      // Pause for 5 seconds for CI
      await new Promise((done) => setTimeout(done, 5000));

      const webexRegisterPromises = [];
      const userWebexMeetings = [];

      userSet.forEach((user) => {
        // eslint-disable-next-line no-param-reassign
        user.webex = new WebexCore({
          config: config.webex,
          credentials: {
            authorization: user.token,
          },
          meetings: {
            autoUploadLogs: false,
          },
        });

        webexRegisterPromises.push(new Promise((resolve) => {
          user.webex.on('ready', resolve);
        }));

        user.webex.internal.support.submitLogs = sinon.stub().returns(Promise.resolve());

        userWebexMeetings.push(user.webex.meetings);
      });

      // wait for webex to be ready before registering meetings
      return Promise.all(webexRegisterPromises).then(() => {
        return Promise.all(userWebexMeetings.map(m => m.register())).then(() => userSet);
      })
    })
    .catch((error) => {
      console.error('#generateTestUsers=>ERROR', error);
    });
};

const reserveCMR = (user) =>
  user.webex
    .request({
      method: 'POST',
      uri: 'https://whistler-prod.allnint.ciscospark.com/api/v1/reservations',
      headers: {
        authorization: `Bearer ${user.webex.credentials.supertoken.access_token}`,
        'cisco-no-http-redirect': null,
        'spark-user-agent': null,
        trackingid: `ITCLIENT_ ${user.id} _0_imi:true`,
      },
      body: {
        resourceType: 'CMR_3',
        reservedBy: 'SDK_TEST_USER',
        requestMetaData: {
          emailAddress: user.emailAddress,
          loginType: 'loginGuest',
        },
      },
    })
    .then((res) => {
      console.log('SUCCESS ', res);
    });

module.exports = {
  generateTestUsers,
  reserveCMR,
};
