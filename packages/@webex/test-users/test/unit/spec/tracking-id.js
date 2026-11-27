import {assert} from '@webex/test-helper-chai';
import * as httpCore from '@webex/http-core';
import sinon from 'sinon';

import {createTestUser} from '../../../src';

describe('user creation tracking IDs', () => {
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

  it('sends distinct IDs with a shared session prefix and preserves authorization', async () => {
    await createTestUser(options);
    await createTestUser(options);

    const creations = request
      .getCalls()
      .map(({args}) => args[0])
      .filter(({uri}) => uri === creationUrl);
    const [first, second] = creations.map(({headers}) => headers.trackingid);

    assert.lengthOf(creations, 2);
    assert.match(first, /^webex-js-sdk_test-users_[a-f\d-]{36}_\d+$/);
    assert.notEqual(second, first);
    assert.equal(second.slice(0, second.lastIndexOf('_')), first.slice(0, first.lastIndexOf('_')));
    assert.equal(Number(second.split('_').pop()), Number(first.split('_').pop()) + 1);
    creations.forEach(({headers}) => assert.equal(headers.authorization, 'Bearer client-token'));
  });

  it('includes the sent ID in errors and generates a new ID on retry', async () => {
    const errors = [new Error('Onboarding failed'), new Error('Onboarding failed again')];
    errors.forEach((error) => {
      error.statusCode = 502;
    });
    let attempt = 0;
    request.callsFake(({uri}) => {
      if (uri === creationUrl) {
        const error = errors[attempt];
        attempt += 1;

        return Promise.reject(error);
      }

      return Promise.resolve({body: {token_type: 'Bearer', access_token: 'client-token'}});
    });

    assert.strictEqual(await assert.isRejected(createTestUser(options)), errors[0]);
    assert.strictEqual(await assert.isRejected(createTestUser(options)), errors[1]);

    const ids = request
      .getCalls()
      .map(({args}) => args[0])
      .filter(({uri}) => uri === creationUrl)
      .map(({headers}) => headers.trackingid);

    assert.notEqual(ids[0], ids[1]);
    errors.forEach((error, index) => {
      assert.include(error.message, `WEBEX_TRACKING_ID: ${ids[index]}`);
      assert.equal(error.statusCode, 502);
      assert.notInclude(error.message, options.clientSecret);
      assert.notInclude(error.message, 'client-token');
    });
  });
});
