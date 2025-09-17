/**
 * @packageDocumentation
 * @module EntryPointAPI
 */

import {HTTP_METHODS, WebexSDK} from './types';
import LoggerProxy from './logger-proxy';
import WebexRequest from './services/core/WebexRequest';
import PageCache, {
  PaginatedResponse,
  BaseSearchParams,
  PAGINATION_DEFAULTS,
} from './utils/PageCache';

/**
 * Interface for EntryPoint item
 * @public
 */
export interface EntryPoint {
  /** Unique identifier for the entry point */
  id: string;
  /** Display name of the entry point */
  name: string;
  /** Description of the entry point */
  description?: string;
  /** Type of entry point (voice, chat, email, etc.) */
  type: string;
  /** Whether the entry point is active */
  isActive: boolean;
  /** Organization ID this entry point belongs to */
  orgId: string;
  /** Creation timestamp */
  createdAt?: string;
  /** Last modified timestamp */
  updatedAt?: string;
  /** Additional configuration settings */
  settings?: Record<string, any>;
}

/**
 * Interface for paginated EntryPoint response
 * @public
 */
export type EntryPointListResponse = PaginatedResponse<EntryPoint>;

/**
 * Interface for EntryPoint search parameters
 * @public
 */
export type EntryPointSearchParams = BaseSearchParams;

/**
 * EntryPoint API class for managing Webex Contact Center entry points.
 * Provides functionality to fetch, search, and paginate through entry points.
 *
 * @class EntryPointAPI
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
 * // Get EntryPoint API instance from ContactCenter
 * const entryPointAPI = cc.entryPoint;
 *
 * // Get all entry points with pagination
 * const response = await entryPointAPI.getEntryPoints({
 *   page: 0,
 *   pageSize: 50
 * });
 *
 * // Search for specific entry points
 * const searchResults = await entryPointAPI.searchEntryPoints({
 *   search: 'support',
 *   filter: 'type=="voice"'
 * });
 * ```
 */
export class EntryPointAPI {
  private webexRequest: WebexRequest;
  private webex: WebexSDK;

  // Page cache using the common utility
  private pageCache: PageCache<EntryPoint>;

  /**
   * Creates an instance of EntryPointAPI
   * @param {WebexSDK} webex - The Webex SDK instance
   * @public
   */
  constructor(webex: WebexSDK) {
    this.webex = webex;
    this.webexRequest = WebexRequest.getInstance({webex});
    this.pageCache = new PageCache<EntryPoint>('EntryPointAPI');
  }

  /**
   * Fetches entry points for the organization with pagination support
   * @param {EntryPointSearchParams} [params] - Search and pagination parameters
   * @returns {Promise<EntryPointListResponse>} Promise resolving to paginated entry points
   * @throws {Error} If the API call fails
   * @public
   * @example
   * ```typescript
   * // Get first page of entry points
   * const response = await entryPointAPI.getEntryPoints();
   *
   * // Get specific page with custom page size
   * const response = await entryPointAPI.getEntryPoints({
   *   page: 2,
   *   pageSize: 25
   * });
   * ```
   */
  public async getEntryPoints(
    params: EntryPointSearchParams = {}
  ): Promise<EntryPointListResponse> {
    const {
      page = PAGINATION_DEFAULTS.PAGE,
      pageSize = PAGINATION_DEFAULTS.PAGE_SIZE,
      search,
      filter,
      attributes,
      sortBy,
      sortOrder = 'asc',
    } = params;

    const orgId = this.webex.credentials.getOrgId();

    LoggerProxy.info('Fetching entry points', {
      module: 'EntryPointAPI',
      method: 'getEntryPoints',
    });

    // Check if we can use cache for simple pagination (no search/filter/attributes/sort)
    if (this.pageCache.canUseCache({search, filter, attributes, sortBy})) {
      const cacheKey = this.pageCache.buildCacheKey(orgId, page, pageSize);
      const cachedPage = this.pageCache.getCachedPage(cacheKey);

      if (cachedPage) {
        LoggerProxy.log(`Returning page ${page} from cache`, {
          module: 'EntryPointAPI',
          method: 'getEntryPoints',
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

    try {
      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortOrder,
      });

      if (search) queryParams.append('search', search);
      if (filter) queryParams.append('filter', filter);
      if (attributes) queryParams.append('attributes', attributes);
      if (sortBy) queryParams.append('sortBy', sortBy);

      const resource = `/organization/${orgId}/v2/entry-point?${queryParams.toString()}`;

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

      LoggerProxy.log(`Successfully retrieved ${response.body?.data?.length || 0} entry points`, {
        module: 'EntryPointAPI',
        method: 'getEntryPoints',
      });

      // Cache the page data for simple pagination (no search/filter/attributes/sort)
      if (this.pageCache.canUseCache({search, filter, attributes, sortBy}) && response.body?.data) {
        const cacheKey = this.pageCache.buildCacheKey(orgId, page, pageSize);
        this.pageCache.cachePage(cacheKey, response.body.data, response.body.meta);
      }

      return response.body;
    } catch (error) {
      LoggerProxy.error(`Failed to fetch entry points: ${error}`, {
        module: 'EntryPointAPI',
        method: 'getEntryPoints',
      });
      throw error;
    }
  }
}

export default EntryPointAPI;
