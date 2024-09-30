import fetch, {Response} from 'node-fetch';
import {httpUtils} from "../../../../src/http-utils";

jest.mock('node-fetch', () => jest.fn());

describe('HttpUtils Tests', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('should make an HTTP request', async () => {
    const mockResponse = {
      json: jest.fn().mockResolvedValue({ dummyKey: 'dummy-value' }),
      ok: true,
      status: 200,
    } as unknown as Response;

    (fetch as unknown as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse);

    const response = await httpUtils.request('/test-endpoint', {method: 'GET', headers: {}});
    console.debug('response', response);

    expect(response).toEqual({ data: { dummyKey: 'dummy-value' }, status: 200 });
  });

  it('should make an HTTP GET request', async () => {
    const mockResponse = {data: 'test', status: 200};
    jest.spyOn(httpUtils, 'request').mockResolvedValue(mockResponse);

    const response = await httpUtils.get('/test-endpoint', {headers: {}});
    expect(response).toEqual(mockResponse);
  });

  it('should make an HTTP POST request', async () => {
    const mockResponse = {data: 'test', status: 200};
    jest.spyOn(httpUtils, 'request').mockResolvedValue(mockResponse);

    const response = await httpUtils.post('/test-endpoint', {headers: {}});
    expect(response).toEqual(mockResponse);
  });

  it('should make an HTTP PUT request', async () => {
    const mockResponse = {data: 'test', status: 200};
    jest.spyOn(httpUtils, 'request').mockResolvedValue(mockResponse);

    const response = await httpUtils.put('/test-endpoint', {headers: {}});
    expect(response).toEqual(mockResponse);
  });

  it('should make an HTTP DELETE request', async () => {
    const mockResponse = {data: 'test', status: 200};
    jest.spyOn(httpUtils, 'request').mockResolvedValue(mockResponse);

    const response = await httpUtils.del('/test-endpoint');
    expect(response).toEqual(mockResponse);
  });

  it('should make an HTTP PATCH request', async () => {
    const mockResponse = {data: 'test', status: 200};
    jest.spyOn(httpUtils, 'request').mockResolvedValue(mockResponse);

    const response = await httpUtils.patch('/test-endpoint', {headers: {}});
    expect(response).toEqual(mockResponse);
  });
});