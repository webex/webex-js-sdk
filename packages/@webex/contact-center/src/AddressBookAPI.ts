/**
 * @packageDocumentation
 * @module AddressBookAPI
 */

import {HTTP_METHODS, WebexSDK} from './types';
import LoggerProxy from './logger-proxy';
import WebexRequest from './services/core/WebexRequest';

/**
 * Interface for AddressBook entry item based on AddressBookEntryDTO from spec
 * @public
 */
export interface AddressBookEntry {
  /** Unique identifier for the entry */
  id: string;
  /** Organization ID this entry belongs to */
  organizationId?: string;
  /** Version of the entry */
  version?: number;
  /** Name of the entry */
  name: string;
  /** Phone number for the entry */
  number: string;
  /** Creation timestamp in epoch millis */
  createdTime?: number;
  /** Last updated timestamp in epoch millis */
  lastUpdatedTime?: number;
}

/**
 * Interface for paginated AddressBook entries response based on spec
 * @public
 */
export interface AddressBookEntriesResponse {
  /** Array of address book entries */
  data: AddressBookEntry[];
  /** Pagination metadata */
  meta: {
    /** Organization ID */
    orgid?: string;
    /** Current page number */
    page?: number;
    /** Page size for current data set */
    pageSize?: number;
    /** Number of pages */
    totalPages?: number;
    /** Total number of items */
    totalRecords?: number;
    /** Map of pagination links */
    links?: Record<string, string>;
  };
}

/**
 * Interface for AddressBook entry search parameters based on spec
 * @public
 */
export interface AddressBookEntrySearchParams {
  /** Address book ID (optional, uses agent's address book if not provided) */
  addressBookId?: string;
  /** Filter criteria using RSQL syntax */
  filter?: string;
  /** Attributes to be returned */
  attributes?: string;
  /** Search keyword for name and number fields */
  search?: string;
  /** Page number (starts from 0) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
}

/**
 * Default pagination settings
 */
const DEFAULT_PAGE = 0;
const DEFAULT_PAGE_SIZE = 100;

/**
 * AddressBook API class for managing Webex Contact Center address book entries.
 * Provides functionality to fetch address book entries using the entry API.
 *
 * @class AddressBookAPI
 * @public
 * @example
 * ```typescript
 * import Webex from 'webex';
 *
 * const webex = new Webex({ credentials: 'YOUR_ACCESS_TOKEN' });
 * const cc = webex.cc;
 *
 * // Register and login first
 * await cc.register();
 * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
 *
 * // Get AddressBook API instance from ContactCenter
 * const addressBookAPI = cc.addressBook;
 *
 * // Get entries from agent's default address book
 * const entries = await addressBookAPI.getEntries();
 *
 * // Get entries from a specific address book with pagination
 * const entries = await addressBookAPI.getEntries({
 *   addressBookId: 'addressBookId123',
 *   page: 0,
 *   pageSize: 50
 * });
 *
 * // Search for specific entries
 * const searchResults = await addressBookAPI.getEntries({
 *   search: 'john',
 *   filter: 'name=="John Doe"'
 * });
 * ```
 */
export class AddressBookAPI {
  private webexRequest: WebexRequest;
  private webex: WebexSDK;
  private getAddressBookId: () => string;

  /**
   * Creates an instance of AddressBookAPI
   * @param {WebexSDK} webex - The Webex SDK instance
   * @param {() => string} getAddressBookId - Function to get the addressBookId from agent profile
   * @public
   */
  constructor(webex: WebexSDK, getAddressBookId: () => string) {
    this.webex = webex;
    this.webexRequest = WebexRequest.getInstance({webex});
    this.getAddressBookId = getAddressBookId;
  }

  /**
   * Fetches address book entries for a specific address book using the entry API
   * @param {AddressBookEntrySearchParams} [params] - Search and pagination parameters including addressBookId
   * @returns {Promise<AddressBookEntriesResponse>} Promise resolving to address book entries
   * @throws {Error} If the API call fails
   * @public
   * @example
   * ```typescript
   * // Get entries from agent's default address book
   * const response = await addressBookAPI.getEntries();
   *
   * // Get entries from a specific address book with pagination
   * const response = await addressBookAPI.getEntries({
   *   addressBookId: 'addressBookId123',
   *   page: 0,
   *   pageSize: 25
   * });
   * ```
   */
  public async getEntries(
    params: AddressBookEntrySearchParams = {}
  ): Promise<AddressBookEntriesResponse> {
    const {
      addressBookId,
      page = DEFAULT_PAGE,
      pageSize = DEFAULT_PAGE_SIZE,
      search,
      filter,
      attributes,
    } = params;

    // Use provided addressBookId or fall back to agent's address book
    const bookId = addressBookId || this.getAddressBookId();

    LoggerProxy.info('Fetching address book entries', {
      module: 'AddressBookAPI',
      method: 'getEntries',
    });

    try {
      // Build query parameters according to spec
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (filter) queryParams.append('filter', filter);
      if (attributes) queryParams.append('attributes', attributes);
      if (search) queryParams.append('search', search);

      const orgId = this.webex.credentials.getOrgId();
      const resource = `/organization/${orgId}/v2/address-book/${bookId}/entry?${queryParams.toString()}`;

      const response = await this.webexRequest.request({
        service: 'wcc-api-gateway',
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(
          `API call failed with status ${response.statusCode}: ${
            response.body?.error?.message || response.body?.message || 'Unknown error'
          }`
        );
      }

      LoggerProxy.log(
        `Successfully retrieved ${response.body?.data?.length || 0} address book entries`,
        {
          module: 'AddressBookAPI',
          method: 'getEntries',
        }
      );

      return response.body;
    } catch (error) {
      LoggerProxy.error(`Failed to fetch address book entries: ${error}`, {
        module: 'AddressBookAPI',
        method: 'getEntries',
      });
      throw error;
    }
  }
}

export default AddressBookAPI;
