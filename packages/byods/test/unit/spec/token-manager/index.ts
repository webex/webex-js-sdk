import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import TokenManager from '../../../../src/token-manager';
import {ServiceAppToken, TokenResponse} from '../../../../src/types';
import {TokenStorageAdapter} from '../../../../src/token-storage-adapter/types';
import {httpUtils} from '../../../../src/http-utils';
import log from '../../../../src/Logger';
import {LOGGER} from '../../../../src/Logger/types';
import {APPLICATION_ID_PREFIX, BYODS_TOKEN_MANAGER_MODULE} from '../../../../src/constants';

describe('TokenManager', () => {
  const clientId = 'test-client-id';
  const clientSecret = 'test-client-secret';
  const orgId = 'test-org-id';
  const baseUrl = 'https://webexapis.com/v1';
  const tokenResponse: TokenResponse = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    refresh_token_expires_in: 7200,
    token_type: 'Bearer',
  };
  let tokenManager: TokenManager;
  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;
  let post: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clock = sandbox.useFakeTimers({now: Date.parse('2026-10-20T09:00:00Z')});
    sandbox.stub(log, 'setLogger');
    post = sandbox.stub(httpUtils, 'post').resolves({data: tokenResponse, status: 200});
    tokenManager = new TokenManager({clientId, clientSecret, orgId}, baseUrl);
  });

  afterEach(() => sandbox.restore());

  it('initializes the default logger', () => {
    assert.calledOnceWithExactly(log.setLogger, LOGGER.ERROR, BYODS_TOKEN_MANAGER_MODULE);
  });

  [undefined, null, '', '   '].forEach((invalidOrgId) => {
    it(`requires an organization at construction: ${JSON.stringify(invalidOrgId)}`, () => {
      assert.throws(
        () => new TokenManager({clientId, clientSecret, orgId: invalidOrgId as string}),
        Error,
        'orgId is required'
      );
    });
  });

  it('requires Service App credentials', () => {
    assert.throws(
      () => new TokenManager({clientId: '', clientSecret, orgId}),
      Error,
      'clientId and clientSecret are required'
    );
    assert.throws(
      () => new TokenManager({clientId, clientSecret: '', orgId}),
      Error,
      'clientId and clientSecret are required'
    );
  });

  it('returns the encoded Service App ID', () => {
    assert.strictEqual(
      tokenManager.getServiceAppId(),
      Buffer.from(`${APPLICATION_ID_PREFIX}${clientId}`).toString('base64')
    );
  });

  it('stores the token pair and both expiry times', async () => {
    await tokenManager.updateServiceAppToken(tokenResponse);
    assert.deepEqual(await tokenManager.getServiceAppToken(), {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: new Date(Date.now() + 3600000),
      refreshAccessTokenExpiresAt: new Date(Date.now() + 7200000),
    });
    assert.notCalled(post);
  });

  it('uses the configured organization for PAT acquisition', async () => {
    await tokenManager.getServiceAppTokenUsingPAT('test-pat', {'X-Custom': 'value'});
    assert.calledOnceWithExactly(post, `${baseUrl}/access_token`, {
      headers: {
        Authorization: 'Bearer test-pat',
        'Content-Type': 'application/json',
        'X-Custom': 'value',
      },
      body: JSON.stringify({targetOrgId: orgId, clientId, clientSecret}),
    });
    assert.strictEqual(
      (await tokenManager.getServiceAppToken()).accessToken,
      tokenResponse.access_token
    );
  });

  it('uses the default API endpoint and trims the configured organization', async () => {
    tokenManager = new TokenManager({clientId, clientSecret, orgId: ` ${orgId} `});
    await tokenManager.getServiceAppTokenUsingPAT('test-pat');
    assert.strictEqual(post.firstCall.args[0], `${baseUrl}/access_token`);
    assert.strictEqual(JSON.parse(post.firstCall.args[1].body).targetOrgId, orgId);
  });

  it('refreshes at expiry and stores the rotated pair in the same slot', async () => {
    await tokenManager.updateServiceAppToken(tokenResponse);
    clock.tick(tokenResponse.expires_in * 1000);
    const rotatedResponse = {
      ...tokenResponse,
      access_token: 'rotated-access-token',
      refresh_token: 'rotated-refresh-token',
    };
    post.resolves({data: rotatedResponse, status: 200});

    const refreshed = await tokenManager.getServiceAppToken();
    assert.calledOnceWithExactly(post, `${baseUrl}/access_token`, {
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenResponse.refresh_token,
      }).toString(),
    });
    assert.strictEqual(refreshed.accessToken, rotatedResponse.access_token);
    assert.strictEqual(refreshed.refreshToken, rotatedResponse.refresh_token);
    assert.deepEqual(await tokenManager.getServiceAppToken(), refreshed);
    assert.calledOnce(post);
  });

  it('refreshes the stored pair explicitly with custom headers', async () => {
    await tokenManager.updateServiceAppToken(tokenResponse);
    await tokenManager.refreshServiceAppAccessToken({'X-Custom': 'value'});
    assert.calledOnceWithExactly(post, `${baseUrl}/access_token`, {
      headers: {'Content-Type': 'application/x-www-form-urlencoded', 'X-Custom': 'value'},
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenResponse.refresh_token,
      }).toString(),
    });
  });

  it('accepts a supplied refresh token without PAT acquisition', async () => {
    await tokenManager.saveServiceAppRegistrationData('provided-refresh-token');
    assert.calledOnceWithExactly(post, `${baseUrl}/access_token`, {
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: 'provided-refresh-token',
      }).toString(),
    });
    assert.strictEqual(
      (await tokenManager.getServiceAppToken()).refreshToken,
      tokenResponse.refresh_token
    );
  });

  it('uses the custom token storage adapter', async () => {
    const token: ServiceAppToken = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: new Date(Date.now() + 3600000),
      refreshAccessTokenExpiresAt: new Date(Date.now() + 7200000),
    };
    const adapter: TokenStorageAdapter = {
      getToken: sandbox.stub().resolves(token),
      setToken: sandbox.stub().resolves(),
      deleteToken: sandbox.stub().resolves(),
    };
    tokenManager = new TokenManager(
      {clientId, clientSecret, orgId, tokenStorageAdapter: adapter},
      baseUrl
    );
    await tokenManager.updateServiceAppToken(tokenResponse);
    assert.calledOnceWithExactly(adapter.setToken, token);
    assert.deepEqual(await tokenManager.getServiceAppToken(), token);
    assert.calledOnceWithExactly(adapter.getToken);
    await tokenManager.deleteToken();
    assert.calledOnceWithExactly(adapter.deleteToken);
  });

  it('deletes the stored pair', async () => {
    await tokenManager.updateServiceAppToken(tokenResponse);
    await tokenManager.deleteToken();
    await assert.isRejected(
      tokenManager.getServiceAppToken(),
      Error,
      'Service App token not found'
    );
  });

  ['getServiceAppToken', 'refreshServiceAppAccessToken'].forEach(
    (method: 'getServiceAppToken' | 'refreshServiceAppAccessToken') => {
      it(`rejects ${method} without stored credentials`, async () => {
        await assert.isRejected(tokenManager[method](), Error, 'Service App token not found');
        assert.notCalled(post);
      });
    }
  );

  it('rejects an explicit refresh without a refresh token', async () => {
    await tokenManager.updateServiceAppToken({...tokenResponse, refresh_token: ''});
    await assert.isRejected(
      tokenManager.refreshServiceAppAccessToken(),
      Error,
      'Refresh token was not found'
    );
    assert.notCalled(post);
  });

  it('preserves stored credentials when PAT acquisition fails', async () => {
    await tokenManager.updateServiceAppToken(tokenResponse);
    post.rejects(new Error('Token request failed'));
    await assert.isRejected(
      tokenManager.getServiceAppTokenUsingPAT('test-pat'),
      Error,
      'Token request failed'
    );
    assert.strictEqual(
      (await tokenManager.getServiceAppToken()).accessToken,
      tokenResponse.access_token
    );
  });

  it('propagates refresh failures instead of returning an expired access token', async () => {
    await tokenManager.updateServiceAppToken(tokenResponse);
    clock.tick(3600000);
    post.rejects(new Error('Refresh rejected'));
    await assert.isRejected(tokenManager.getServiceAppToken(), Error, 'Refresh rejected');
  });
});
