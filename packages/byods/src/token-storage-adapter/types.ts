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
   */
  setToken(orgId: string, token: OrgServiceAppAuthorization): void;

  /**
   * Method to extract a token id based on the organization id.
   * @param orgId Organization
   * @returns {OrgServiceAppAuthorization} The token object for the organization
   */
  getToken(orgId: string): OrgServiceAppAuthorization | undefined;

  /**
   * Method which returns the list of all tokens stored in the TokenStorageAdapter.
   * @returns {OrgServiceAppAuthorization[]} List of tokens
   */
  listTokens(): OrgServiceAppAuthorization[];
}
