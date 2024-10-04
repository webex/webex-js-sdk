import DataSourceClient from '../../../../src/data-source-client';
import {DataSourceRequest, DataSourceResponse} from '../../../../src/data-source-client/types';
import {HttpClient, ApiResponse} from '../../../../src/http-client/types';

describe('DataSourceClient', () => {
  let httpClient: jest.Mocked<HttpClient>;
  let dataSourceClient: DataSourceClient;

  beforeEach(() => {
    httpClient = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };
    dataSourceClient = new DataSourceClient(httpClient);
    // Mock crypto.randomUUID
    global.crypto = {
      randomUUID: jest.fn().mockReturnValue('uniqueNonce'),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new data source', async () => {
    const request: DataSourceRequest = {
      schemaId: 'myschemaid',
      url: 'https://mydatasource.com',
      audience: 'myaudience',
      subject: 'mysubject',
      nonce: 'uniqueNonce',
      tokenLifetimeMinutes: 60,
    };
    const response: ApiResponse<DataSourceResponse> = {
      status: 201,
      data: {
        id: '123',
        schemaId: 'myschemaid',
        orgId: 'org123',
        applicationId: 'app123',
        status: 'active',
        jwsToken: 'someJwsToken',
        createdBy: 'someUser',
        createdAt: '2024-01-01T00:00:00Z',
      },
    };
    httpClient.post.mockResolvedValue(response);

    const result = await dataSourceClient.create(request);

    expect(httpClient.post).toHaveBeenCalledWith('/dataSources', request);
    expect(result).toEqual(response);
  });

  it('should retrieve a data source by ID', async () => {
    const id = '123';
    const response: ApiResponse<DataSourceResponse> = {
      status: 200,
      data: {
        id: '123',
        schemaId: 'myschemaid',
        orgId: 'org123',
        applicationId: 'app123',
        status: 'active',
        jwsToken: 'someJwsToken',
        createdBy: 'someUser',
        createdAt: '2024-01-01T00:00:00Z',
      },
    };
    httpClient.get.mockResolvedValue(response);

    const result = await dataSourceClient.get(id);

    expect(httpClient.get).toHaveBeenCalledWith(`/dataSources/${id}`);
    expect(result).toEqual(response);
  });

  it('should list all data sources', async () => {
    const response: ApiResponse<DataSourceResponse[]> = {
      data: [
        {
          id: '123',
          schemaId: 'myschemaid',
          orgId: 'org123',
          applicationId: 'app123',
          status: 'active',
          jwsToken: 'someJwsToken',
          createdBy: 'someUser',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
      status: 200,
    };
    httpClient.get.mockResolvedValue(response);

    const result = await dataSourceClient.list();

    expect(httpClient.get).toHaveBeenCalledWith('/dataSources');
    expect(result).toEqual(response);
  });

  it('should update a data source by ID', async () => {
    const id = '123';
    const request: DataSourceRequest = {
      schemaId: 'updatedSchemaId',
      url: 'https://updateddatasource.com',
      audience: 'updatedAudience',
      subject: 'updatedSubject',
      nonce: 'updatedNonce',
      tokenLifetimeMinutes: 60,
    };
    const response: ApiResponse<DataSourceResponse> = {
      status: 200,
      data: {
        id: '123',
        schemaId: 'updatedSchemaId',
        orgId: 'org123',
        applicationId: 'app123',
        status: 'active',
        jwsToken: 'updatedJwsToken',
        createdBy: 'someUser',
        createdAt: '2024-01-01T00:00:00Z',
      },
    };
    httpClient.put.mockResolvedValue(response);

    const result = await dataSourceClient.update(id, request);

    expect(httpClient.put).toHaveBeenCalledWith(`/dataSources/${id}`, request);
    expect(result).toEqual(response);
  });

  it('should delete a data source by ID', async () => {
    const id = '123';
    const response: ApiResponse<void> = {
      data: undefined,
      status: 204,
    };
    httpClient.delete.mockResolvedValue(response);

    const result = await dataSourceClient.delete(id);

    expect(httpClient.delete).toHaveBeenCalledWith(`/dataSources/${id}`);
    expect(result).toEqual(response);
  });

  it('should handle errors when creating a data source', async () => {
    const request: DataSourceRequest = {
      schemaId: 'myschemaid',
      url: 'https://mydatasource.com',
      audience: 'myaudience',
      subject: 'mysubject',
      nonce: 'uniqueNonce',
      tokenLifetimeMinutes: 60,
    };
    const error = new Error('Network error');
    httpClient.post.mockRejectedValue(error);

    await expect(dataSourceClient.create(request)).rejects.toThrow('Network error');
    expect(httpClient.post).toHaveBeenCalledWith('/dataSources', request);
  });

  it('should handle errors when retrieving a data source by ID', async () => {
    const id = '123';
    const error = new Error('Network error');
    httpClient.get.mockRejectedValue(error);

    await expect(dataSourceClient.get(id)).rejects.toThrow('Network error');
    expect(httpClient.get).toHaveBeenCalledWith(`/dataSources/${id}`);
  });

  it('should handle errors when listing all data sources', async () => {
    const error = new Error('Network error');
    httpClient.get.mockRejectedValue(error);

    await expect(dataSourceClient.list()).rejects.toThrow('Network error');
    expect(httpClient.get).toHaveBeenCalledWith('/dataSources');
  });

  it('should handle errors when updating a data source by ID', async () => {
    const id = '123';
    const request: DataSourceRequest = {
      schemaId: 'updatedSchemaId',
      url: 'https://updateddatasource.com',
      audience: 'updatedAudience',
      subject: 'updatedSubject',
      nonce: 'updatedNonce',
      tokenLifetimeMinutes: 120,
    };
    const error = new Error('Network error');
    httpClient.put.mockRejectedValue(error);

    await expect(dataSourceClient.update(id, request)).rejects.toThrow('Network error');
    expect(httpClient.put).toHaveBeenCalledWith(`/dataSources/${id}`, request);
  });

  it('should handle errors when deleting a data source by ID', async () => {
    const id = '123';
    const error = new Error('Network error');
    httpClient.delete.mockRejectedValue(error);

    await expect(dataSourceClient.delete(id)).rejects.toThrowError('Network error');
    expect(httpClient.delete).toHaveBeenCalledWith(`/dataSources/${id}`);
  });


    it('should schedule JWS token refresh and provide a cancel function', async () => {
      const dataSourceId = '123';
      const tokenLifetimeMinutes = 60;

      jest.spyOn(dataSourceClient, 'startAutoRefresh').mockResolvedValue(setInterval(() => {}, 1000));

      const result = await dataSourceClient.scheduleJWSTokenRefresh(dataSourceId, tokenLifetimeMinutes);

      expect(result).toHaveProperty('cancel');
      result.cancel();
    });

    it('should reject with an error if dataSourceId is missing or invalid', async () => {
      await expect(dataSourceClient.scheduleJWSTokenRefresh('', 60)).rejects.toThrow('dataSourceId is missing which is a required parameter or invalid tokenLifetimeMinutes is provided.');
      await expect(dataSourceClient.scheduleJWSTokenRefresh(null as any, 60)).rejects.toThrow('dataSourceId is missing which is a required parameter or invalid tokenLifetimeMinutes is provided.');
    });

    it('should reject with an error if tokenLifetimeMinutes is invalid', async () => {
      await expect(dataSourceClient.scheduleJWSTokenRefresh('123', 0)).rejects.toThrow('dataSourceId is missing which is a required parameter or invalid tokenLifetimeMinutes is provided.');
      await expect(dataSourceClient.scheduleJWSTokenRefresh('123', 1441)).rejects.toThrow('dataSourceId is missing which is a required parameter or invalid tokenLifetimeMinutes is provided.');
      await expect(dataSourceClient.scheduleJWSTokenRefresh('123', NaN)).rejects.toThrow('dataSourceId is missing which is a required parameter or invalid tokenLifetimeMinutes is provided.');
    });

    it('should handle errors when scheduling JWS token refresh', async () => {
      jest.spyOn(dataSourceClient, 'startAutoRefresh').mockRejectedValue(new Error('startAutoRefresh error'));

      await expect(dataSourceClient.scheduleJWSTokenRefresh('123', 60)).rejects.toThrow('startAutoRefresh error');
    });

    it('should handle errors in startAutoRefresh gracefully', async () => {
      const dataSourceId = '123';
      const tokenLifetimeMinutes = 54; // assuming a 10% reduction for the test
      const nonce = 'uniqueNonce';
      const error = new Error('Network error');

      httpClient.get.mockRejectedValue(error);

      await expect(dataSourceClient.startAutoRefresh(dataSourceId, tokenLifetimeMinutes, nonce)).rejects.toThrow('Network error');
    });

    it('should handle undefined jwsTokenPayload', async () => {
      const dataSourceId = '123';
      const tokenLifetimeMinutes = 54;
      const nonce = 'uniqueNonce';
      const response: ApiResponse<DataSourceResponse> = {
        status: 200,
        data: { schemaId: 'schemaId', jwsToken: 'someJwsToken' },
      };

      httpClient.get.mockResolvedValue(response);
      jest.mock('jsonwebtoken', () => ({
        decode: jest.fn().mockReturnValue(undefined),
      }));

      await expect(dataSourceClient.startAutoRefresh(dataSourceId, tokenLifetimeMinutes, nonce)).rejects.toThrow('Invalid JWT');
    });  
});
