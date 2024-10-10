import TokenManager from '../../../../src/token-manager';
import {TokenResponse} from '../../../../src/types';
import {httpUtils} from '../../../../src/http-utils';
import log from '../../../../src/Logger';
import {LOGGER} from '../../../../src/Logger/types';
import {BYODS_TOKEN_MANAGER_MODULE} from '../../../../src/constants';;

describe('TokenManager', () => {
  const clientId = 'test-client-id';
  const clientSecret = 'test-client-secret';
  const baseUrl = 'https://webexapis.com/v1';
  const orgId = 'test-org-id';
  const personalAccessToken = 'test-personal-access-token';
  const refreshToken = 'test-refresh-token';

  let tokenManager: TokenManager;

  beforeEach(() => {
    tokenManager = new TokenManager(clientId, clientSecret, baseUrl);
    log.setLogger = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should initialize with default logger configuration', () => {
    tokenManager = new TokenManager(clientId, clientSecret, baseUrl);
    expect(log.setLogger).toHaveBeenCalledWith(LOGGER.ERROR, BYODS_TOKEN_MANAGER_MODULE);
  });

  it('should update service app token', async () => {
    const tokenResponse: TokenResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      refresh_token_expires_in: 7200,
    };

    await tokenManager.updateServiceAppToken(tokenResponse, orgId);

    const serviceAppAuthorization = await tokenManager.getOrgServiceAppAuthorization(orgId);
    expect(serviceAppAuthorization).toBeDefined();
    expect(serviceAppAuthorization.serviceAppToken.accessToken).toBe('new-access-token');
    expect(serviceAppAuthorization.serviceAppToken.refreshToken).toBe('new-refresh-token');
  });

  it('should get service app authorization', async () => {
    const tokenResponse: TokenResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      refresh_token_expires_in: 7200,
    };

    await tokenManager.updateServiceAppToken(tokenResponse, orgId);

    const serviceAppAuthorization = await tokenManager.getOrgServiceAppAuthorization(orgId);
    expect(serviceAppAuthorization).toBeDefined();
    expect(serviceAppAuthorization.serviceAppToken.accessToken).toBe('new-access-token');
  });

  it('should list all stored tokens', async () => {
    const tokenResponse: TokenResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      refresh_token_expires_in: 7200,
    };

    await tokenManager.updateServiceAppToken(tokenResponse, orgId);

    // List tokens using tokenManager
    const tokens = await tokenManager.listTokens();
    expect(tokens).toBeDefined();
    expect(tokens.length).toBe(1);
  });

  it('should delete a token for a given orgId', async () => {
    const tokenResponse: TokenResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      refresh_token_expires_in: 7200,
    };
    await tokenManager.updateServiceAppToken(tokenResponse, orgId);
    await tokenManager.deleteToken(orgId);

    const tokens = await tokenManager.listTokens();
    expect(tokens).toBeDefined();
    expect(tokens.length).toBe(0);
  });

  it('should reset all tokens', async () => {
    const tokenResponse: TokenResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      refresh_token_expires_in: 7200,
    };
    const dummyOrgId = 'org-456';
    const dummyTokenResponse: TokenResponse = {
      access_token: 'another-access-token',
      refresh_token: 'another-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      refresh_token_expires_in: 7200,
    };

    await tokenManager.updateServiceAppToken(tokenResponse, orgId);
    await tokenManager.updateServiceAppToken(dummyTokenResponse, dummyOrgId);

    await tokenManager.resetTokens();

    const tokens = await tokenManager.listTokens();
    expect(tokens).toBeDefined();
    expect(tokens.length).toBe(0);
  });

  it('should throw error if service app authorization not found', async () => {
    await expect(tokenManager.getOrgServiceAppAuthorization(orgId)).rejects.toThrow(
      `Service App token not found for org ID: ${orgId}`
    );
  });

  it('should refresh service app access token', async () => {
    const tokenResponse: TokenResponse = {
      access_token: 'new-access-token',
      refresh_token: refreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
      refresh_token_expires_in: 7200,
    };

    httpUtils.request = jest.fn().mockResolvedValueOnce({data: tokenResponse, status: 200});
    jest.spyOn(httpUtils, 'post');

    await tokenManager.updateServiceAppToken(tokenResponse, orgId);

    await tokenManager.refreshServiceAppAccessToken(orgId);

    expect(httpUtils.post).toHaveBeenCalledWith(`${baseUrl}/access_token`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });
    const serviceAppAuthorization = await tokenManager.getOrgServiceAppAuthorization(orgId);
    expect(serviceAppAuthorization.serviceAppToken.accessToken).toBe('new-access-token');
  });

  it('should throw error if refresh token is undefined', async () => {
    await expect(tokenManager.refreshServiceAppAccessToken(orgId)).rejects.toThrow(
      `Service App token not found for org ID: ${orgId}`
    );
  });

  // Fix this later. It passes when ran individually but fails when ran with other tests
  it.skip('should retrieve token after authorization', async () => {
    const tokenResponse: TokenResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token_expires_in: 7200,
    };

    httpUtils.request = jest.fn().mockResolvedValue({data: tokenResponse, status: 200});
    jest.spyOn(httpUtils, 'post');

    await tokenManager.getServiceAppTokenUsingPAT(orgId, personalAccessToken);

    expect(httpUtils.post).toHaveBeenCalledWith(
      `${baseUrl}/applications/${tokenManager.getServiceAppId()}/token`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${personalAccessToken}`,
        },
        body: JSON.stringify({
          targetOrgId: orgId,
          clientId,
          clientSecret,
        }),
      }
    );
    const serviceAppAuthorization = await tokenManager.getOrgServiceAppAuthorization(orgId);
    expect(serviceAppAuthorization.serviceAppToken.accessToken).toBe('new-access-token');
  });

  it('should refresh the token if it is expired', async () => {
    const expiredTokenResponse: TokenResponse = {
      access_token: 'expired-access-token',
      refresh_token: 'valid-refresh-token',
      expires_in: -3600, // Token expired 1 hour ago
      token_type: 'Bearer',
      refresh_token_expires_in: 7200,
    };
  
    const refreshedTokenResponse: TokenResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      refresh_token_expires_in: 7200,
    };
    await tokenManager.updateServiceAppToken(expiredTokenResponse, orgId);

    httpUtils.post = jest.fn().mockResolvedValueOnce({data: refreshedTokenResponse, status: 200});
    jest.spyOn(httpUtils, 'post');
  
    const serviceAppAuthorization = await tokenManager.getOrgServiceAppAuthorization(orgId);
    expect(httpUtils.post).toHaveBeenCalledWith(`${baseUrl}/access_token`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: 'valid-refresh-token',
      }).toString(),
    });
  
    expect(serviceAppAuthorization.serviceAppToken.accessToken).toBe('new-access-token');
    expect(serviceAppAuthorization.serviceAppToken.refreshToken).toBe('new-refresh-token');
  });
});
