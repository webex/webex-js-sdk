import {assert} from '@webex/test-helper-chai';
import * as httpCore from '@webex/http-core';
import sinon from 'sinon';

import {createTestUser} from '../../../src';

describe('meeting provisioning options', () => {
  let request;
  const options = {
    clientId: 'test-client',
    clientSecret: 'test-secret',
    idbrokerUrl: 'https://idbroker.example.test',
    cigServiceUrl: 'https://cig.example.test',
  };
  const creationUrl = `${options.cigServiceUrl}/users/test_users_s`;

  beforeEach(() => {
    request = sinon
      .stub(httpCore, 'request')
      .callsFake(({uri}) =>
        Promise.resolve(
          uri === creationUrl
            ? {body: {user: {id: 'test-user'}, token: {}}}
            : {body: {token_type: 'Bearer', access_token: 'client-token'}}
        )
      );
  });

  afterEach(() => sinon.restore());

  it('forwards explicit license IDs with the site synchronization settings', async () => {
    const licenseIds = ['FTM_test-license', 'WXSFREE_test-license_test.webex.com'];
    await createTestUser({
      ...options,
      licenseIds,
      forceCreate: true,
      ensureExistsInWebexSites: true,
      syncInWebexSites: ['test.webex.com'],
      orgAdminAuthorization: 'Bearer admin-token',
    });

    assert.calledWithMatch(request, {
      uri: creationUrl,
      body: {
        licenseIds,
        forceCreate: true,
        ensureExistsInWebexSites: true,
        syncInWebexSites: ['test.webex.com'],
        orgAdminAuthorization: 'Bearer admin-token',
      },
    });
  });

  it('omits license IDs from the JSON payload when none are supplied', async () => {
    await createTestUser(options);

    const creation = request
      .getCalls()
      .map(({args}) => args[0])
      .find(({uri}) => uri === creationUrl);
    assert.notProperty(JSON.parse(JSON.stringify(creation.body)), 'licenseIds');
  });
});
