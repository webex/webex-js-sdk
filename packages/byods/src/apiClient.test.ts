import fetch, {Response} from 'node-fetch';
import listDataSources from './apiClient';

jest.mock('node-fetch', () => jest.fn());

describe('BYoDS Tests', () => {
  const mockResponse = {
    json: jest.fn().mockResolvedValue({key: 'value'}),
  } as unknown as Response;

  (fetch as unknown as jest.MockedFunction<typeof fetch>).mockResolvedValue(mockResponse);

  it('fetch the datasources', async () => {
    listDataSources();
  });
});
