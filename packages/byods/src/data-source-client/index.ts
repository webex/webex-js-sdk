/* eslint-disable no-console */

import {decodeJwt, JWTPayload} from 'jose';
import {DataSourceRequest, DataSourceResponse, Cancellable} from './types';
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

  /**
   * This method refreshes the DataSource token using dataSourceId, tokenLifetimeMinutes & nonceGenerator.
   * @param {string} dataSourceId The id of the data source.
   * @param {number} tokenLifetimeMinutes The refresh interval in minutes for the data source. Defaults to 60 mins. Should be an integer.
   * @param {string} nonceGenerator Accepts an nonceGenerator, developer can provide their own nonceGenerator, defaults to randomUUID.
   * @returns {Promise<Cancelable>} A promise that resolves to an object containing a cancel method that cancels the timer.
   * @example
   * try {
    const result = await dataSourceClient.scheduleJWSTokenRefresh('myDataSourceId', 'uniqueNonce', 'myTokenLifeTimeMinutes');
    // Use the cancel function if needed!
    result.cancel();
  } catch (error) {
    console.error('Error scheduling JWS refresh for data source:', error);
  }
   */

  public async scheduleJWSTokenRefresh(
    dataSourceId: string,
    tokenLifetimeMinutes = 60,
    nonceGenerator: () => string = crypto.randomUUID
  ): Promise<Cancellable> {
    try {
      const timer = await this.startAutoRefresh(dataSourceId, tokenLifetimeMinutes, nonceGenerator);

      const cancel = () => {
        if (timer) {
          try {
            clearInterval(timer);
            console.log(
              'JWS Auto-refresh has been cancelled successfully for dataSource:',
              dataSourceId
            );
          } catch (error) {
            console.error(
              'Failed to cancel the timer, the timer might have expired or is invalid',
              error
            );
            throw new Error(
              'Failed to cancel the timer, the timer might have expired or is invalid'
            );
          }
        }
      };

      return Promise.resolve({cancel});
    } catch (error) {
      console.error('Encountered error while trying to setup JWS refresh schedule', error);

      return Promise.reject(error);
    }
  }

  /**
   * Sets up a timer that will auto refresh the DataSource JWS token for given intervals
   * @param {string} dataSourceId The id of the data source
   * @param {number} tokenLifetimeMinutes The refresh interval in minutes for the data source. Defaults to 60 mins. Should be <= 1440 & >=1.
   * @param {string} nonceGenerator Accepts an nonceGenerator that will generate nonce for the data source request.
   * @returns {Promise<NodeJS.Timer>} A promise that resolves to the API response containing NodeJS.Timer.
   */
  private async startAutoRefresh(
    dataSourceId: string,
    tokenLifetimeMinutes: number,
    nonceGenerator?: () => string
  ): Promise<NodeJS.Timer> {
    try {
      // Generate a random percentage between 5% and 10%
      const randomPercentage = Math.random() * 5 + 5;
      // Then calculate the reducedTokenLifetimeMinutes
      const reducedTokenLifetimeMinutes = Math.ceil(
        tokenLifetimeMinutes * (1 - randomPercentage / 100)
      );

      const interval = setInterval(async () => {
        try {
          // Fetch the dataSource details before each update
          const getMethodResponse: ApiResponse<DataSourceResponse> = await this.get(dataSourceId);
          if (!getMethodResponse || !getMethodResponse.data || !getMethodResponse.data.jwsToken) {
            throw new Error('Invalid response from get method.');
          }

          const jwsToken: string = getMethodResponse?.data?.jwsToken;
          const jwsTokenPayload: JWTPayload = decodeJwt(jwsToken) as JWTPayload;

          if (!jwsTokenPayload || !jwsToken) {
            throw new Error('jwsTokenPayload or jwsToken is undefined.');
          }

          const payloadForDataSourceUpdateMethod: DataSourceRequest = {
            schemaId: getMethodResponse?.data?.schemaId,
            tokenLifetimeMinutes,
            url: jwsTokenPayload['com.cisco.datasource.url'] as string,
            subject: jwsTokenPayload.sub as string,
            audience: jwsTokenPayload.aud as string,
            nonce: nonceGenerator ? nonceGenerator() : crypto.randomUUID(),
          };

          await this.update(dataSourceId, payloadForDataSourceUpdateMethod);
          console.log('dataSource has been refreshed successfully');

          return Promise.resolve();
        } catch (updateError) {
          // If there is some error then clear the Interval only if interval is active
          if (interval) {
            clearInterval(interval);
          }
          console.error('Error while updating dataSource token', updateError);

          return Promise.reject(
            new Error(`Error while starting auto-refresh for dataSource token: ${updateError}`)
          );
        }
      }, reducedTokenLifetimeMinutes * 60 * 1000); // Converts minutes to milliseconds.

      return Promise.resolve(interval);
    } catch (error) {
      console.error('Error while starting auto-refresh for dataSource token:', error);

      return Promise.reject(
        new Error(`Error while starting auto-refresh for dataSource token: ${error}`)
      );
    }
  }
}
