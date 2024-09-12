import {DataSourceRequest, DataSourceResponse, HttpClient, ApiResponse} from './types';

/**
 * Client for interacting with the /dataSource API.
 */
export default class DataSourceClient {
  private httpClient: HttpClient;

  /**
   * Creates an instance of DataSourceClient.
   * @param {HttpClient} httpClient - The HttpClient instance to use for API requests.
   */
  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Creates a new data source.
   * @param {DataSourceRequest} createDataSourceRequest - The request object for creating a data source.
   * @returns {Promise<ApiResponse<DataSourceResponse>>} - A promise that resolves to the API response containing the created data source.
   */
  public async create(
    createDataSourceRequest: DataSourceRequest
  ): Promise<ApiResponse<DataSourceResponse>> {
    return this.httpClient.post<DataSourceResponse>('/dataSources', createDataSourceRequest);
  }

  /**
   * Retrieves a data source by ID.
   * @param {string} id - The ID of the data source to retrieve.
   * @returns {Promise<ApiResponse<DataSourceResponse>>} - A promise that resolves to the API response containing the data source.
   */
  public async get(id: string): Promise<ApiResponse<DataSourceResponse>> {
    return this.httpClient.get<DataSourceResponse>(`/dataSources/${id}`);
  }

  /**
   * Lists all data sources.
   * @returns {Promise<ApiResponse<DataSourceResponse[]>>} - A promise that resolves to the API response containing the list of data sources.
   */
  public async list(): Promise<ApiResponse<DataSourceResponse[]>> {
    return this.httpClient.get<DataSourceResponse[]>('/dataSources');
  }

  /**
   * Updates a data source by ID.
   * @param {string} id - The ID of the data source to update.
   * @param {DataSourceRequest} updateDataSourceRequest - The request object for updating a data source.
   * @returns {Promise<ApiResponse<DataSourceResponse>>} - A promise that resolves to the API response containing the updated data source.
   */
  public async update(
    id: string,
    updateDataSourceRequest: DataSourceRequest
  ): Promise<ApiResponse<DataSourceResponse>> {
    return this.httpClient.put<DataSourceResponse>(`/dataSources/${id}`, updateDataSourceRequest);
  }

  /**
   * Deletes a data source by ID.
   * @param {string} id - The ID of the data source to delete.
   * @returns {Promise<ApiResponse<void>>} - A promise that resolves to the API response confirming the deletion.
   */
  public async delete(id: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete<void>(`/dataSources/${id}`);
  }
}
