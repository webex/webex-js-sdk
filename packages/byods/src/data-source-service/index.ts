/* eslint-disable no-useless-catch */
/* eslint-disable no-console */
/* eslint-disable class-methods-use-this */
/* eslint-disable import/no-extraneous-dependencies */

import {v4 as uuidv4} from 'uuid';
import {decodeJwt, JWTPayload} from 'jose';
import DataSourceClient from '../data-source-client/index';

export default class DataSourceService {
  private dataSourceClient: DataSourceClient;
  private timer: any;

  /**
   * Creates an instance of DataSourceService.
   * @param {DataSourceClient} dataSourceClient - The  dataSourceClient instance to use for DataSourceService.
   * @example
   * const dataSourceService = new DataSourceService(dataSourceClient);
   */

  constructor(dataSourceClient: DataSourceClient) {
    this.dataSourceClient = dataSourceClient;
  }

  /**
   * This method refreshes the DataSource token using dataSourceId and tokenLifetimeMinute
   * @param {string} dataSourceId The id of data source
   * @param {number} tokenLifetimeMinutes The Life time minutes for the data source. <=1440
   * @returns {Promise<void>}
   * @example
   * const dataSourceService = new DataSourceService(dataSourceClient); Create an instance of dataSourceService by passing instance of dataSourceClient.
   * dataSourceService.refreshDataSourceToken(12345, 60); Invoke refreshDataSourceToken method by invoking dataSourceId and tokenLifetimeMinutes.
   */

  public async refreshDataSourceToken(
    dataSourceId: string,
    tokenLifetimeMinutes?: number
  ): Promise<void> {
    try {
      if (dataSourceId) {
        if (tokenLifetimeMinutes) {
          const reducedTokenLifetimeMinutes = await this.getReduceTokenLifetimeMinutes(
            tokenLifetimeMinutes
          );
          this.startAutoRefresh(dataSourceId, reducedTokenLifetimeMinutes);
        } else {
          console.log('tokenLifetimeMinutes is not provided, setting up default value');
          const reducedTokenLifetimeMinutes = await this.getReduceTokenLifetimeMinutes(60);
          this.startAutoRefresh(dataSourceId, reducedTokenLifetimeMinutes);
        }
      } else {
        console.log('Required field is missing, Please pass dataSourceId.');
      }
    } catch (error) {
      console.log('Encountered some error, error is', error);
    }
  }

  /**
   * This Private method will be used to reduce the tokenLifetimeMinutes from 5% to 10%
   * @param {number} tokenLifetimeMinutes The Life time minutes for the data source. <=1440
   * @returns {number} It returns a reduced token lifetime minutes.
   * @example
   */

  private async getReduceTokenLifetimeMinutes(tokenLifetimeMinutes: number): Promise<number> {
    // Below code will generate a random percentage between 5% and 10%
    const randomPercentage = Math.random() * (10 - 5) + 7;
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
      await this.dataSourceClient
        .get(dataSourceId)
        .then((response: any) => {
          const jwsToken: any = response.jwsToken;
          const jwsTokenPayload: any = this.decodeJWSTokenAndGetPayload(jwsToken);
          payloadForDataSourceUpdateMethod.schemaId = response.schemaId;
          payloadForDataSourceUpdateMethod.url = jwsTokenPayload.payload.com.cisco.datasource.url;
          payloadForDataSourceUpdateMethod.subject = jwsTokenPayload.payload.sub;
          payloadForDataSourceUpdateMethod.audience = jwsTokenPayload.payload.aud;
          payloadForDataSourceUpdateMethod.nonce = nonceGenerator(); // Use the provided nonce generator
          payloadForDataSourceUpdateMethod.tokenLifetimeMinutes = tokenLifetimeMinutes;
        })
        .catch((error: any) => {
          console.log('error while calling the get method to update the dataSource', error);
        });
      setInterval(async () => {
        await this.dataSourceClient
          .update(dataSourceId, payloadForDataSourceUpdateMethod)
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

  /**
   * This method will stop auto refreshing the DataSource token.
   * @returns {void}
   * @example
   * const dataSourceService = new DataSourceService(dataSourceClient); Create an instance of DataSourceService class.
   * dataSourceService.stopAutoRefresh(); call the stopAutoRefresh method to stop refreshing the dataSource token.
   */

  public stopAutoRefresh(): void {
    if (this.timer) {
      clearInterval(this.timer);
      console.log('timer has been cleared successfully.');
    } else {
      console.info('timer has not started yet!');
    }
  }

  /**
   * This Private method decodes the JWS token that accepts the parameter which is a token.
   * @param {string} token A JWS token
   * @returns {Promise<JWTPayload>} This method return a promise which eventually resolved to decoded payload.
   */

  private async decodeJWSTokenAndGetPayload(token: string): Promise<{payload: JWTPayload} | null> {
    try {
      // Decode the token
      const decoded = decodeJwt(token);

      // Return the decoded payload
      return {
        payload: decoded.payload as JWTPayload,
      };
    } catch (error) {
      console.log('Error occurred while decoding JWS token:', error);

      return null;
    }
  }
}
