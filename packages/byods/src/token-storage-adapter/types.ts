import {OrgServiceAppAuthorization} from '../types';

/**
 * Represents a adapter for storing and retrieving service app authorization tokens.
 *
 * @public
 */
export interface TokenStorageAdapter {
  /**
   * Method to set the token for an organization.
   * @param orgId Organization ID
   * @param token Respective token
   * @example
   * await storageAdapter.setToken('org-id', token);
   */
  setToken(orgId: string, token: OrgServiceAppAuthorization): Promise<void>;

  /**
   * Method to extract a token id based on the organization id.
   * @param orgId Organization
   * @returns {OrgServiceAppAuthorization} The token object for the organization
   * @example
   * const token = await storageAdapter.getToken('org-id');
   */
  getToken(orgId: string): Promise<OrgServiceAppAuthorization>;

  /**
   * Method which returns the list of all tokens stored in the TokenStorageAdapter.
   * @returns {OrgServiceAppAuthorization[]} List of tokens
   * @example
   * const tokens = await storageAdapter.listTokens();
   */
  listTokens(): Promise<OrgServiceAppAuthorization[]>;

  /**
   * Method to delete a token based on the organization id.
   * @param orgId Organization ID
   * @returns {Promise<void>}
   * @example
   * await storageAdapter.deleteToken('org-id');
   */
  deleteToken(orgId: string): Promise<void>;

  /**
   * Method to remove all tokens stored in the TokenStorageAdapter.
   * @returns {Promise<void>}
   * @example
   * await storageAdapter.resetTokens();
   */
  resetTokens(): Promise<void>;
}
