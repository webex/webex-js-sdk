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
  private storage: {[orgId: string]: OrgServiceAppAuthorization} = {};

  /**
   * Method to set the token for an organization.
   * @param orgId Organization ID
   * @param token Respective token
   * @example
   * storageAdapter.setToken('org-id', token);
   */
  setToken(orgId: string, token: OrgServiceAppAuthorization): void {
    this.storage[orgId] = token;
  }

  /**
   * Method to extract a token based on the organization id.
   * @param orgId Organization ID
   * @returns {OrgServiceAppAuthorization} The token object for the organization
   * @example
   * const token = storageAdapter.getToken('org-id');
   */
  getToken(orgId: string): OrgServiceAppAuthorization | undefined {
    return this.storage[orgId];
  }

  /**
   * Method which returns the list of all tokens stored in the InMemoryTokenStorageAdapter.
   * @returns {OrgServiceAppAuthorization[]} List of
   * @example
   * const tokens = storageAdapter.listTokens();
   */
  listTokens(): OrgServiceAppAuthorization[] {
    return Object.values(this.storage);
  }
}
