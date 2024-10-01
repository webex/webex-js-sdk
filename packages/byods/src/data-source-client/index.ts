/* eslint-disable no-async-promise-executor */
/* eslint-disable prefer-promise-reject-errors */
/* eslint-disable no-useless-catch */
/* eslint-disable no-console */
/* eslint-disable class-methods-use-this */
/* eslint-disable import/no-extraneous-dependencies */

import {v4 as uuidv4} from 'uuid';
import {decodeJwt} from 'jose';
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
   * @returns {Promise<void>}
   * @example
   * const dataSourceClient = new DataSourceClient(httpClient); Create an instance of dataSourceClient by passing instance of HttpClient.
   * Start auto-refresh
   * const { promise, cancel } = dataSourceClient.refreshDataSourceToken('12345', 30); Invoke refreshDataSourceToken method by passing dataSourceId and tokenLifetimeMinutes.
    promise
    .then(() => {
        console.log('Auto-refresh started successfully.');
    })
    .catch((error) => {
      console.error('Failed to start auto-refresh:', error);
    });

    Way to Cancel the auto-refresh if needed
    cancel();
   */

  public async refreshDataSourceToken(
    dataSourceId: string,
    tokenLifetimeMinutes?: number
  ): Promise<{promise: Promise<void>; cancel: () => void}> {
    let rejectPromise: (reason?: any) => void;
    const promise = new Promise<void>(async (resolve, reject) => {
      rejectPromise = reject;

      try {
        if (dataSourceId) {
          const reducedTokenLifetimeMinutes = await this.getReduceTokenLifetimeMinutes(
            tokenLifetimeMinutes || 60
          );
          this.startAutoRefresh(dataSourceId, reducedTokenLifetimeMinutes);
          resolve();
        } else {
          console.log('Required field is missing, Please pass dataSourceId.');
          reject('Required field is missing, Please pass dataSourceId.');
        }
      } catch (error) {
        console.log('Encountered some error, error is', error);
        reject(error);
      }
    });
    const cancel = () => {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
        console.log('Auto-refresh has been cancelled successfully.');
        rejectPromise('Auto-refresh cancelled');
      }
    };

    return {promise, cancel};
  }

  /**
   * This Private method will be used to reduce the tokenLifetimeMinutes between 5% to 10%
   * @param {number} tokenLifetimeMinutes The Life time minutes for the data source. <=1440
   * @returns {number} It returns a reduced token lifetime minutes.
   */

  private async getReduceTokenLifetimeMinutes(tokenLifetimeMinutes: number): Promise<number> {
    // Below logic will generate a random percentage between 5% and 10%
    const randomPercentage = Math.random() * 5 + 5;
    // Then calculate the reducedTokenLifetimeMinutes
    const reducedTokenLifetimeMinutes = tokenLifetimeMinutes * (1 - randomPercentage / 100);

    return reducedTokenLifetimeMinutes;
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
      const payloadForDataSourceUpdateMethod: any = {};
      await this.get(dataSourceId)
        .then((response: any) => {
          const jwsToken: any = response.jwsToken;
          const jwsTokenPayload: any = decodeJwt(jwsToken);
          payloadForDataSourceUpdateMethod.schemaId = response.schemaId;
          payloadForDataSourceUpdateMethod.tokenLifetimeMinutes = tokenLifetimeMinutes;
          payloadForDataSourceUpdateMethod.nonce = nonceGenerator(); // Use the provided nonce generator
          if (jwsTokenPayload) {
            payloadForDataSourceUpdateMethod.url = jwsTokenPayload.com.cisco.datasource.url;
            payloadForDataSourceUpdateMethod.subject = jwsTokenPayload.sub;
            payloadForDataSourceUpdateMethod.audience = jwsTokenPayload.aud;
          } else {
            console.log('jwsTokenPayload is coming as undefined!');
          }
        })
        .catch((error: any) => {
          console.log('error while calling the get method to update the dataSource', error);
        });

      this.timer = setInterval(async () => {
        await this.update(dataSourceId, payloadForDataSourceUpdateMethod)
          .then((response) => {
            console.log('dataSource has been updated successfully!', response);
          })
          .catch((error) => {
            console.log('error while updating the dataSource', error);
          });
        console.log('dataSource has been refreshed successfully');
      }, tokenLifetimeMinutes * 60 * 1000); // Converts minutes to milliseconds.
    } catch (error) {
      console.log('Got error while starting auto refreshing dataSource token', error);
    }
  }
}
