import {
  APPLICATION_ID_PREFIX,
  PRODUCTION_BASE_URL,
  BYODS_TOKEN_MANAGER_MODULE,
  DEFAULT_LOGGER_CONFIG,
} from '../constants';
import {TokenResponse, ServiceAppToken, LoggerConfig, SDKConfig} from '../types';
import {httpUtils} from '../http-utils';
import ExtendedError from '../Errors/catalog/ExtendedError';
import {ERROR_TYPE} from '../Errors/types';
import log from '../Logger';
import {TokenStorageAdapter} from '../token-storage-adapter/types';
import {InMemoryTokenStorageAdapter} from '../token-storage-adapter';

/**
 * The token manager for the BYoDS SDK.
 */
export default class TokenManager {
  private readonly orgId: string;
  private clientId: string;
  private clientSecret: string;
  private serviceAppId: string;
  private baseUrl: string;
  private tokenStorageAdapter: TokenStorageAdapter;
  private loggerConfig: LoggerConfig;

  /**
   * Creates an instance of TokenManager.
   *
   * @param config - The Service App credentials, organization, storage, and logger.
   * @param baseUrl - The base URL for the API. Defaults to `PRODUCTION_BASE_URL`.
   * @example
   * const tokenManager = new TokenManager({clientId, clientSecret, orgId});
   */
  constructor(
    {
      clientId,
      clientSecret,
      orgId,
      tokenStorageAdapter = new InMemoryTokenStorageAdapter(),
      logger = DEFAULT_LOGGER_CONFIG,
    }: SDKConfig,
    baseUrl: string = PRODUCTION_BASE_URL
  ) {
    if (!clientId || !clientSecret) {
      throw new Error('clientId and clientSecret are required');
    }
    if (typeof orgId !== 'string' || !orgId.trim()) {
      throw new Error('orgId is required');
    }
    this.orgId = orgId.trim();
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = baseUrl;
    this.loggerConfig = logger;
    this.serviceAppId = Buffer.from(`${APPLICATION_ID_PREFIX}${clientId}`).toString('base64');
    this.tokenStorageAdapter = tokenStorageAdapter;
    log.setLogger(this.loggerConfig.level, BYODS_TOKEN_MANAGER_MODULE);
  }

  /**
   * Update the tokens and their expiration times.
   * @param {TokenResponse} data - The token response data.
   * @returns {void}
   * @example
   * await tokenManager.updateServiceAppToken(tokenResponse);
   */
  public async updateServiceAppToken(data: TokenResponse): Promise<void> {
    const serviceAppToken: ServiceAppToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000), // Adding 1000 here to represent milliseconds
      refreshAccessTokenExpiresAt: new Date(Date.now() + data.refresh_token_expires_in * 1000), // Adding 1000 here to represent milliseconds
    };
    await this.tokenStorageAdapter.setToken(serviceAppToken);
  }

  /**
   * Get the service app ID.
   * @returns {string}
   * @example
   * const serviceAppId = tokenManager.getServiceAppId();
   */
  public getServiceAppId(): string {
    return this.serviceAppId;
  }

  /**
   * Get the stored Service App token pair. Refresh an expired access token first.
   * @returns {Promise<ServiceAppToken>}
   * @example
   * const authorization = await tokenManager.getServiceAppToken();
   */
  public async getServiceAppToken(): Promise<ServiceAppToken> {
    try {
      let token = await this.tokenStorageAdapter.getToken();
      const currentTime = new Date();
      if (token.expiresAt <= currentTime) {
        await this.saveServiceAppRegistrationData(token.refreshToken);
        token = await this.tokenStorageAdapter.getToken(); // Fetch the refreshed token
      }

      return token;
    } catch (error) {
      log.error(new ExtendedError('Error fetching token', ERROR_TYPE.TOKEN_ERROR), {
        file: BYODS_TOKEN_MANAGER_MODULE,
        method: 'getServiceAppToken',
      });
      throw error;
    }
  }

  /** Delete the stored Service App token pair. */
  public async deleteToken(): Promise<void> {
    await this.tokenStorageAdapter.deleteToken();
  }

  /**
   * Retrieve a new service app token using the service app owner's personal access token(PAT).
   * @param {string} personalAccessToken - The service app owner's personal access token or token from an integration that has the scope `spark:applications_token`.
   * @returns {Promise<void>}
   * await tokenManager.getServiceAppTokenUsingPAT('personal-access-token');
   */
  public async getServiceAppTokenUsingPAT(
    personalAccessToken: string,
    headers: Record<string, string> = {}
  ): Promise<void> {
    try {
      const response = await httpUtils.post<TokenResponse>(`${this.baseUrl}/access_token`, {
        headers: {
          Authorization: `Bearer ${personalAccessToken}`,
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          targetOrgId: this.orgId,
          clientId: this.clientId,
          clientSecret: this.clientSecret,
        }),
      });

      await this.updateServiceAppToken(response.data);
    } catch (error) {
      log.error(
        new ExtendedError('Error retrieving token after authorization', ERROR_TYPE.TOKEN_ERROR),
        {file: BYODS_TOKEN_MANAGER_MODULE, method: 'getServiceAppTokenUsingPAT'}
      );

      throw error;
    }
  }

  /**
   * Refresh the access token using the refresh token.
   * @returns {Promise<void>}
   * await tokenManager.refreshServiceAppAccessToken();
   */
  public async refreshServiceAppAccessToken(headers: Record<string, string> = {}): Promise<void> {
    let token: ServiceAppToken;
    try {
      token = await this.tokenStorageAdapter.getToken();
    } catch (error) {
      log.error(new ExtendedError('Error fetching token', ERROR_TYPE.TOKEN_ERROR), {
        file: BYODS_TOKEN_MANAGER_MODULE,
        method: 'refreshServiceAppAccessToken',
      });
      throw error;
    }
    const refreshToken = token.refreshToken;

    if (!refreshToken) {
      throw new Error('Refresh token was not found');
    }

    await this.saveServiceAppRegistrationData(refreshToken, headers);
  }

  /**
   * Save the service app registration using the provided refresh token.
   * After saving, it can be fetched by using the {@link getServiceAppToken} method.
   * @param {string} refreshToken - The refresh token.
   * @returns {Promise<void>}
   * @example
   * await tokenManager.saveServiceAppRegistrationData('refresh-token');
   */
  public async saveServiceAppRegistrationData(
    refreshToken: string,
    headers: Record<string, string> = {}
  ): Promise<void> {
    try {
      const response = await httpUtils.post<TokenResponse>(`${this.baseUrl}/access_token`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded', // https://developer.webex.com/docs/login-with-webex#access-token-endpoint
          ...headers,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
        }).toString(),
      });

      await this.updateServiceAppToken(response.data);
    } catch (error) {
      log.error(
        new ExtendedError('Error saving service app registration', ERROR_TYPE.REGISTRATION_ERROR),
        {file: BYODS_TOKEN_MANAGER_MODULE, method: 'saveServiceAppRegistration'}
      );

      throw error;
    }
  }
}
