import {DataSourceRequest, DataSourceResponse} from './types';
import {DATASOURCE_ENDPOINT} from './constants';
import {HttpClient, ApiResponse} from '../http-client/types';

/**
 * Client for interacting with the /dataSource API.
 */
export default class DataSourceClient {
  private httpClient: HttpClient;

  /**
   * Creates an instance of DataSourceClient.
   * @param {HttpClient} httpClient - The HttpClient instance to use for API requests.
   * @example
   * const httpClient = new HttpClient();
   * const client = new DataSourceClient(httpClient);
   */
  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Creates a new data source.
   * @param {DataSourceRequest} createDataSourceRequest - The request object for creating a data source.
   * @returns {Promise<ApiResponse<DataSourceResponse>>} - A promise that resolves to the API response containing the created data source.
   * @example
   * const request: DataSourceRequest = { name: 'New DataSource', url: 'https://mydatasource.com', schemaId: '123', audience: 'myaudience', subject: 'mysubject', nonce: 'uniqueNonce' };
   * const response = await client.create(request);
   */
  public async create(
    dataSourcePayload: DataSourceRequest
  ): Promise<ApiResponse<DataSourceResponse>> {
    return this.httpClient.post<DataSourceResponse>(DATASOURCE_ENDPOINT, dataSourcePayload); // TODO: Move /dataSources to constants
  }

  /**
   * Retrieves a data source by ID.
   * @param {string} id - The ID of the data source to retrieve.
   * @returns {Promise<ApiResponse<DataSourceResponse>>} - A promise that resolves to the API response containing the data source.
   * @example
   * const id = '123';
   * const response = await client.get(id);
   */
  public async get(id: string): Promise<ApiResponse<DataSourceResponse>> {
    return this.httpClient.get<DataSourceResponse>(`${DATASOURCE_ENDPOINT}/${id}`);
  }

  /**
   * Lists all data sources.
   * @returns {Promise<ApiResponse<DataSourceResponse[]>>} - A promise that resolves to the API response containing the list of data sources.
   * @example
   * const response = await client.list();
   */
  public async list(): Promise<ApiResponse<DataSourceResponse[]>> {
    return this.httpClient.get<DataSourceResponse[]>(DATASOURCE_ENDPOINT);
  }

  /**
   * Updates a data source by ID.
   * @param {string} id - The ID of the data source to update.
   * @param {DataSourceRequest} updateDataSourceRequest - The request object for updating a data source.
   * @returns {Promise<ApiResponse<DataSourceResponse>>} - A promise that resolves to the API response containing the updated data source.
   * @example
   * const id = '123';
   * const request: DataSourceRequest = { name: 'Updated DataSource', url: 'https://mydatasource.com', schemaId: '123', audience: 'myaudience', subject: 'mysubject', nonce: 'uniqueNonce' };
   * const response = await client.update(id, request);
   */
  public async update(
    id: string,
    dataSourcePayload: DataSourceRequest
  ): Promise<ApiResponse<DataSourceResponse>> {
    return this.httpClient.put<DataSourceResponse>(
      `${DATASOURCE_ENDPOINT}/${id}`,
      dataSourcePayload
    );
  }

  /**
   * Deletes a data source by ID.
   * @param {string} id - The ID of the data source to delete.
   * @returns {Promise<ApiResponse<void>>} - A promise that resolves to the API response confirming the deletion.
   * @example
   * const id = '123';
   * const response = await client.delete(id);
   */
  public async delete(id: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete<void>(`${DATASOURCE_ENDPOINT}/${id}`);
  }
}
