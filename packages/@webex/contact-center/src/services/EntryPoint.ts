import {HTTP_METHODS, WebexSDK} from '../types';
import type {EntryPointRecord, EntryPointListResponse, EntryPointSearchParams} from '../types';
import LoggerProxy from '../logger-proxy';
import WebexRequest from './core/WebexRequest';
import {PAGINATION_DEFAULTS} from '../utils/PageCache';
import MetricsManager from '../metrics/MetricsManager';
import {WCC_API_GATEWAY} from './constants';
import {endPointMap} from './config/constants';
import {METRIC_EVENT_NAMES} from '../metrics/constants';

const DEFAULT_ENTRY_POINT_ATTRIBUTES = 'id,dialledNumber,entryPointId,entryPointName';
const DEFAULT_ENTRY_POINT_SORT_FIELD = 'entryPointName';

type DialNumberEntryPointRecord = {
  id: string;
  dialledNumber?: string;
  entryPointId: string;
  entryPointName: string;
};

const escapeCmsSearchFilterValue = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/;/g, '\\;');

const buildEntryPointSearchFilter = (search: string): string =>
  `fields=in=("entryPointName","dialledNumber");value=="${escapeCmsSearchFilterValue(search)}"`;

const mergeEntryPointAttributes = (attributes?: string): string => {
  const mergedAttributes = new Set(DEFAULT_ENTRY_POINT_ATTRIBUTES.split(','));

  attributes
    ?.split(',')
    .map((attribute) => attribute.trim())
    .filter(Boolean)
    .forEach((attribute) => mergedAttributes.add(attribute));

  return Array.from(mergedAttributes).join(',');
};

const mapDialNumberEntryPoint = (item: DialNumberEntryPointRecord): EntryPointRecord => ({
  id: item.entryPointId,
  name: item.entryPointName,
  ...(item.dialledNumber ? {number: item.dialledNumber} : {}),
});

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
 * const searchResults = await entryPointAPI.getEntryPoints({
 *   search: 'support',
 *   filter: 'type=="voice"'
 * });
 * ```
 */
export class EntryPoint {
  private webexRequest: WebexRequest;
  private webex: WebexSDK;
  private metricsManager: MetricsManager;

  /**
   * Creates an instance of EntryPoint
   * @param {WebexSDK} webex - The Webex SDK instance
   * @public
   */
  constructor(webex: WebexSDK) {
    this.webex = webex;
    this.webexRequest = WebexRequest.getInstance({webex});
    this.metricsManager = MetricsManager.getInstance({webex});
  }

  /**
   * Fetches entry-point dial-number mappings for the organization with pagination support. By
   * default, returns the agent's desktop-profile-filtered mappings in backend entry-point-name order.
   * Search, filter, attribute, and sort parameters can customize the request while desktop-profile
   * scoping and required mapping fields remain SDK-owned.
   * @param {EntryPointSearchParams} [params] - Search, pagination, and compatible override parameters.
   * @returns {Promise<EntryPointListResponse>} Promise resolving to paginated entry points
   * @throws {Error} If the API call fails
   * @public
   * @example
   * ```typescript
   * // Get the first page using the default entry-point policy
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
      sortBy = 'name',
      sortOrder = 'asc',
    } = params;

    const orgId = this.webex.credentials.getOrgId();
    const hasCustomSort = sortBy !== 'name' || sortOrder !== 'asc';
    const isSearchRequest = !!(search || filter || attributes || hasCustomSort);
    const effectiveSortBy = sortBy === 'name' ? DEFAULT_ENTRY_POINT_SORT_FIELD : sortBy;

    LoggerProxy.info(
      `Fetching entry points - orgId: ${orgId}, page: ${page}, pageSize: ${pageSize}, isSearchRequest: ${isSearchRequest}`,
      {
        module: 'EntryPoint',
        method: 'getEntryPoints',
      }
    );

    this.metricsManager.timeEvent(METRIC_EVENT_NAMES.ENTRYPOINT_FETCH_SUCCESS);

    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        attributes: mergeEntryPointAttributes(attributes),
      });

      if (search) queryParams.append('search', buildEntryPointSearchFilter(search));
      if (filter) queryParams.append('filter', filter);
      if (effectiveSortBy) {
        queryParams.append('sort', `${effectiveSortBy},${sortOrder.toUpperCase()}`);
      }
      queryParams.append('desktopProfileFilter', 'true');
      queryParams.append('includeEntryPointName', 'true');

      const resource = endPointMap.entryPointDialNumberList(orgId, queryParams.toString());

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
        headers: {
          'X-ORGANIZATION-ID': orgId,
          'x-ignore-internal-data': 'false',
        },
      });

      const responseBody: EntryPointListResponse = {
        ...response.body,
        data: (response.body?.data ?? []).map(mapDialNumberEntryPoint),
      };

      const duration = Date.now() - startTime;

      const recordCount = responseBody.data.length;
      const totalRecords = responseBody.meta?.totalRecords;

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

      return responseBody;
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
