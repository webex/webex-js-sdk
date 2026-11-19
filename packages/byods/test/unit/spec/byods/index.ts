import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {jwtVerify, createRemoteJWKSet} from 'jose';
import BYODS from '../../../../src/byods';
import TokenManager from '../../../../src/token-manager';
import DataSourceClient from '../../../../src/data-source-client';
import {SDKConfig} from '../../../../src/types';
import {httpUtils} from '../../../../src/http-utils';
import log from '../../../../src/Logger';
import {
  INTEGRATION_BASE_URL,
  INTEGRATION_JWKS_URL,
  PRODUCTION_BASE_URL,
  PRODUCTION_JWKS_URL,
} from '../../../../src/constants';

// Replace the ESM library at its module boundary. Use Sinon for its stubs.
jest.mock('jose', () => {
  const mockSinon = jest.requireActual('sinon');

  return {
    jwtVerify: mockSinon.stub(),
    createRemoteJWKSet: mockSinon.stub(),
    jwksCache: Symbol('jwksCache'),
  };
});

describe('BYODS', () => {
  let sandbox: sinon.SinonSandbox;
  let config: SDKConfig;
  const verify = jwtVerify as unknown as sinon.SinonStub;
  const createKeySet = createRemoteJWKSet as unknown as sinon.SinonStub;
  const keySet = sinon.stub();

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(log, 'setLogger');
    verify.reset();
    createKeySet.reset();
    createKeySet.returns(keySet);
    config = {clientId: 'test-client-id', clientSecret: 'test-client-secret', orgId: 'test-org-id'};
    delete process.env.BYODS_ENVIRONMENT;
  });

  afterEach(() => {
    sandbox.restore();
    delete process.env.BYODS_ENVIRONMENT;
  });

  it('exposes one data source client and one token manager', () => {
    const sdk = new BYODS(config);
    assert.instanceOf(sdk.dataSource, DataSourceClient);
    assert.instanceOf(sdk.tokenManager, TokenManager);
    assert.strictEqual(sdk.orgId, config.orgId);
  });

  [undefined, null, '', '   '].forEach((orgId) => {
    it(`rejects a missing organization: ${JSON.stringify(orgId)}`, () => {
      assert.throws(
        () => new BYODS({...config, orgId: orgId as string}),
        Error,
        'orgId is required'
      );
    });
  });

  [
    {environment: undefined, apiUrl: PRODUCTION_BASE_URL, jwksUrl: PRODUCTION_JWKS_URL},
    {environment: 'production', apiUrl: PRODUCTION_BASE_URL, jwksUrl: PRODUCTION_JWKS_URL},
    {environment: 'integration', apiUrl: INTEGRATION_BASE_URL, jwksUrl: INTEGRATION_JWKS_URL},
    {environment: 'invalid', apiUrl: PRODUCTION_BASE_URL, jwksUrl: PRODUCTION_JWKS_URL},
  ].forEach(({environment, apiUrl, jwksUrl}) => {
    it(`keeps PAT acquisition and DataSource CRUD in the configured organization (${environment})`, async () => {
      if (environment) process.env.BYODS_ENVIRONMENT = environment;
      const sdk = new BYODS(config);
      // Later changes to the caller's object cannot select a different organization.
      config.orgId = 'other-org-id';
      const post = sandbox.stub(httpUtils, 'post').resolves({
        data: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          refresh_token_expires_in: 7200,
          token_type: 'Bearer',
        },
        status: 200,
      });
      const request = sandbox.stub(httpUtils, 'request').resolves({data: {items: []}, status: 200});

      await sdk.tokenManager.getServiceAppTokenUsingPAT('test-pat');
      assert.calledOnceWithExactly(post, `${apiUrl}/access_token`, {
        headers: {Authorization: 'Bearer test-pat', 'Content-Type': 'application/json'},
        body: JSON.stringify({
          targetOrgId: 'test-org-id',
          clientId: config.clientId,
          clientSecret: config.clientSecret,
        }),
      });
      assert.deepEqual(await sdk.dataSource.list(), {data: [], status: 200});
      assert.calledOnceWithExactly(request, `${apiUrl}/dataSources`, {
        method: 'GET',
        headers: {'User-Agent': sinon.match.string, Authorization: 'Bearer test-access-token'},
      });
      assert.strictEqual(sdk.orgId, 'test-org-id');
      assert.strictEqual(createKeySet.firstCall.args[0].href, jwksUrl);
      assert.include(createKeySet.firstCall.args[1], {
        cacheMaxAge: 600000,
        cooldownDuration: 30000,
      });
    });
  });

  it('verifies a JWS using the remote Webex key set', async () => {
    const sdk = new BYODS(config);
    verify.resolves({payload: {}});
    assert.deepEqual(await sdk.verifyJWSToken('test-jws'), {isValid: true});
    assert.calledOnceWithExactly(verify, 'test-jws', keySet);
  });

  [new Error('Token expired'), new Error('Invalid signature'), {}].forEach((error) => {
    it(`returns an invalid result when verification fails: ${
      error instanceof Error ? error.message : 'unknown'
    }`, async () => {
      const sdk = new BYODS(config);
      verify.rejects(error);
      assert.deepEqual(await sdk.verifyJWSToken('invalid-jws'), {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  });
});
