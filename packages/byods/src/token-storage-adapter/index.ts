import {OrgServiceAppAuthorization} from '../types';
import {TokenStorageAdapter} from './types';

/**
 * An in-memory adapter for storing, listing and retrieving service app authorization tokens.
 *
 * @public
 */
export class InMemoryTokenStorageAdapter implements TokenStorageAdapter {
  /**
   * The local memory cache for the tokens.
   */
  private tokenCache: {[orgId: string]: OrgServiceAppAuthorization};

  constructor(tokenCache: {[orgId: string]: OrgServiceAppAuthorization} = {}) {
    this.tokenCache = tokenCache;
  }

  /**
   * Method to set the token for an organization.
   * @param orgId Organization ID
   * @param token Respective token
   * @example
   * await storageAdapter.setToken('org-id', token);
   */
  async setToken(orgId: string, token: OrgServiceAppAuthorization): Promise<void> {
    this.tokenCache[orgId] = token;
  }

  /**
   * Method to extract a token based on the organization id.
   * @param orgId Organization ID
   * @returns {OrgServiceAppAuthorization} The token object for the organization
   * @example
   * const token = await storageAdapter.getToken('org-id');
   */
  async getToken(orgId: string): Promise<OrgServiceAppAuthorization> {
    if (this.tokenCache[orgId]) {
      return this.tokenCache[orgId];
    }
    throw new Error(`Service App token not found for org ID: ${orgId}`);
  }

  /**
   * Method which returns the list of all tokens stored in the InMemoryTokenStorageAdapter.
   * @returns {OrgServiceAppAuthorization[]} List of
   * @example
   * const tokens = await storageAdapter.listTokens();
   */
  async listTokens(): Promise<OrgServiceAppAuthorization[]> {
    return Object.values(this.tokenCache);
  }

  /**
   * Method to delete a token based on the organization id.
   * @param orgId Organization ID
   * @returns {Promise<void>}
   * @example
   * await storageAdapter.deleteToken('org-id');
   */
  async deleteToken(orgId: string): Promise<void> {
    if (!this.tokenCache[orgId]) {
      throw new Error(`Service App token not found for org ID: ${orgId}`);
    }
    delete this.tokenCache[orgId];
  }

  /**
   * Method to remove all tokens stored in the InMemoryTokenStorageAdapter.
   * @returns {Promise<void>}
   * @example
   * await storageAdapter.resetTokens();
   */
  async resetTokens(): Promise<void> {
    this.tokenCache = {};
  }
}
