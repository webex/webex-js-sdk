import {HTTP_METHODS, WebexSDK} from '../types';
import type {EntryPointRecord, EntryPointListResponse, EntryPointSearchParams} from '../types';
import LoggerProxy from '../logger-proxy';
import WebexRequest from './core/WebexRequest';
import PageCache, {PAGINATION_DEFAULTS} from '../utils/PageCache';
import MetricsManager from '../metrics/MetricsManager';
import {WCC_API_GATEWAY} from './constants';
import {endPointMap} from './config/constants';
import {METRIC_EVENT_NAMES} from '../metrics/constants';

/**
 * EntryPoint class for managing Webex Contact Center entry points.
 * Provides functionality to fetch, search, and paginate through entry points.
 *
 * @class EntryPoint
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
export class EntryPoint {
  private webexRequest: WebexRequest;
  private webex: WebexSDK;
  private metricsManager: MetricsManager;

  // Page cache using the common utility
  private pageCache: PageCache<EntryPointRecord>;

  /**
   * Creates an instance of EntryPoint
   * @param {WebexSDK} webex - The Webex SDK instance
   * @public
   */
  constructor(webex: WebexSDK) {
    this.webex = webex;
    this.webexRequest = WebexRequest.getInstance({webex});
    this.pageCache = new PageCache<EntryPointRecord>('EntryPoint');
    this.metricsManager = MetricsManager.getInstance({webex});
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
    const startTime = Date.now();
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
    const isSearchRequest = !!(search || filter || attributes || sortBy);

    LoggerProxy.info(
      `Fetching entry points - orgId: ${orgId}, page: ${page}, pageSize: ${pageSize}, isSearchRequest: ${isSearchRequest}`,
      {
        module: 'EntryPoint',
        method: 'getEntryPoints',
      }
    );

    // Check if we can use cache for simple pagination (no search/filter/attributes/sort)
    if (this.pageCache.canUseCache({search, filter, attributes, sortBy})) {
      const cacheKey = this.pageCache.buildCacheKey(orgId, page, pageSize);
      const cachedPage = this.pageCache.getCachedPage(cacheKey);

      if (cachedPage) {
        const duration = Date.now() - startTime;

        LoggerProxy.log(
          `Returning page ${page} from cache - cacheHit: true, duration: ${duration}ms, recordCount: ${cachedPage.data.length}, pageSize: ${pageSize}`,
          {
            module: 'EntryPoint',
            method: 'getEntryPoints',
          }
        );

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

    // Start timing only for actual API calls (not cache hits)
    this.metricsManager.timeEvent(METRIC_EVENT_NAMES.ENTRYPOINT_FETCH_SUCCESS);

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

      const resource = endPointMap.entryPointList(orgId, queryParams.toString());

      LoggerProxy.log(
        `Making API request to fetch entry points - resource: ${resource}, service: ${WCC_API_GATEWAY}`,
        {
          module: 'EntryPoint',
          method: 'getEntryPoints',
        }
      );

      const response = await this.webexRequest.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.GET,
      });

      const duration = Date.now() - startTime;

      const recordCount = response.body?.data?.length || 0;
      const totalRecords = response.body?.meta?.totalRecords;

      LoggerProxy.log(`Successfully retrieved ${recordCount} entry points`, {
        module: 'EntryPoint',
        method: 'getEntryPoints',
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
          METRIC_EVENT_NAMES.ENTRYPOINT_FETCH_SUCCESS,
          {
            orgId,
            statusCode: response.statusCode,
            recordCount,
            totalRecords,
            isSearchRequest,
            isFirstPage: page === 0,
          },
          ['behavioral']
        );
      }

      // Cache the page data for simple pagination (no search/filter/attributes/sort)
      if (this.pageCache.canUseCache({search, filter, attributes, sortBy}) && response.body?.data) {
        const cacheKey = this.pageCache.buildCacheKey(orgId, page, pageSize);
        this.pageCache.cachePage(cacheKey, response.body.data, response.body.meta);

        LoggerProxy.log('Cached entry points data for future requests', {
          module: 'EntryPoint',
          method: 'getEntryPoints',
          data: {cacheKey, recordCount},
        });
      }

      return response.body;
    } catch (error) {
      const errorData = {
        orgId,
        error: error instanceof Error ? error.message : String(error),
        isSearchRequest,
        page,
        pageSize,
      };

      LoggerProxy.error(`Failed to fetch entry points`, {
        module: 'EntryPoint',
        method: 'getEntryPoints',
        data: errorData,
        error,
      });

      // Track all failures for troubleshooting
      this.metricsManager.trackEvent(METRIC_EVENT_NAMES.ENTRYPOINT_FETCH_FAILED, errorData, [
        'behavioral',
      ]);

      throw error;
    }
  }
}

export default EntryPoint;
