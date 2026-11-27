import {request} from '@webex/http-core';

import {createTestUser} from '../../../src';

jest.mock('@webex/http-core', () => ({request: jest.fn()}));

describe('user creation tracking IDs', () => {
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

  it('sends distinct IDs with a shared session prefix and preserves authorization', async () => {
    await createTestUser(options);
    await createTestUser(options);

    const creations = request.mock.calls
      .map(([call]) => call)
      .filter(({uri}) => uri === creationUrl);
    const [first, second] = creations.map(({headers}) => headers.trackingid);

    expect(creations).toHaveLength(2);
    expect(first).toMatch(/^webex-js-sdk_test-users_[a-f\d-]{36}_\d+$/);
    expect(second).not.toBe(first);
    expect(second.slice(0, second.lastIndexOf('_'))).toBe(first.slice(0, first.lastIndexOf('_')));
    expect(Number(second.split('_').pop())).toBe(Number(first.split('_').pop()) + 1);
    creations.forEach(({headers}) => expect(headers.authorization).toBe('Bearer client-token'));
  });

  it('includes the sent ID in errors and generates a new ID on retry', async () => {
    const errors = [new Error('Onboarding failed'), new Error('Onboarding failed again')];
    errors.forEach((error) => {
      error.statusCode = 502;
    });
    let attempt = 0;
    request.mockImplementation(({uri}) => {
      if (uri === creationUrl) {
        const error = errors[attempt];
        attempt += 1;

        return Promise.reject(error);
      }

      return Promise.resolve({body: {token_type: 'Bearer', access_token: 'client-token'}});
    });

    await expect(createTestUser(options)).rejects.toBe(errors[0]);
    await expect(createTestUser(options)).rejects.toBe(errors[1]);

    const ids = request.mock.calls
      .map(([call]) => call)
      .filter(({uri}) => uri === creationUrl)
      .map(({headers}) => headers.trackingid);

    expect(ids[0]).not.toBe(ids[1]);
    errors.forEach((error, index) => {
      expect(error.message).toContain(`WEBEX_TRACKING_ID: ${ids[index]}`);
      expect(error.statusCode).toBe(502);
      expect(error.message).not.toContain(options.clientSecret);
      expect(error.message).not.toContain('client-token');
    });
  });
});
