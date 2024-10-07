/* eslint-disable no-console */

import {decodeJwt, JWTPayload} from 'jose';
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

  /**
   * This method refreshes the DataSource token using dataSourceId, tokenLifetimeMinutes (optional) & nonceGenerator (optional)
   * @param {string} dataSourceId The id of the data source.
   * @param {number} tokenLifetimeMinutes The refresh interval in minutes for the data source. Defaults to 60. Should be <= 1440 & >=1.
   * @param {string} nonceGenerator Accepts an optional nonceGenerator, developer can provide their own nonceGenerator, defaults to randomUUID.
   * @returns {Promise<() => void>} A promise that resolves to the API response containing a cancellable function.
   * @example
   * @example
   * try {
    const result = await dataSourceClient.scheduleJWSTokenRefresh('myDataSourceId', 'myTokenLifeTimeMinutes', 'uniqueNonce');
    // Use the cancel function if needed
    result.cancel();
  } catch (error) {
    console.error('Error refreshing data source token:', error);
  }
   */

  public async scheduleJWSTokenRefresh(
    dataSourceId: string,
    tokenLifetimeMinutes = 60,
    nonceGenerator: () => string = crypto.randomUUID
  ): Promise<{cancel: () => void}> {
    try {
      if (
        !dataSourceId ||
        typeof dataSourceId !== 'string' ||
        tokenLifetimeMinutes < 1 ||
        tokenLifetimeMinutes > 1440 ||
        Number.isNaN(tokenLifetimeMinutes)
      ) {
        console.error(
          'dataSourceId is missing which is a required parameter or invalid tokenLifetimeMinutes is provided.'
        );

        return Promise.reject(
          new Error(
            'dataSourceId is missing which is a required parameter or invalid tokenLifetimeMinutes is provided.'
          )
        );
      }

      // Below logic will generate a random percentage between 5% and 10%
      const randomPercentage = Math.random() * 5 + 5;
      // Then calculate the reducedTokenLifetimeMinutes
      const reducedTokenLifetimeMinutes = Math.ceil(
        tokenLifetimeMinutes * (1 - randomPercentage / 100)
      );
      const timer = await this.startAutoRefresh(
        dataSourceId,
        reducedTokenLifetimeMinutes,
        nonceGenerator()
      );

      const cancel = () => {
        if (timer) {
          try {
            clearInterval(timer);
            console.log('Auto-refresh has been cancelled successfully.');
          } catch (error) {
            console.error(
              'Failed to cancel the timer, may be the timer has expired or the timer is invalid',
              error
            );
            throw new Error(
              'Failed to cancel the timer, may be the timer has expired or the timer is invalid'
            );
          }
        }
      };

      return Promise.resolve({cancel});
    } catch (error) {
      console.error('Encountered some error', error);

      return Promise.reject(error);
    }
  }

  /**
   * This Private method will start auto refreshing the DataSource token. Accepts dataSourceId, tokenLifetimeMinutes & nonce.
   * @param {string} dataSourceId The id of the data source
   * @param {number} tokenLifetimeMinutes The refresh interval in minutes for the data source. Defaults to 60 but less than < 1440
   * @param {string} nonce A unique nonce for the data source request.
   * @returns {Promise<NodeJS.Timer>} A promise that resolves to the API response containing NodeJS.Timer.
   */

  private async startAutoRefresh(
    dataSourceId: string,
    tokenLifetimeMinutes: number,
    nonce: string
  ): Promise<NodeJS.Timer> {
    try {
      // Call the get method to fetch the dataSource details & then call the update method to update the token!
      const payloadForDataSourceUpdateMethod: DataSourceRequest = {
        schemaId: '',
        url: '',
        audience: '',
        subject: '',
        nonce: '',
        tokenLifetimeMinutes: 0,
      };
      const getMethodResponse: ApiResponse<DataSourceResponse> = await this.get(dataSourceId);
      if (!getMethodResponse || !getMethodResponse.data || !getMethodResponse.data.jwsToken) {
        return Promise.reject(new Error('Invalid response from get method.'));
      }

      const jwsToken: string = getMethodResponse?.data?.jwsToken;
      const jwsTokenPayload: JWTPayload = decodeJwt(jwsToken) as JWTPayload;

      if (!jwsTokenPayload || !jwsToken) {
        return Promise.reject(new Error('jwsTokenPayload or jwsToken is undefined.'));
      }

      payloadForDataSourceUpdateMethod.schemaId = getMethodResponse?.data?.schemaId;
      payloadForDataSourceUpdateMethod.tokenLifetimeMinutes = tokenLifetimeMinutes;
      payloadForDataSourceUpdateMethod.nonce = nonce;
      payloadForDataSourceUpdateMethod.url = jwsTokenPayload['com.cisco.datasource.url'] as string;
      payloadForDataSourceUpdateMethod.subject = jwsTokenPayload.sub as string;
      payloadForDataSourceUpdateMethod.audience = jwsTokenPayload.aud as string;

      const interval = setInterval(async () => {
        try {
          const updateMethodResponse = await this.update(
            dataSourceId,
            payloadForDataSourceUpdateMethod
          );
          console.log(
            'dataSource has been refreshed successfully, response is',
            updateMethodResponse
          );
        } catch (updateError) {
          // If there is some error than clear the Interval only if interval is active/
          if (interval) clearInterval(interval);
          console.error('Error while updating dataSource token', updateError);
          throw new Error('Error while updating dataSource token');
        }
      }, tokenLifetimeMinutes * 60 * 1000); // Converts minutes to milliseconds.

      return Promise.resolve(interval);
    } catch (error) {
      console.error('Error while starting auto-refresh for dataSource token:', error);

      return Promise.reject(error);
    }
  }
}
