/**
 * @packageDocumentation
 * @module EntryPointAPI
 */

import {HTTP_METHODS, WebexSDK} from './types';
import LoggerProxy from './logger-proxy';
import WebexRequest from './services/core/WebexRequest';

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
export interface EntryPointListResponse {
  /** Array of entry points */
  data: EntryPoint[];
  /** Pagination metadata */
  meta: {
    /** Total number of pages available */
    totalPages: number;
    /** Current page number */
    currentPage: number;
    /** Number of items per page */
    pageSize: number;
    /** Total number of items */
    totalItems: number;
  };
}

/**
 * Interface for EntryPoint search parameters
 * @public
 */
export interface EntryPointSearchParams {
  /** Search query string */
  search?: string;
  /** Filter criteria */
  filter?: string;
  /** Page number (0-based) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Default pagination settings
 */
const DEFAULT_PAGE = 0;
const DEFAULT_PAGE_SIZE = 100;

/**
 * EntryPoint API class for managing Webex Contact Center entry points.
 * Provides functionality to fetch, search, and paginate through entry points.
 *
 * @class EntryPointAPI
 * @public
 * @example
 * ```typescript
 * import Webex from 'webex';
 * import { EntryPointAPI } from '@webex/contact-center';
 *
 * const webex = new Webex({ credentials: 'YOUR_ACCESS_TOKEN' });
 * const entryPointAPI = new EntryPointAPI(webex);
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
 *   filter: 'type eq "voice"'
 * });
 *
 * // Get a specific entry point by ID
 * const entryPoint = await entryPointAPI.getEntryPointById('ep123');
 * ```
 */
export class EntryPointAPI {
  private webexRequest: WebexRequest;
  private webex: WebexSDK;

  /**
   * Creates an instance of EntryPointAPI
   * @param {WebexSDK} webex - The Webex SDK instance
   * @public
   */
  constructor(webex: WebexSDK) {
    this.webex = webex;
    this.webexRequest = WebexRequest.getInstance({webex});
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
      page = DEFAULT_PAGE,
      pageSize = DEFAULT_PAGE_SIZE,
      search,
      filter,
      sortBy,
      sortOrder = 'asc',
    } = params;

    LoggerProxy.info('Fetching entry points', {
      module: 'EntryPointAPI',
      method: 'getEntryPoints',
    });

    try {
      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortOrder,
      });

      if (search) queryParams.append('search', search);
      if (filter) queryParams.append('filter', filter);
      if (sortBy) queryParams.append('sortBy', sortBy);

      const orgId = this.webex.credentials.getOrgId();
      const resource = `/organization/${orgId}/v2/entry-point?${queryParams.toString()}`;

      const response = await this.webexRequest.request({
        service: 'wcc-api-gateway',
        resource,
        method: HTTP_METHODS.GET,
      });

      if (response.statusCode !== 200) {
        throw new Error(
          `API call failed with status ${response.statusCode}: ${
            response.body?.message || 'Unknown error'
          }`
        );
      }

      LoggerProxy.log(`Successfully retrieved ${response.body?.data?.length || 0} entry points`, {
        module: 'EntryPointAPI',
        method: 'getEntryPoints',
      });

      return response.body;
    } catch (error) {
      LoggerProxy.error(`Failed to fetch entry points: ${error}`, {
        module: 'EntryPointAPI',
        method: 'getEntryPoints',
      });
      throw error;
    }
  }

  /**
   * Searches for entry points based on search criteria
   * @param {EntryPointSearchParams} [params] - Search parameters
   * @returns {Promise<EntryPointListResponse>} Promise resolving to matching entry points
   * @throws {Error} If the API call fails
   * @public
   * @example
   * ```typescript
   * // Search by name
   * const results = await entryPointAPI.searchEntryPoints({
   *   search: 'customer support'
   * });
   *
   * // Search with filters
   * const results = await entryPointAPI.searchEntryPoints({
   *   search: 'support',
   *   filter: 'type eq "voice" and isActive eq true',
   *   sortBy: 'name',
   *   sortOrder: 'asc'
   * });
   * ```
   */
  public async searchEntryPoints(
    params: EntryPointSearchParams = {}
  ): Promise<EntryPointListResponse> {
    LoggerProxy.info('Searching entry points', {
      module: 'EntryPointAPI',
      method: 'searchEntryPoints',
    });

    return this.getEntryPoints(params);
  }

  /**
   * Fetches all entry points for an organization across all pages
   * @param {Omit<EntryPointSearchParams, 'page'>} [params] - Search parameters (excluding page)
   * @returns {Promise<EntryPoint[]>} Promise resolving to all entry points
   * @throws {Error} If any API call fails
   * @public
   * @example
   * ```typescript
   * // Get all entry points
   * const allEntryPoints = await entryPointAPI.getAllEntryPoints();
   *
   * // Get all entry points matching search criteria
   * const filteredEntryPoints = await entryPointAPI.getAllEntryPoints({
   *   search: 'support',
   *   filter: 'isActive eq true'
   * });
   * ```
   */
  public async getAllEntryPoints(
    params: Omit<EntryPointSearchParams, 'page'> = {}
  ): Promise<EntryPoint[]> {
    LoggerProxy.info('Fetching all entry points', {
      module: 'EntryPointAPI',
      method: 'getAllEntryPoints',
    });

    try {
      const {pageSize = DEFAULT_PAGE_SIZE, ...searchParams} = params;
      let allEntryPoints: EntryPoint[] = [];
      const currentPage = 0;
      let totalPages = 1;

      // Fetch first page to get total pages
      const firstResponse = await this.getEntryPoints({
        ...searchParams,
        page: currentPage,
        pageSize,
      });

      allEntryPoints = allEntryPoints.concat(firstResponse.data);
      totalPages = firstResponse.meta.totalPages;

      // Fetch remaining pages in parallel
      if (totalPages > 1) {
        const remainingPages = Array.from({length: totalPages - 1}, (_, i) => i + 1);
        const remainingRequests = remainingPages.map((page) =>
          this.getEntryPoints({
            ...searchParams,
            page,
            pageSize,
          })
        );

        const responses = await Promise.all(remainingRequests);
        responses.forEach((response) => {
          allEntryPoints = allEntryPoints.concat(response.data);
        });
      }

      LoggerProxy.log(`Successfully retrieved all ${allEntryPoints.length} entry points`, {
        module: 'EntryPointAPI',
        method: 'getAllEntryPoints',
      });

      return allEntryPoints;
    } catch (error) {
      LoggerProxy.error(`Failed to fetch all entry points: ${error}`, {
        module: 'EntryPointAPI',
        method: 'getAllEntryPoints',
      });
      throw error;
    }
  }
}

export default EntryPointAPI;
