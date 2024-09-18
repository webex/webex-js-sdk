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
});
