import {TokenStorageAdapter} from './token-storage-adapter/types';
import {LOGGER} from './Logger/types';

export interface LoggerConfig {
  level: LOGGER;
}

/**
 * Configuration options for the SDK.
 *
 * @public
 */
export interface SDKConfig {
  /**
   * The client ID of the service app.
   */
  clientId: string;

  /**
   * The client secret of the service app.
   */
  clientSecret: string;

  /**
   * The token storage adapter passed by the client
   */
  tokenStorageAdapter?: TokenStorageAdapter;

  /**
   * The Logger Config
   */
  logger: LoggerConfig;
}

/**
 * TokenResponse JSON shape from Webex APIs.
 *
 * @public
 */
export interface TokenResponse {
  /**
   * The access token.
   */
  access_token: string;

  /**
   * The expiration time of the access token in seconds.
   */
  expires_in: number;

  /**
   * The refresh token.
   */
  refresh_token: string;

  /**
   * The expiration time of the refresh token in seconds.
   */
  refresh_token_expires_in: number;

  /**
   * The type of the token.
   */
  token_type: string;
}

/**
 * Represents a token with its expiration details.
 *
 * @public
 */
export interface ServiceAppToken {
  /**
   * The access token.
   */
  accessToken: string;

  /**
   * The refresh token.
   */
  refreshToken: string;

  /**
   * The expiration date of the access token.
   */
  expiresAt: Date;

  /**
   * The expiration date of the refresh token.
   */
  refreshAccessTokenExpiresAt: Date;
}

/**
 * Represents a service app authorization token info for an organization.
 *
 * @public
 */
export interface OrgServiceAppAuthorization {
  /**
   * The organization ID.
   */
  orgId: string;

  /**
   * The token details.
   */
  serviceAppToken: ServiceAppToken;
}

/**
 * Represents the result of verifying a JWS token.
 *
 * @public
 */
export interface JWSTokenVerificationResult {
  /**
   * Indicates whether the token is valid.
   */
  isValid: boolean;
  /**
   * The error message if the JWS token is invalid.
   * If the JWS token is valid, this field is not present.
   * If the JWS token is invalid, this field contains the error message.
   */
  error?: string;
}
