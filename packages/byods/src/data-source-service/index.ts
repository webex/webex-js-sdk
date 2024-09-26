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
   */

  public async refreshDataSourceToken(
    dataSourceId: string,
    tokenLifetimeMinutes?: number
  ): Promise<void> {
    try {
      if (dataSourceId) {
        if (tokenLifetimeMinutes) {
          this.startAutoRefresh(dataSourceId, tokenLifetimeMinutes - 5);
        } else {
          console.log('tokenLifetimeMinutes is not provided, setting up default value');
          tokenLifetimeMinutes = 55;
          this.startAutoRefresh(dataSourceId, tokenLifetimeMinutes);
        }
      } else {
        console.log('Required field is missing, Please pass dataSourceId.');
      }
    } catch (error) {
      console.log('Encountered some error, error is', error);
    }
  }

  /**
   * This Private method will start auto refreshing the DataSource token with interval as tokenLifetimeMinutes.
   * @param {string} dataSourceId The id of data source
   * @param {number} tokenLifetimeMinutes The Life time minutes for the data source. <=1440
   * @returns {Promise<void>}
   */

  private async startAutoRefresh(
    dataSourceId: string,
    tokenLifetimeMinutes?: number
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
          payloadForDataSourceUpdateMethod.nonce = uuidv4();
          payloadForDataSourceUpdateMethod.tokenLifetimeMinutes = tokenLifetimeMinutes;
        })
        .catch((error: any) => {
          console.log('error while calling the get method to update the dataSource', error);
        });

      await this.dataSourceClient
        .update(dataSourceId, payloadForDataSourceUpdateMethod)
        .then((response) => {
          console.log('dataSource has been updated successfully!', response);
        })
        .catch((error) => {
          console.log('error while updating the dataSource', error);
        });
      console.log('dataSource has been refreshed successfully');
    } catch (error) {
      console.log('Got error while starting auto refreshing dataSource token', error);
    }
  }

  /**
   * This method will stop auto refreshing the DataSource token.
   * @returns {void}
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

  // Function to decode a JWS token
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
