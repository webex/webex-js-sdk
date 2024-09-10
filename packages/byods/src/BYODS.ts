import {LocalStream} from '@webex/media-helpers'; // Just to show that you can import other packages from the workspace
/* eslint-disable no-console */
import fetch from 'node-fetch';

interface SDKConfig {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

class BYODS {
  private clientId: string;
  private clientSecret: string;
  private tokenHost: string;
  private accessToken: string;
  private refreshToken: string;
  private expiresAt: Date;

  constructor({clientId, clientSecret, accessToken, refreshToken, expiresAt}: SDKConfig) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = expiresAt;
    this.tokenHost = 'https://webexapis.com/v1/access_token';
  }

  public async makeAuthenticatedRequest(endpoint: string): Promise<any> {
    if (new Date() >= new Date(this.expiresAt as Date)) {
      throw new Error('Token has expired');
    }

    // Use this.token.access_token to make authenticated requests
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    return response.json();
  }
}

export default BYODS;
export {SDKConfig, LocalStream};
