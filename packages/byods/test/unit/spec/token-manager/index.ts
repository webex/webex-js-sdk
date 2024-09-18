import fetch, {Response} from 'node-fetch';

import TokenManager from '../../../../src/token-manager';
import {TokenResponse} from '../../../../src/types';

jest.mock('node-fetch', () => jest.fn());

describe('TokenManager', () => {
  const clientId = 'test-client-id';
  const clientSecret = 'test-client-secret';
  const baseUrl = 'https://webexapis.com/v1';
  const orgId = 'test-org-id';
  const personalAccessToken = 'test-personal-access-token';
  const refreshToken = 'test-refresh-token';

  let tokenManager: TokenManager;

  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    tokenManager = new TokenManager(clientId, clientSecret, baseUrl);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should update service app token', async () => {
    const tokenResponse: TokenResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      refresh_token_expires_in: 7200,
    };

    tokenManager.updateServiceAppToken(tokenResponse, orgId);

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

    tokenManager.updateServiceAppToken(tokenResponse, orgId);

    const serviceAppAuthorization = await tokenManager.getOrgServiceAppAuthorization(orgId);
    expect(serviceAppAuthorization).toBeDefined();
    expect(serviceAppAuthorization.serviceAppToken.accessToken).toBe('new-access-token');
  });

  it('should throw error if service app authorization not found', async () => {
    await expect(tokenManager.getOrgServiceAppAuthorization(orgId)).rejects.toThrow(
      'Service app authorization not found'
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

    tokenManager.updateServiceAppToken(tokenResponse, orgId);

    const mockResponse = {
      json: jest.fn().mockResolvedValue(tokenResponse),
      ok: true,
    } as unknown as Response;

    (fetch as unknown as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse);

    await tokenManager.refreshServiceAppAccessToken(orgId);

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });
    const serviceAppAuthorization = await tokenManager.getOrgServiceAppAuthorization(orgId);
    expect(serviceAppAuthorization.serviceAppToken.accessToken).toBe('new-access-token');
  });

  it('should throw error if refresh token is undefined', async () => {
    await expect(tokenManager.refreshServiceAppAccessToken(orgId)).rejects.toThrow(
      'Service app authorization not found'
    );
  });

  it('should retrieve token after authorization', async () => {
    const tokenResponse: TokenResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token_expires_in: 7200,
    };

    const mockResponse = {
      json: jest.fn().mockResolvedValue(tokenResponse),
      ok: true,
    } as unknown as Response;

    (fetch as unknown as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse);

    await tokenManager.getServiceAppTokenUsingPAT(orgId, personalAccessToken);

    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/applications/${tokenManager.getServiceAppId()}/token`,
      {
        method: 'POST',
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
});
