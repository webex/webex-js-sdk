/**
 * Represents the configuration options for the SDK.
 * @interface SDKConfig
 * @property {string} clientId - The client ID.
 * @property {string} clientSecret - The client secret.
 * @property {string} [baseUrl='https://webexapis.com/v1'] - The base URL for the API requests.
 */
export interface SDKConfig {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
}

/**
 * TokenResponse JSON shape from Webex APIs.
 * @interface
 * @property {string} access_token - The access token.
 * @property {number} expires_in - The expiration time of the access token in seconds.
 * @property {string} refresh_token - The refresh token.
 * @property {number} refresh_token_expires_in - The expiration time of the refresh token in seconds.
 * @property {string} token_type - The type of the token.
 */
export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  token_type: string;
}

/**
 * Represents a token with its expiration details.
 * @interface
 * @property {string} accessToken - The access token.
 * @property {string} refreshToken - The refresh token.
 * @property {Date} expiresAt - The expiration date of the access token.
 * @property {Date} refreshAccessTokenExpiresAt - The expiration date of the refresh token.
 */
export interface Token {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshAccessTokenExpiresAt: Date;
}

/**
 * Represents a service app authorization for an organization.
 * @interface
 * @property {string} orgId - The organization ID.
 * @property {Token} token - The token details.
 */
export interface ServiceAppAuthorization {
  orgId: string;
  token: Token;
}

/**
 * Represents a collection of service app authorizations.
 * @interface
 * @property {string} [orgId: string] - The organization ID mapped to its authorization details.
 */
export interface ServiceAppAuthorizations {
  [orgId: string]: ServiceAppAuthorization;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

/**
 * Interface representing an HTTP client.
 */
export interface HttpClient {
  /**
   * Make a GET request to the specified endpoint.
   * @param {string} endpoint - The endpoint to send the GET request to.
   * @returns {Promise<ApiResponse<T>>} - A promise that resolves to the response data.
   */
  get<T>(endpoint: string): Promise<ApiResponse<T>>;

  /**
   * Make a DELETE request to the specified endpoint.
   * @param {string} endpoint - The endpoint to send the DELETE request to.
   * @returns {Promise<ApiResponse<T>>} - A promise that resolves to the response data.
   */
  delete<T>(endpoint: string): Promise<ApiResponse<T>>;

  /**
   * Make a POST request to the specified endpoint with the given body.
   * @param {string} endpoint - The endpoint to send the POST request to.
   * @param {Record<string, any>} body - The body of the POST request.
   * @returns {Promise<ApiResponse<T>>} - A promise that resolves to the response data.
   */
  post<T>(endpoint: string, body: Record<string, any>): Promise<ApiResponse<T>>;

  /**
   * Make a PUT request to the specified endpoint with the given body.
   * @param {string} endpoint - The endpoint to send the PUT request to.
   * @param {Record<string, any>} body - The body of the PUT request.
   * @returns {Promise<ApiResponse<T>>} - A promise that resolves to the response data.
   */
  put<T>(endpoint: string, body: Record<string, any>): Promise<ApiResponse<T>>;

  /**
   * Make a PATCH request to the specified endpoint with the given body.
   * @param {string} endpoint - The endpoint to send the PATCH request to.
   * @param {Record<string, any>} body - The body of the PATCH request.
   * @returns {Promise<ApiResponse<T>>} - A promise that resolves to the response data.
   */
  patch<T>(endpoint: string, body: Record<string, any>): Promise<ApiResponse<T>>;
}

// Models

/**
 * Represents the response from a data source.
 *
 * @interface DataSourceResponse
 *
 * @property {string} id - The unique identifier for the data source response.
 * @property {string} schemaId - The identifier for the schema associated with the data source.
 * @property {string} orgId - The identifier for the organization associated with the data source.
 * @property {string} applicationId - The plain client identifier (not a Hydra base64 id string).
 * @property {string} status - The status of the data source response. Either "active" or "disabled".
 * @property {string} jwsToken - The JSON Web Signature token associated with the data source response.
 * @property {string} createdBy - The identifier of the user who created the data source response.
 * @property {string} createdAt - The timestamp when the data source response was created.
 * @property {string} [updatedBy] - The identifier of the user who last updated the data source response.
 * @property {string} [updatedAt] - The timestamp when the data source response was last updated.
 * @property {string} [errorMessage] - The error message associated with the data source response, if any.
 */
export interface DataSourceResponse {
  id: string;
  schemaId: string;
  orgId: string;
  applicationId: string; // Plain clientId, not Hydra base64 id string
  status: string;
  jwsToken: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  errorMessage?: string;
}

/**
 * Represents the request to a data source.
 *
 * @interface DataSourceRequest
 *
 * @property {string} schemaId - The identifier for the schema associated with the data source.
 * @property {string} url - The URL of the data source.
 * @property {string} audience - The audience for the data source request.
 * @property {string} subject - The subject of the data source request.
 * @property {string} nonce - A unique nonce for the data source request.
 * @property {number} tokenLifetimeMinutes - The lifetime of the token in minutes.
 */
export interface DataSourceRequest {
  schemaId: string;
  url: string;
  audience: string;
  subject: string;
  nonce: string;
  tokenLifetimeMinutes: number;
}
