/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * Base class for configurable Webex services
 * Simple implementation without class-validator decorators to avoid initialization issues
 */
export class WebexConfigurable {
  namespace: string;
  config: any;
  caching: boolean;

  // Internal state storage
  private internalState: Map<string, any> = new Map();

  constructor() {
    this.namespace = '';
    this.config = {};
    this.caching = false;
  }

  /**
   * Sets an internal property
   * @param {string} key - The key for the internal property
   * @param {any} value - The value of the internal property
   * @returns {void}
   */
  setInternal(key: string, value: any) {
    this.internalState.set(key, value);
  }

  /**
   * Gets an internal property
   * @param {string} key - The key for the internal property
   * @returns {any} The value of the internal property
   */
  getInternal(key: string): any {
    return this.internalState.get(key);
  }

  /**
   * Validates the namespace property
   * @returns {boolean} True if valid
   */
  validateNamespace(): boolean {
    return typeof this.namespace === 'string' && this.namespace.length > 0;
  }

  /**
   * Transforms namespace to lowercase
   * @param {string} value - The value to transform
   * @returns {string} Lowercase value
   */
  transformNamespace(value: string): string {
    return value.toLowerCase();
  }
}

/**
 * Represents a Webex API request
 * Simple implementation without decorators to avoid initialization issues
 */
export class WebexRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  shouldAttemptReauth: boolean;

  constructor() {
    this.method = '';
    this.url = '';
    this.headers = {};
    this.shouldAttemptReauth = false;
  }

  /**
   * Transforms method to uppercase
   * @param {string} value - The method value
   * @returns {string} Uppercase method
   */
  transformMethod(value: string): string {
    return value.toUpperCase();
  }

  /**
   * Transforms shouldAttemptReauth to boolean
   * @param {any} value - The value to transform
   * @returns {boolean} Boolean value
   */
  transformShouldAttemptReauth(value: any): boolean {
    return value === 'true' || value === true;
  }

  /**
   * Validates the URL
   * @returns {boolean} True if valid URL
   */
  validateUrl(): boolean {
    try {
      // eslint-disable-next-line no-new
      new URL(this.url);

      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Represents a Webex API response
 */
export class WebexResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;

  constructor() {
    this.statusCode = 0;
    this.headers = {};
    this.body = null;
  }

  /**
   * Checks if the response was successful (2xx status code)
   * @returns {boolean} True if the response was successful
   */
  get isSuccess(): boolean {
    return this.statusCode >= 200 && this.statusCode < 300;
  }
}
