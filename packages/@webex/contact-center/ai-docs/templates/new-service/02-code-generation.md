# New Service - Code Generation

> **Purpose**: Generate the service class file with proper patterns.

---

## File Location

Create: `src/services/ServiceName.ts`

---

## Service Class Template

```typescript
import {WebexSDK} from '../types';
import LoggerProxy from '../logger-proxy';

/**
 * Service name and module identifier for logging
 * @private
 */
const SERVICE_FILE = 'ServiceName';

/**
 * Methods enum for consistent logging
 * @private
 */
const METHODS = {
  GET_ITEMS: 'getItems',
  GET_ITEM_BY_ID: 'getItemById',
} as const;

/**
 * API endpoint base
 * @private
 */
const API_ENDPOINT = 'https://api.wxcc-{region}.cisco.com/organization/{orgId}';

// ============ TYPE DEFINITIONS ============

/**
 * Single item in the response
 * @public
 */
export type ServiceItem = {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  // Add more fields based on API response
};

/**
 * Search/filter parameters
 * @public
 */
export type ServiceSearchParams = {
  /** Page number (0-based) */
  page?: number;
  /** Items per page */
  pageSize?: number;
  /** Search term */
  search?: string;
  /** Filter expression */
  filter?: string;
};

/**
 * API response structure
 * @public
 */
export type ServiceListResponse = {
  /** Array of items */
  data: ServiceItem[];
  /** Pagination metadata */
  meta: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalRecords: number;
  };
};

// ============ SERVICE CLASS ============

/**
 * ServiceName provides functionality to fetch and manage [items].
 *
 * @description
 * This service handles:
 * - Fetching paginated list of items
 * - Filtering and searching items
 *
 * @example
 * ```typescript
 * const cc = webex.cc;
 * await cc.register();
 * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
 *
 * // Fetch items
 * const response = await cc.serviceName.getItems({
 *   page: 0,
 *   pageSize: 50
 * });
 * ```
 *
 * @public
 */
export default class ServiceName {
  /**
   * Webex SDK instance for making API requests
   * @private
   */
  private webex: WebexSDK;

  /**
   * Optional: Getter function for dynamic dependency (e.g., from agent profile)
   * @private
   */
  private getDependencyId?: () => string | undefined;

  /**
   * Creates a new ServiceName instance.
   *
   * @param {WebexSDK} webex - The Webex SDK instance
   * @param {Function} [getDependencyId] - Optional getter for dependency ID
   */
  constructor(webex: WebexSDK, getDependencyId?: () => string | undefined) {
    this.webex = webex;
    this.getDependencyId = getDependencyId;
  }

  /**
   * Fetches a paginated list of items.
   *
   * @param {ServiceSearchParams} [params={}] - Search and pagination parameters
   * @returns {Promise<ServiceListResponse>} Paginated list of items
   * @throws {Error} If the request fails
   *
   * @public
   *
   * @example
   * ```typescript
   * // Basic usage
   * const items = await cc.serviceName.getItems();
   *
   * // With pagination
   * const items = await cc.serviceName.getItems({
   *   page: 0,
   *   pageSize: 25
   * });
   *
   * // With search
   * const items = await cc.serviceName.getItems({
   *   search: 'term'
   * });
   * ```
   */
  public async getItems(params: ServiceSearchParams = {}): Promise<ServiceListResponse> {
    LoggerProxy.info('Fetching items', {
      module: SERVICE_FILE,
      method: METHODS.GET_ITEMS,
    });

    try {
      const orgId = this.webex.credentials.getOrgId();
      
      // If service requires dependency from agent profile
      // const dependencyId = this.getDependencyId?.();
      // if (!dependencyId) {
      //   throw new Error('Dependency ID not available. Ensure agent is logged in.');
      // }

      const queryParams = new URLSearchParams();
      if (params.page !== undefined) queryParams.append('page', String(params.page));
      if (params.pageSize !== undefined) queryParams.append('pageSize', String(params.pageSize));
      if (params.search) queryParams.append('search', params.search);
      if (params.filter) queryParams.append('filter', params.filter);

      const queryString = queryParams.toString();
      const url = `${API_ENDPOINT.replace('{orgId}', orgId)}/items${queryString ? `?${queryString}` : ''}`;

      const response = await this.webex.request({
        method: 'GET',
        uri: url,
      });

      LoggerProxy.log('Successfully fetched items', {
        module: SERVICE_FILE,
        method: METHODS.GET_ITEMS,
        data: { count: response.body?.data?.length || 0 },
      });

      return response.body as ServiceListResponse;
    } catch (error) {
      LoggerProxy.error(`Failed to fetch items: ${error}`, {
        module: SERVICE_FILE,
        method: METHODS.GET_ITEMS,
        error,
      });
      throw error;
    }
  }

  /**
   * Fetches a single item by ID.
   *
   * @param {string} itemId - The item ID to fetch
   * @returns {Promise<ServiceItem>} The item details
   * @throws {Error} If the request fails or item not found
   *
   * @public
   */
  public async getItemById(itemId: string): Promise<ServiceItem> {
    LoggerProxy.info(`Fetching item: ${itemId}`, {
      module: SERVICE_FILE,
      method: METHODS.GET_ITEM_BY_ID,
    });

    try {
      const orgId = this.webex.credentials.getOrgId();
      const url = `${API_ENDPOINT.replace('{orgId}', orgId)}/items/${itemId}`;

      const response = await this.webex.request({
        method: 'GET',
        uri: url,
      });

      LoggerProxy.log(`Successfully fetched item: ${itemId}`, {
        module: SERVICE_FILE,
        method: METHODS.GET_ITEM_BY_ID,
      });

      return response.body as ServiceItem;
    } catch (error) {
      LoggerProxy.error(`Failed to fetch item ${itemId}: ${error}`, {
        module: SERVICE_FILE,
        method: METHODS.GET_ITEM_BY_ID,
        error,
      });
      throw error;
    }
  }
}
```

---

## Customization Points

### 1. Dependency Injection
If service needs data from agent profile:

```typescript
constructor(webex: WebexSDK, getProfileData: () => string | undefined) {
  this.webex = webex;
  this.getProfileData = getProfileData;
}
```

### 2. API Endpoint
Replace `API_ENDPOINT` with actual endpoint:

```typescript
const API_ENDPOINT = 'https://api.wxcc-{region}.cisco.com/organization/{orgId}/address-books';
```

### 3. Response Types
Define actual response types based on API documentation.

---

## Next Step

Proceed to: [`03-integration.md`](03-integration.md)
