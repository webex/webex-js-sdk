import type {ServiceAppToken} from '../types';
import type {TokenStorageAdapter} from './types';

/**
 * Stores one Service App token pair in memory.
 *
 * @public
 */
export class InMemoryTokenStorageAdapter implements TokenStorageAdapter {
  private token?: ServiceAppToken;

  constructor(token?: ServiceAppToken) {
    this.token = token;
  }

  /** Save or replace the token pair. */
  async setToken(token: ServiceAppToken): Promise<void> {
    this.token = token;
  }

  /** Get the token pair. Reject if no token is stored. */
  async getToken(): Promise<ServiceAppToken> {
    if (!this.token) {
      throw new Error('Service App token not found');
    }

    return this.token;
  }

  /** Delete the token pair. */
  async deleteToken(): Promise<void> {
    if (!this.token) {
      throw new Error('Service App token not found');
    }
    this.token = undefined;
  }
}
