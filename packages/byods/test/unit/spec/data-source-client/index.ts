import DataSourceClient from '../../../../src/data-source-client';
import { DataSourceRequest, DataSourceResponse } from '../../../../src/data-source-client/types';
import { HttpClient, ApiResponse } from '../../../../src/http-client/types';
import { decodeJwt } from 'jose';
import log from '../../../../src/Logger';
import { LOGGER } from '../../../../src/Logger/types';
import { BYODS_DATA_SOURCE_CLIENT_MODULE } from '../../../../src/constants';


jest.mock('jose', () => ({
  decodeJwt: jest.fn(),
}));

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
    log.setLogger = jest.fn();
    // Mock crypto.randomUUID
    global.crypto = {
      randomUUID: jest.fn().mockReturnValue('uniqueNonce'),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default logger configuration', () => {
    dataSourceClient = new DataSourceClient(httpClient);
    expect(log.setLogger).toHaveBeenCalledWith(LOGGER.ERROR, BYODS_DATA_SOURCE_CLIENT_MODULE);
  });

  it('should initialize with custom logger configuration', () => {
    const customConfig = {level: LOGGER.INFO};
    dataSourceClient = new DataSourceClient(httpClient, customConfig);
    expect(log.setLogger).toHaveBeenCalledWith(LOGGER.INFO, BYODS_DATA_SOURCE_CLIENT_MODULE);
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

  it('should schedule JWS token refresh and return a cancelable object', async () => {
      const dataSourceId = '123';
      const tokenLifetimeMinutes = 60;
      const nonceGenerator = jest.fn().mockReturnValue('uniqueNonce');
      const timer = setInterval(() => {}, 1000);
      jest.spyOn(global, 'setInterval').mockReturnValue(timer as unknown as NodeJS.Timer);
      jest.spyOn(dataSourceClient as any, 'startAutoRefresh').mockResolvedValue(timer);

      const result = await dataSourceClient.scheduleJWSTokenRefresh(dataSourceId, tokenLifetimeMinutes, nonceGenerator);

      expect(result).toHaveProperty('cancel');
      expect(dataSourceClient['startAutoRefresh']).toHaveBeenCalledWith(dataSourceId, tokenLifetimeMinutes, nonceGenerator);
    });

  it('should handle errors when scheduling JWS token refresh', async () => {
      const dataSourceId = '123';
      const tokenLifetimeMinutes = 60;
      const nonceGenerator = jest.fn().mockReturnValue('uniqueNonce');
      const error = new Error('Failed to schedule');
      jest.spyOn(dataSourceClient as any, 'startAutoRefresh').mockRejectedValue(error);

      await expect(dataSourceClient.scheduleJWSTokenRefresh(dataSourceId, tokenLifetimeMinutes, nonceGenerator)).rejects.toThrow('Failed to schedule');
      expect(dataSourceClient['startAutoRefresh']).toHaveBeenCalledWith(dataSourceId, tokenLifetimeMinutes, nonceGenerator);
    });

  it('should clear the interval when the cancel function is called', async () => {
      const dataSourceId = '123';
      const tokenLifetimeMinutes = 60;
      const nonceGenerator = jest.fn().mockReturnValue('uniqueNonce');
      const timer = setInterval(() => {}, 1000);
  
      jest.spyOn(global, 'setInterval').mockReturnValue(timer as unknown as NodeJS.Timer);
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      jest.spyOn(dataSourceClient as any, 'startAutoRefresh').mockResolvedValue(timer);
  
      const result = await dataSourceClient.scheduleJWSTokenRefresh(dataSourceId, tokenLifetimeMinutes, nonceGenerator);
  
      expect(result).toHaveProperty('cancel');
      result.cancel();
  
      expect(clearIntervalSpy).toHaveBeenCalledWith(timer);
      expect(dataSourceClient['startAutoRefresh']).toHaveBeenCalledWith(dataSourceId, tokenLifetimeMinutes, nonceGenerator);
    });

  it('should start auto-refresh and return a timer', async () => {
      const dataSourceId = '123';
      const tokenLifetimeMinutes = 60;
      const nonceGenerator = jest.fn().mockReturnValue('uniqueNonce');
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
      (decodeJwt as jest.Mock).mockReturnValue({
        'com.cisco.datasource.url': 'https://mydatasource.com/handle',
        sub: 'mySubject',
        aud: 'myAudience',
      });
      jest.spyOn(global, 'setInterval').mockImplementation((fn: Function) => {
        fn();
        return 1 as unknown as NodeJS.Timer;
      });

      const result = await dataSourceClient['startAutoRefresh'](dataSourceId, tokenLifetimeMinutes, nonceGenerator);

      expect(result).toBe(1);
      expect(httpClient.get).toHaveBeenCalledWith(`/dataSources/${dataSourceId}`);
      expect(httpClient.put).toHaveBeenCalledWith(`/dataSources/${dataSourceId}`, expect.any(Object));
    });

  it('should handle errors when starting auto-refresh', async () => {
      const dataSourceId = '123';
      const tokenLifetimeMinutes = 60;
      const nonceGenerator = jest.fn().mockReturnValue('uniqueNonce');
      const error = new Error('Failed to start auto-refresh');
      jest.spyOn(global, 'setInterval').mockImplementation(() => {
        throw error;
      });

      await expect(dataSourceClient['startAutoRefresh'](dataSourceId, tokenLifetimeMinutes, nonceGenerator)).rejects.toThrow('Failed to start auto-refresh');
    });

  it('should reject with an error during auto-refresh when update method fails', async () => {
      const dataSourceId = '123';
      const tokenLifetimeMinutes = 60;
      const nonceGenerator = jest.fn().mockReturnValue('uniqueNonce');
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
      (decodeJwt as jest.Mock).mockReturnValue({
        'com.cisco.datasource.url': 'https://mydatasource.com/handle',
        sub: 'mySubject',
        aud: 'myAudience',
      });
      const error = new Error('Update failed');
      httpClient.put.mockRejectedValue(error);
      await expect(dataSourceClient['startAutoRefresh'](dataSourceId, tokenLifetimeMinutes, nonceGenerator)).rejects.toThrow('Error while starting auto-refresh for dataSource token: Error: Failed to start auto-refresh');
    });
});
