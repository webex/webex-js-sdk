import BaseClient from '../../../../src/base-client';
import TokenManager from '../../../../src/token-manager';
import DataSourceClient from '../../../../src/data-source-client';
import {PRODUCTION_BASE_URL, BYODS_BASE_CLIENT_MODULE} from '../../../../src/constants';
import log from '../../../../src/Logger';
import {LOGGER} from '../../../../src/Logger/types';
import {OrgServiceAppAuthorization} from 'packages/byods/src/types';

describe('BaseClient Tests', () => {
  const mockOrgId = 'test-org-id';
  const mockClientId = 'clientId';
  const mockClientSecret = 'clientSecret';
  const mockHeaders = {'X-Custom-Header': 'value'};

  let mockTokenManager: jest.Mocked<TokenManager>;
  let baseClient: BaseClient;

  beforeEach(() => {
    // Create a mock TokenManager
    mockTokenManager = {
      getOrgServiceAppAuthorization: jest.fn(),
      refreshServiceAppAccessToken: jest.fn(),
      // Other methods that might be called but not necessarily tested in this context
    } as unknown as jest.Mocked<TokenManager>;

    // Create an instance of BaseClient with the mocked TokenManager
    baseClient = new BaseClient(
      'https://webexapis.com/v1',
      mockHeaders,
      mockTokenManager,
      mockOrgId
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should initialize with default logger configuration', () => {
    log.setLogger = jest.fn();
    const baseClient: BaseClient = new BaseClient(
      PRODUCTION_BASE_URL,
      {},
      new TokenManager(mockClientId, mockClientSecret),
      'orgId'
    );
    expect(log.setLogger).toHaveBeenCalledWith(LOGGER.ERROR, BYODS_BASE_CLIENT_MODULE);
  });

  it('creates an instance of BaseClient', () => {
    expect(baseClient).toBeInstanceOf(BaseClient);
  });

  it('should make a GET request', async () => {
    const mockResponse = {data: 'test', status: 200};
    jest.spyOn(baseClient, 'request').mockResolvedValue(mockResponse);

    const response = await baseClient.get('/test-endpoint');
    expect(response).toEqual(mockResponse);
  });

  it('should make a POST request', async () => {
    const mockResponse = {data: 'test', status: 200};
    jest.spyOn(baseClient, 'request').mockResolvedValue(mockResponse);

    const response = await baseClient.post('/test-endpoint', {key: 'value'});
    expect(response).toEqual(mockResponse);
  });

  it('should make a PUT request', async () => {
    const mockResponse = {data: 'test', status: 200};
    jest.spyOn(baseClient, 'request').mockResolvedValue(mockResponse);

    const response = await baseClient.put('/test-endpoint', {key: 'value'});
    expect(response).toEqual(mockResponse);
  });

  it('should make a PATCH request', async () => {
    const mockResponse = {data: 'test', status: 200};
    jest.spyOn(baseClient, 'request').mockResolvedValue(mockResponse);

    const response = await baseClient.patch('/test-endpoint', {key: 'value'});
    expect(response).toEqual(mockResponse);
  });

  it('should make a DELETE request', async () => {
    const mockResponse = {data: 'test', status: 200};
    jest.spyOn(baseClient, 'request').mockResolvedValue(mockResponse);

    const response = await baseClient.delete('/test-endpoint');
    expect(response).toEqual(mockResponse);
  });

  it('should get an HTTP client for org', () => {
    const httpClient = baseClient.getHttpClientForOrg();
    expect(httpClient).toHaveProperty('get');
    expect(httpClient).toHaveProperty('post');
    expect(httpClient).toHaveProperty('put');
    expect(httpClient).toHaveProperty('patch');
    expect(httpClient).toHaveProperty('delete');
  });

  it('should get a data source client', () => {
    expect(baseClient.dataSource).toBeInstanceOf(DataSourceClient);
  });

  it('should return the existing access token if it is not expired', async () => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 3600 * 1000);

    mockTokenManager.getOrgServiceAppAuthorization.mockResolvedValueOnce({
      serviceAppToken: {
        accessToken: 'valid-access-token',
        expiresAt: oneHourLater,
      },
    } as OrgServiceAppAuthorization);

    const token = await (baseClient as any).getToken(); // Casting so we can call private method directly in test
    expect(token).toBe('valid-access-token');
    expect(mockTokenManager.refreshServiceAppAccessToken).not.toHaveBeenCalled();
  });

  it('should refresh the token if it is expired', async () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600 * 1000);

    // First call returns an expired token
    mockTokenManager.getOrgServiceAppAuthorization.mockResolvedValueOnce({
      serviceAppToken: {
        accessToken: 'expired-access-token',
        expiresAt: oneHourAgo,
      },
    } as OrgServiceAppAuthorization);

    // Second call returns a refreshed token
    mockTokenManager.getOrgServiceAppAuthorization.mockResolvedValueOnce({
      serviceAppToken: {
        accessToken: 'new-access-token',
        expiresAt: new Date(now.getTime() + 3600 * 1000),
      },
    } as OrgServiceAppAuthorization);

    const token = await (baseClient as any).getToken(); // Casting so we can call private method
    expect(mockTokenManager.refreshServiceAppAccessToken).toHaveBeenCalledWith(
      mockOrgId,
      mockHeaders
    );
    expect(token).toBe('new-access-token');
  });
});
