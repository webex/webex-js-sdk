import { v4 as uuidv4 } from 'uuid';
import {decodeJwt} from 'jose';
import DataSourceClient from '../../../../src/data-source-client/index';
import {DataSourceRequest, DataSourceResponse} from '../../../../src/data-source-client/types';
import DataSourceService from '../../../../src/data-source-service/index';
import {HttpClient, ApiResponse} from '../../../../src/http-client/types';

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
}));

jest.mock('jose', () => ({
  decodeJwt: jest.fn().mockReturnValue({
    payload: {
      sub: 'mock-subject',
      aud: 'mock-audience',
	  'com.cisco.datasource.url': 'https://www.mock-url.com/getdata',
      nonce: 'mock-nonce-value',
      tokenLifetimeMinutes: 60,
      schemaId: "46b922e5-2c5a-485d-9131-09947f72a6a0",
    },
  }),
}));

describe('DataSourceService', () => {
  let httpClient: jest.Mocked<HttpClient>;
  let dataSourceClient: DataSourceClient;
  let dataSourceService: DataSourceService;
  
  beforeEach(() => {
    httpClient = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };
    dataSourceClient = new DataSourceClient(httpClient);
    dataSourceService = new DataSourceService(dataSourceClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize DataSourceService', () => {
    expect(dataSourceService).toBeDefined();
  });

  it('should refresh the DataSource token with provided tokenLifetimeMinutes', async () => {
    const dataSourceId = 'mock-data-source-id';
    const tokenLifetimeMinutes = 60;

    const startAutoRefreshSpy = jest.spyOn<any, any>(dataSourceService, 'startAutoRefresh');

    await dataSourceService.refreshDataSourceToken(dataSourceId, tokenLifetimeMinutes);

    expect(startAutoRefreshSpy).toHaveBeenCalledWith(dataSourceId, tokenLifetimeMinutes - 5);
  });

  it('should refresh the DataSource token with default tokenLifetimeMinutes if not provided', async () => {
    const dataSourceId = 'mock-data-source-id';

    const startAutoRefreshSpy = jest.spyOn<any, any>(dataSourceService, 'startAutoRefresh');

    await dataSourceService.refreshDataSourceToken(dataSourceId);

    expect(startAutoRefreshSpy).toHaveBeenCalledWith(dataSourceId, 55);
  });

  it('should log an error if dataSourceId is not provided', async () => {
    console.log = jest.fn();

    await dataSourceService.refreshDataSourceToken('');

    expect(console.log).toHaveBeenCalledWith('Required field is missing, Please pass dataSourceId.');
  });

  it('should start auto-refreshing the DataSource token', async () => {
    const id = '123';
    const request: DataSourceRequest = {
      schemaId: 'updatedSchemaId',
      url: 'https://updateddatasource.com',
      audience: 'updatedAudience',
      subject: 'updatedSubject',
      nonce: 'updatedNonce',
      tokenLifetimeMinutes: 55,
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

    httpClient.get.mockResolvedValue(response);
    const getMethodResult = await dataSourceClient.get(id);

    expect(httpClient.get).toHaveBeenCalledWith(`/dataSources/${id}`);
    expect(getMethodResult).toEqual(response);
    
    httpClient.put.mockResolvedValue(response);
    const putMethodResult = await dataSourceClient.update(id, request);

    expect(httpClient.put).toHaveBeenCalledWith(`/dataSources/${id}`, request);
    expect(putMethodResult).toEqual(response);
  });

  it('should stop auto-refreshing the DataSource token', () => {
    console.log = jest.fn();
    dataSourceService['timer'] = setInterval(() => {}, 1000);
    dataSourceService.stopAutoRefresh();
    expect(console.log).toHaveBeenCalledWith('timer has been cleared successfully.');
  });

  it('should decode a JWS token and return the payload', async () => {
    const token = 'mock-jws-token';
    const decodedTokenPayload = await dataSourceService['decodeJWSTokenAndGetPayload'](token);

    expect(decodedTokenPayload).toEqual({
      payload: {
        sub: 'mock-subject',
        aud: 'mock-audience',
	    'com.cisco.datasource.url': 'https://www.mock-url.com/getdata',
        nonce: 'mock-nonce-value',
        tokenLifetimeMinutes: 60,
        schemaId: "46b922e5-2c5a-485d-9131-09947f72a6a0",
      },
    });
  });

  it('should log an error if decoding JWS token fails', async () => {
    console.error = jest.fn();
    (decodeJwt as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Failed to decode');
    });

    const token = 'invalid-jws-token';
    const decodedToken = await dataSourceService['decodeJWSTokenAndGetPayload'](token);

    expect(console.log).toHaveBeenCalledWith('Error occurred while decoding JWS token:', new Error('Failed to decode'));
    expect(decodedToken).toBeNull();
  });
});