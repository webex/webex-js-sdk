import {request} from '@webex/http-core';

import {createTestUser} from '../../../src';

jest.mock('@webex/http-core', () => ({request: jest.fn()}));

describe('meeting provisioning options', () => {
  const options = {
    clientId: 'test-client',
    clientSecret: 'test-secret',
    idbrokerUrl: 'https://idbroker.example.test',
    cigServiceUrl: 'https://cig.example.test',
  };
  const creationUrl = `${options.cigServiceUrl}/users/test_users_s`;

  beforeEach(() => {
    request.mockReset();
    request.mockImplementation(({uri}) =>
      Promise.resolve(
        uri === creationUrl
          ? {body: {user: {id: 'test-user'}, token: {}}}
          : {body: {token_type: 'Bearer', access_token: 'client-token'}}
      )
    );
  });

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

    const creation = request.mock.calls.map(([call]) => call).find(({uri}) => uri === creationUrl);
    expect(creation.body).toEqual(
      expect.objectContaining({
        licenseIds,
        forceCreate: true,
        ensureExistsInWebexSites: true,
        syncInWebexSites: ['test.webex.com'],
        orgAdminAuthorization: 'Bearer admin-token',
      })
    );
  });

  it('omits license IDs from the JSON payload when none are supplied', async () => {
    await createTestUser(options);

    const creation = request.mock.calls.map(([call]) => call).find(({uri}) => uri === creationUrl);
    expect(JSON.parse(JSON.stringify(creation.body))).not.toHaveProperty('licenseIds');
  });
});
