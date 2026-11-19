import type {ServiceAppToken} from '../types';

/**
 * Stores the Service App token pair for one SDK instance.
 * Use a separate adapter for each instance.
 *
 * @public
 */
export interface TokenStorageAdapter {
  /** Save or replace the token pair. */
  setToken(token: ServiceAppToken): Promise<void>;

  /** Get the token pair. Reject if no token is stored. */
  getToken(): Promise<ServiceAppToken>;

  /** Delete the token pair. */
  deleteToken(): Promise<void>;
}
