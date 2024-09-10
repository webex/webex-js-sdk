import fetch, {Response} from 'node-fetch';
import BYODS from './BYODS';

jest.mock('node-fetch', () => jest.fn());

describe('BYoDS Tests', () => {
  const mockSDKConfig = {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    accessToken: 'your-initial-access-token',
    refreshToken: 'your-refresh-token',
    expiresAt: new Date('2024-09-15T00:00:00Z'),
  };

  const mockResponse = {
    json: jest.fn().mockResolvedValue({key: 'value'}),
  } as unknown as Response;

  (fetch as unknown as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse);

  it('fetch the datasources', async () => {
    const mockPayload = {
      headers: {
        Authorization: `Bearer ${mockSDKConfig.accessToken}`,
      },
    };
    const sdk = new BYODS(mockSDKConfig);
    const endpoint = 'https://developer-applications.ciscospark.com/v1/dataSources/';
    await sdk.makeAuthenticatedRequest(endpoint);
    expect(fetch).toHaveBeenCalledWith(endpoint, mockPayload);
  });
});
