import BaseClient from '../../../../src/base-client';
import TokenManager from '../../../../src/token-manager';
import DataSourceClient from '../../../../src/data-source-client';
import {PRODUCTION_BASE_URL} from '../../../../src/constants';

describe('BaseClient Tests', () => {
  const baseClient: BaseClient = new BaseClient(
    PRODUCTION_BASE_URL,
    {},
    new TokenManager('clientId', 'clientSecret'),
    'orgId'
  );

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
});
