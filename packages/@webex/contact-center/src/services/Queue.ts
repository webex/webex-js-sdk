import {HTTP_METHODS, WebexSDK} from '../types';
import type {
  ContactServiceQueue,
  ContactServiceQueuesResponse,
  ContactServiceQueueSearchParams,
} from '../types';
import LoggerProxy from '../logger-proxy';
import WebexRequest from './core/WebexRequest';
import PageCache, {PAGINATION_DEFAULTS} from '../utils/PageCache';
import MetricsManager from '../metrics/MetricsManager';
import {WCC_API_GATEWAY} from './constants';
import {endPointMap} from './config/constants';
import {METRIC_EVENT_NAMES} from '../metrics/constants';
import {METHODS} from '../constants';

/**
 * Queue API class for managing Webex Contact Center contact service queues.
 * Provides functionality to fetch contact service queues using the queue API.
 *
 * @class Queue
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
 * // Get Queue API instance from ContactCenter
 * const queueAPI = cc.queue;
 *
 * // Get all queues
 * const queues = await queueAPI.getQueues();
 *
 * // Get queues with pagination
 * const queues = await queueAPI.getQueues({
 *   page: 0,
 *   pageSize: 50
 * });
 *
 * // Search for specific queues
 * const searchResults = await queueAPI.getQueues({
 *   search: 'support',
 *   filter: 'name=="Support Queue"'
 * });
 * ```
 */
export class Queue {
  private webexRequest: WebexRequest;
  private webex: WebexSDK;
  private metricsManager: MetricsManager;

  // Page cache using the common utility
  private pageCache: PageCache<ContactServiceQueue>;

  /**
   * Creates an instance of Queue
   * @param {WebexSDK} webex - The Webex SDK instance
   * @public
   */
  constructor(webex: WebexSDK) {
    this.webex = webex;
    this.webexRequest = WebexRequest.getInstance({webex});
    this.pageCache = new PageCache<ContactServiceQueue>('Queue');
    this.metricsManager = MetricsManager.getInstance({webex});
  }

  /**
   * Fetches contact service queues for the organization
   * @param {ContactServiceQueueSearchParams} [params] - Search and pagination parameters
   * @returns {Promise<ContactServiceQueuesResponse>} Promise resolving to contact service queues
   * @throws {Error} If the API call fails
   * @public
   * @example
   * ```typescript
   * // Get all queues with default pagination
   * const response = await queueAPI.getQueues();
   *
   * // Get queues with specific pagination
   * const response = await queueAPI.getQueues({
   *   page: 0,
   *   pageSize: 25
   * });
   *
   * // Search for queues
   * const response = await queueAPI.getQueues({
   *   search: 'support',
   *   filter: 'queueType=="INBOUND"'
   * });
   * ```
   */
  public async getQueues(
    params: ContactServiceQueueSearchParams = {}
  ): Promise<ContactServiceQueuesResponse> {
    const startTime = Date.now();
    const {
      page = PAGINATION_DEFAULTS.PAGE,
      pageSize = PAGINATION_DEFAULTS.PAGE_SIZE,
      search,
      filter,
      attributes,
      sortBy,
      sortOrder,
      desktopProfileFilter,
      provisioningView,
      singleObjectResponse,
    } = params;

    const orgId = this.webex.credentials.getOrgId();
    const isSearchRequest = !!(search || filter || attributes || sortBy);

    LoggerProxy.info('Fetching contact service queues', {
      module: 'Queue',
      method: METHODS.GET_QUEUES,
      data: {
        orgId,
        page,
        pageSize,
        isSearchRequest,
      },
    });

    // Check if we can use cache for simple pagination (no search/filter/attributes/sort)
    if (this.pageCache.canUseCache({search, filter, attributes, sortBy})) {
      const cacheKey = this.pageCache.buildCacheKey(orgId, page, pageSize);
      const cachedPage = this.pageCache.getCachedPage(cacheKey);

      if (cachedPage) {
        const duration = Date.now() - startTime;

        LoggerProxy.log(`Returning page ${page} from cache`, {
          module: 'Queue',
          method: 'getQueues',
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
            orgid: orgId,
          },
        };
      }
    }

    // Start timing only for actual API calls (not cache hits)
    this.metricsManager.timeEvent(METRIC_EVENT_NAMES.QUEUE_FETCH_SUCCESS);

    try {
      // Build query parameters according to spec
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (filter) queryParams.append('filter', filter);
      if (attributes) queryParams.append('attributes', attributes);
      if (search) queryParams.append('search', search);
      if (sortBy) queryParams.append('sortBy', sortBy);
      if (sortOrder) queryParams.append('sortOrder', sortOrder);
      if (desktopProfileFilter !== undefined)
        queryParams.append('desktopProfileFilter', desktopProfileFilter.toString());
      if (provisioningView !== undefined)
        queryParams.append('provisioningView', provisioningView.toString());
      if (singleObjectResponse !== undefined)
        queryParams.append('singleObjectResponse', singleObjectResponse.toString());

      const resource = endPointMap.queueList(orgId, queryParams.toString());

      LoggerProxy.log('Making API request to fetch contact service queues', {
        module: 'Queue',
        method: METHODS.GET_QUEUES,
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

      LoggerProxy.log(`Successfully retrieved ${recordCount} contact service queues`, {
        module: 'Queue',
        method: METHODS.GET_QUEUES,
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
          METRIC_EVENT_NAMES.QUEUE_FETCH_SUCCESS,
          {
            orgId,
            statusCode: response.statusCode,
            recordCount,
            totalRecords,
            isSearchRequest,
            isFirstPage: page === 0,
          },
          ['behavioral', 'operational']
        );
      }

      // Cache the page data for simple pagination (no search/filter/attributes/sort)
      if (this.pageCache.canUseCache({search, filter, attributes, sortBy}) && response.body?.data) {
        const cacheKey = this.pageCache.buildCacheKey(orgId, page, pageSize);
        this.pageCache.cachePage(cacheKey, response.body.data, response.body.meta);

        LoggerProxy.log('Cached contact service queues for future requests', {
          module: 'Queue',
          method: METHODS.GET_QUEUES,
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
        error: error instanceof Error ? error.message : String(error),
        isSearchRequest,
        page,
        pageSize,
      };

      LoggerProxy.error('Failed to fetch contact service queues', {
        module: 'Queue',
        method: METHODS.GET_QUEUES,
        data: errorData,
        error,
      });

      // Track all failures for troubleshooting
      this.metricsManager.trackEvent(METRIC_EVENT_NAMES.QUEUE_FETCH_FAILED, errorData, [
        'behavioral',
        'operational',
      ]);

      throw error;
    }
  }
}

export default Queue;
