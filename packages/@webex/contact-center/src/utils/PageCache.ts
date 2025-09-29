import LoggerProxy from '../logger-proxy';

/**
 * Common pagination metadata interface used across all APIs.
 * @public
 * @template T - Additional metadata properties specific to the API
 */
export interface PaginationMeta {
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
  /** Total number of items (alias for compatibility) */
  totalItems?: number;
  /** Current page number (alias for compatibility) */
  currentPage?: number;
  /** Map of pagination links */
  links?: Record<string, string>;
}

/**
 * Common paginated response interface used across all APIs.
 * @public
 * @template T - The type of data items in the response
 */
export interface PaginatedResponse<T> {
  /** Array of data items */
  data: T[];
  /** Pagination metadata */
  meta: PaginationMeta;
}

/**
 * Common search and pagination parameters interface.
 * @public
 */
export interface BaseSearchParams {
  /** Search keyword */
  search?: string;
  /** Filter criteria using RSQL syntax */
  filter?: string;
  /** Attributes to be returned */
  attributes?: string;
  /** Page number (starts from 0) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Default pagination constants used across all APIs.
 * @public
 */
export const PAGINATION_DEFAULTS = {
  /** Default page number */
  PAGE: 0,
  /** Default page size */
  PAGE_SIZE: 100,
} as const;

/**
 * Interface for cached page entry with metadata
 * @public
 */
export interface PageCacheEntry<T> {
  /** Cached data items for this page */
  data: T[];
  /** Timestamp when this page was cached */
  timestamp: number;
  /** Total metadata if available */
  totalMeta?: {
    totalPages?: number;
    totalRecords?: number;
  };
}

/**
 * Interface for cache validation parameters
 * @public
 */
export interface CacheValidationParams {
  /** Search query parameter */
  search?: string;
  /** Filter parameter */
  filter?: string;
  /** Attributes parameter */
  attributes?: string;
  /** Sort by parameter */
  sortBy?: string;
}

/**
 * Default cache TTL in minutes
 */
const DEFAULT_CACHE_TTL_MINUTES = 5;

/**
 * Page cache utility class for managing paginated API response caching.
 * Provides consistent caching behavior across all Contact Center APIs.
 *
 * @class PageCache
 * @public
 * @template T - The type of data items being cached
 * @example
 * ```typescript
 * // Create a cache instance for a specific data type
 * const cache = new PageCache<AddressBookEntry>('AddressBook');
 *
 * // Check if we can use cache (no search/filter parameters)
 * if (cache.canUseCache({ search, filter })) {
 *   const cacheKey = cache.buildCacheKey(orgId, page, pageSize);
 *   const cachedPage = cache.getCachedPage(cacheKey);
 *
 *   if (cachedPage) {
 *     return cachedPage.data;
 *   }
 * }
 *
 * // Cache API response
 * cache.cachePage(cacheKey, responseData, responseMeta);
 * ```
 */
export class PageCache<T> {
  private cache: Map<string, PageCacheEntry<T>> = new Map();
  private apiName: string;

  /**
   * Creates an instance of PageCache
   * @param {string} apiName - Name of the API using this cache (for logging)
   * @public
   */
  constructor(apiName: string) {
    this.apiName = apiName;
  }

  /**
   * Checks if cache can be used for the given parameters.
   * Cache is only used for simple pagination without search/filter/attributes/sort.
   * @param {CacheValidationParams} params - Parameters to validate
   * @returns {boolean} True if cache can be used
   * @public
   */
  public canUseCache(params: CacheValidationParams): boolean {
    const {search, filter, attributes, sortBy} = params;

    return !search && !filter && !attributes && !sortBy;
  }

  /**
   * Builds a cache key for the given parameters
   * @param {string} orgId - Organization ID
   * @param {number} page - Page number
   * @param {number} pageSize - Page size
   * @returns {string} Cache key
   * @public
   */
  public buildCacheKey(orgId: string, page: number, pageSize: number): string {
    return `${orgId}:${page}:${pageSize}`;
  }

  /**
   * Gets a cached page if it exists and is valid
   * @param {string} cacheKey - Cache key to look up
   * @returns {PageCacheEntry<T> | null} Cached page entry or null if not found/expired
   * @public
   */
  public getCachedPage(cacheKey: string): PageCacheEntry<T> | null {
    const cachedEntry = this.cache.get(cacheKey);

    if (!cachedEntry) {
      return null;
    }

    // Check if cache entry is expired
    const now = Date.now();
    const cacheAge = (now - cachedEntry.timestamp) / (1000 * 60); // in minutes

    if (cacheAge >= DEFAULT_CACHE_TTL_MINUTES) {
      LoggerProxy.log(`Cache entry expired for key: ${cacheKey}`, {
        module: this.apiName,
        method: 'getCachedPage',
      });
      this.cache.delete(cacheKey);

      return null;
    }

    return cachedEntry;
  }

  /**
   * Caches a page of data with metadata
   * @param {string} cacheKey - Cache key
   * @param {T[]} data - Data items to cache
   * @param {any} meta - Metadata from API response
   * @public
   */
  public cachePage(cacheKey: string, data: T[], meta?: any): void {
    const cacheEntry: PageCacheEntry<T> = {
      data,
      timestamp: Date.now(),
      totalMeta: meta
        ? {
            totalPages: meta.totalPages,
            totalRecords: meta.totalRecords || meta.totalItems,
          }
        : undefined,
    };

    this.cache.set(cacheKey, cacheEntry);

    LoggerProxy.log(`Cached page with ${data.length} items for key: ${cacheKey}`, {
      module: this.apiName,
      method: 'cachePage',
    });
  }

  /**
   * Clears all cached entries
   * @public
   */
  public clearCache(): void {
    const cacheSize = this.cache.size;
    this.cache.clear();

    LoggerProxy.log(`Cleared ${cacheSize} cache entries`, {
      module: this.apiName,
      method: 'clearCache',
    });
  }

  /**
   * Gets the current number of cached entries
   * @returns {number} Number of cached entries
   * @public
   */
  public getCacheSize(): number {
    return this.cache.size;
  }
}

export default PageCache;
