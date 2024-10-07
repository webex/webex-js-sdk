import {LOGGER} from '../Logger/types';
import {BYODSError} from '../Errors';

export type BYODSErrorEmitterCallback = (err: BYODSError, finalError?: boolean) => void;

/**
 * @ignore
 */
function getLoggingLevel(): LOGGER {
  throw new Error('Function not implemented.');
}
getLoggingLevel();
/**
 * Represents the response from a data source.
 *
 * @public
 */
export interface DataSourceResponse {
  id: string; // The unique identifier for the data source response.
  schemaId: string; // The identifier for the schema associated with the data source.
  orgId: string; // The identifier for the organization associated with the data source.
  applicationId: string; // The plain client identifier (not a Hydra base64 id string).
  status: string; // The status of the data source response. Either "active" or "disabled".
  jwsToken: string; // The JSON Web Signature token associated with the data source response.
  createdBy: string; // The identifier of the user who created the data source response.
  createdAt: string; // The timestamp when the data source response was created.
  updatedBy?: string; // The identifier of the user who last updated the data source response.
  updatedAt?: string; // The timestamp when the data source response was last updated.
  errorMessage?: string; // The error message associated with the data source response, if any.
}

/**
 * Represents the request to a data source.
 *
 * @public
 */
export interface DataSourceRequest {
  schemaId: string; // The identifier for the schema associated with the data source.
  url: string; // The URL of the data source.
  audience: string; // The audience for the data source request.
  subject: string; // The subject of the data source request.
  nonce: string; // A unique nonce for the data source request.
  tokenLifetimeMinutes: number; // The lifetime of the token in minutes.
}
