/* eslint-disable no-console */

import {v4 as uuidv4} from 'uuid';
import {decodeJwt, JWTPayload} from 'jose';
import {DataSourceRequest, DataSourceResponse} from './types';
import {DATASOURCE_ENDPOINT} from './constants';
import {HttpClient, ApiResponse} from '../http-client/types';

/**
 * Client for interacting with the /dataSource API.
 */
export default class DataSourceClient {
  private httpClient: HttpClient;
  private timer: NodeJS.Timeout | null;

  /**
   * Creates an instance of DataSourceClient.
   * @param {HttpClient} httpClient - The HttpClient instance to use for API requests.
   * @example
   * const httpClient = new HttpClient();
   * const client = new DataSourceClient(httpClient);
   */
  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
    this.timer = null;
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
   * This method refreshes the DataSource token using dataSourceId and tokenLifetimeMinute
   * @param {string} dataSourceId The id of data source
   * @param {number} tokenLifetimeMinutes The Life time minutes for the data source. <=1440
   * @returns {Promise<any>}
   * @example
   * try {
    const dataSourceId = '123'; // Replace with your actual dataSourceId
    const tokenLifetimeMinutes = 60; // Optional, replace with your actual token lifetime minutes

    const result = await dataSourceClient.refreshDataSourceToken(dataSourceId, tokenLifetimeMinutes);
    // Use the cancel function if needed
    result.cancel();
  } catch (error) {
    console.error('Error refreshing data source token:', error);
  }
   */

  public async refreshDataSourceToken(
    dataSourceId: string,
    tokenLifetimeMinutes?: number
  ): Promise<any> {
    try {
      if (dataSourceId) {
        let reducedTokenLifetimeMinutes = 55; // reducing the tokenlifetimeMinute by 8%, considering default value 60.
        if (tokenLifetimeMinutes) {
          // Below logic will generate a random percentage between 5% and 10%
          const randomPercentage = Math.random() * 5 + 5;
          // Then calculate the reducedTokenLifetimeMinutes
          reducedTokenLifetimeMinutes = Math.floor(
            tokenLifetimeMinutes * (1 - randomPercentage / 100)
          );
        }
        this.startAutoRefresh(dataSourceId, reducedTokenLifetimeMinutes);
        const cancel = () => {
          if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            console.log('Auto-refresh has been cancelled successfully.');
          }
        };

        return Promise.resolve({cancel});
      }
      console.log('Required field is missing, Please pass dataSourceId.');

      return Promise.reject(new Error('Required field is missing, Please pass dataSourceId'));
    } catch (error) {
      console.log('Encountered some error, error is', error);

      return Promise.reject(error);
    }
  }

  /**
   * This Private method will start auto refreshing the DataSource token with interval as tokenLifetimeMinutes.
   * @param {string} dataSourceId The id of data source
   * @param {number} tokenLifetimeMinutes The Life time minutes for the data source. <=1440
   * @param {string} nonceGenerator This accepts an optional nonceGenerator, developer can provide their own nonceGenerator.
   * @returns {Promise<void>}
   */

  private async startAutoRefresh(
    dataSourceId: string,
    tokenLifetimeMinutes: number,
    nonceGenerator: () => string = uuidv4 // Defaults to uuidv4 if nonceGenerator is not provided.
  ): Promise<void> {
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
      const getResponse = await this.get(dataSourceId);
      const jwsToken: string = getResponse?.data?.jwsToken;
      const jwsTokenPayload: JWTPayload = decodeJwt(jwsToken);
      payloadForDataSourceUpdateMethod.schemaId = getResponse?.data?.schemaId;
      payloadForDataSourceUpdateMethod.tokenLifetimeMinutes = tokenLifetimeMinutes;
      payloadForDataSourceUpdateMethod.nonce = nonceGenerator(); // Use the provided nonce generator
      if (jwsTokenPayload) {
        payloadForDataSourceUpdateMethod.url = jwsTokenPayload[
          'com.cisco.datasource.url'
        ] as string;
        payloadForDataSourceUpdateMethod.subject = jwsTokenPayload.sub ?? '';
        payloadForDataSourceUpdateMethod.audience = jwsTokenPayload.aud ?? '';
        this.timer = setInterval(async () => {
          const updateResponse = await this.update(dataSourceId, payloadForDataSourceUpdateMethod);
          console.log('dataSource has been refreshed successfully, response is', updateResponse);
        }, tokenLifetimeMinutes * 60 * 1000); // Converts minutes to milliseconds.
      } else {
        console.log('jwsTokenPayload is coming as undefined!');
      }
    } catch (error) {
      console.log('Got error while starting auto refreshing dataSource token', error);
    }
  }
}
