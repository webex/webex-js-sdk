import {HTTP_METHODS, WebexSDK} from '../types';
import type {
  AddressBookEntry,
  AddressBookEntriesResponse,
  AddressBookEntrySearchParams,
} from '../types';
import LoggerProxy from '../logger-proxy';
import WebexRequest from './core/WebexRequest';
import PageCache, {PAGINATION_DEFAULTS} from '../utils/PageCache';
import MetricsManager from '../metrics/MetricsManager';
import {WCC_API_GATEWAY} from './constants';
import {endPointMap} from './config/constants';
import {METRIC_EVENT_NAMES} from '../metrics/constants';

/**
 * AddressBook API class for managing Webex Contact Center address book entries.
 * Provides functionality to fetch address book entries using the entry API.
 *
 * @class AddressBook
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
 * const searchResults = await addressBook.getEntries({
 *   search: 'john',
 *   filter: 'name=="John Doe"'
 * });
 * ```
 */
export class AddressBook {
  private webexRequest: WebexRequest;
  private webex: WebexSDK;
  private getAddressBookId: () => string;
  private metricsManager: MetricsManager;

  // Page cache using the common utility
  private pageCache: PageCache<AddressBookEntry>;

  /**
   * Creates an instance of AddressBook
   * @param {WebexSDK} webex - The Webex SDK instance
   * @param {() => string} getAddressBookId - Function to get the addressBookId from agent profile
   * @public
   */
  constructor(webex: WebexSDK, getAddressBookId: () => string) {
    this.webex = webex;
    this.webexRequest = WebexRequest.getInstance({webex});
    this.getAddressBookId = getAddressBookId;
    this.pageCache = new PageCache<AddressBookEntry>('AddressBook');
    this.metricsManager = MetricsManager.getInstance({webex});
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
    const startTime = Date.now();
    const {
      addressBookId,
      page = PAGINATION_DEFAULTS.PAGE,
      pageSize = PAGINATION_DEFAULTS.PAGE_SIZE,
      search,
      filter,
      attributes,
    } = params;

    // Use provided addressBookId or fall back to agent's address book
    const bookId = addressBookId || this.getAddressBookId();
    const orgId = this.webex.credentials.getOrgId();
    const isSearchRequest = !!(search || filter || attributes);

    LoggerProxy.info('Fetching address book entries', {
      module: 'AddressBook',
      method: 'getEntries',
      data: {
        orgId,
        bookId,
        page,
        pageSize,
        isSearchRequest,
      },
    });

    // Check if we can use cache for simple pagination (no search/filter/attributes)
    if (this.pageCache.canUseCache({search, filter, attributes})) {
      const cacheKey = this.pageCache.buildCacheKey(bookId, page, pageSize);
      const cachedPage = this.pageCache.getCachedPage(cacheKey);

      if (cachedPage) {
        const duration = Date.now() - startTime;

        LoggerProxy.info(`Returning page ${page} from cache`, {
          module: 'AddressBook',
          method: 'getEntries',
          data: {
            cacheHit: true,
            duration,
            recordCount: cachedPage.data.length,
            page,
            pageSize,
          },
        });

        return {
          data: cachedPage.data,
          meta: {
            page,
            pageSize,
            totalPages: cachedPage.totalMeta?.totalPages,
            totalRecords: cachedPage.totalMeta?.totalRecords,
          },
        };
      }
    }

    // Start timing for the operation
    this.metricsManager.timeEvent(METRIC_EVENT_NAMES.ADDRESSBOOK_FETCH_SUCCESS);

    // Validate address book id early to avoid bad requests
    if (!bookId) {
      const errorData = {
        orgId,
        bookId,
        isSearchRequest,
        page,
        pageSize,
        error: 'Missing addressBookId for agent. Ensure agent profile contains addressBookId.',
      };
      LoggerProxy.error('AddressBook called without a valid addressBookId', {
        module: 'AddressBook',
        method: 'getEntries',
        data: errorData,
      });

      this.metricsManager.trackEvent(METRIC_EVENT_NAMES.ADDRESSBOOK_FETCH_FAILED, errorData, [
        'behavioral',
        'operational',
      ]);

      throw new Error('AddressBook: addressBookId is not available for the current agent.');
    }

    try {
      // Build query parameters according to spec
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (filter) queryParams.append('filter', filter);
      if (attributes) queryParams.append('attributes', attributes);
      if (search) queryParams.append('search', search);

      const resource = endPointMap.addressBookEntries(orgId, bookId, queryParams.toString());

      LoggerProxy.info('Making API request to fetch address book entries', {
        module: 'AddressBook',
        method: 'getEntries',
        data: {
          resource,
          service: WCC_API_GATEWAY,
        },
      });

      const response = await this.webexRequest.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      const duration = Date.now() - startTime;

      const recordCount = response.body?.data?.length || 0;
      const totalRecords = response.body?.meta?.totalRecords;

      LoggerProxy.info(`Successfully retrieved ${recordCount} address book entries`, {
        module: 'AddressBook',
        method: 'getEntries',
        data: {
          statusCode: response.statusCode,
          duration,
          recordCount,
          totalRecords,
          isSearchRequest,
          page,
          pageSize,
        },
      });

      // Only track metrics for search requests or first page loads to reduce metric volume
      if (isSearchRequest || page === 0) {
        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.ADDRESSBOOK_FETCH_SUCCESS,
          {
            orgId,
            bookId,
            statusCode: response.statusCode,
            recordCount,
            totalRecords,
            isSearchRequest,
            isFirstPage: page === 0,
          },
          ['behavioral', 'operational']
        );
      }

      // Cache the page data for simple pagination (no search/filter/attributes)
      if (this.pageCache.canUseCache({search, filter, attributes}) && response.body?.data) {
        const cacheKey = this.pageCache.buildCacheKey(bookId, page, pageSize);
        this.pageCache.cachePage(cacheKey, response.body.data, response.body.meta);

        LoggerProxy.info('Cached address book entries for future requests', {
          module: 'AddressBook',
          method: 'getEntries',
          data: {
            cacheKey,
            recordCount,
          },
        });
      }

      return response.body;
    } catch (error) {
      const errorData = {
        orgId,
        bookId,
        error: error instanceof Error ? error.message : String(error),
        isSearchRequest,
        page,
        pageSize,
      };

      LoggerProxy.error('Failed to fetch address book entries', {
        module: 'AddressBook',
        method: 'getEntries',
        data: errorData,
        error,
      });

      // Track all failures for troubleshooting
      this.metricsManager.trackEvent(METRIC_EVENT_NAMES.ADDRESSBOOK_FETCH_FAILED, errorData, [
        'behavioral',
        'operational',
      ]);

      throw error;
    }
  }
}

export default AddressBook;
