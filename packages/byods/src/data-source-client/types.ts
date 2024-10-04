/**
 * Represents the response from a data source.
 *
 * @public
 */
export interface DataSourceResponse {
  /**
   * The unique identifier for the data source response.
   */
  id: string;

  /**
   * The identifier for the schema associated with the data source.
   */
  schemaId: string;

  /**
   * The identifier for the organization associated with the data source.
   */
  orgId: string;

  /**
   * The plain client identifier (not a Hydra base64 id string).
   */
  applicationId: string;

  /**
   * The status of the data source response. Either "active" or "disabled".
   */
  status: string;

  /**
   * The JSON Web Signature token associated with the data source response.
   */
  jwsToken: string;

  /**
   * The identifier of the user who created the data source response.
   */
  createdBy: string;

  /**
   * The timestamp when the data source response was created.
   */
  createdAt: string;

  /**
   * The identifier of the user who last updated the data source response.
   */
  updatedBy?: string;

  /**
   * The timestamp when the data source response was last updated.
   */
  updatedAt?: string;

  /**
   * The error message associated with the data source response, if any.
   */
  errorMessage?: string;
}

/**
 * Represents the request to a data source.
 *
 * @public
 */
export interface DataSourceRequest {
  /**
   * The identifier for the schema associated with the data source.
   */
  schemaId: string;

  /**
   * The URL of the data source.
   */
  url: string;

  /**
   * The audience for the data source request.
   */
  audience: string;

  /**
   * The subject of the data source request.
   */
  subject: string;

  /**
   * A unique nonce for the data source request.
   */
  nonce: string;

  /**
   * The lifetime of the token in minutes.
   */
  tokenLifetimeMinutes: number;
}
