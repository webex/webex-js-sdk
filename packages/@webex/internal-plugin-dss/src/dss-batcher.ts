/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */
/* eslint-disable no-underscore-dangle */

import {Batcher} from '@webex/webex-core';

/**
 * DssBatcher class for handling DSS request batching
 * @class
 * @extends Batcher
 */
class DssBatcher extends Batcher {
  namespace = 'DSS';

  // Properties that would be defined via props in the old extend pattern
  resource!: string;
  dataPath!: string;
  entitiesFoundPath!: string;
  entitiesNotFoundPath!: string;
  requestKey!: string;

  constructor(attrs: any, options?: any) {
    super(attrs, options);

    // Initialize required properties
    if (attrs) {
      this.resource = attrs.resource;
      this.dataPath = attrs.dataPath;
      this.entitiesFoundPath = attrs.entitiesFoundPath;
      this.entitiesNotFoundPath = attrs.entitiesNotFoundPath;
      this.requestKey = attrs.requestKey;
    }
  }

  /**
   * Submits the DSS request
   * @param {unknown} payload - The payload to submit
   * @returns {Promise<any>} Promise resolving to the response
   */
  request(payload: unknown): Promise<any> {
    return (this as any).parent._request({
      dataPath: this.dataPath,
      foundPath: this.entitiesFoundPath,
      notFoundPath: this.entitiesNotFoundPath,
      resource: this.resource,
      params: {
        lookupValues: payload,
      },
    });
  }

  /**
   * Actions taken when the http request returns a success
   * @param {any} res - The response object
   * @returns {Promise<void>} Promise resolving when all items are processed
   */
  handleHttpSuccess(res: any): Promise<void> {
    const successItems = res.foundArray.map((requestValue: any, index: number) => ({
      requestValue,
      entity: res.resultArray[index],
    }));
    const failureItems = res.notFoundArray.map((requestValue: any) => ({
      requestValue,
      entity: null,
    }));

    return Promise.all(
      successItems.concat(failureItems).map((item: any) => (this as any).acceptItem(item))
    ).then(() => {});
  }

  /**
   * Checks if the item was found
   * @param {any} item - The item to check
   * @returns {Promise<boolean>} Promise resolving to failure status
   */
  didItemFail(item: any): Promise<boolean> {
    return Promise.resolve(item.entity === null);
  }

  /**
   * Finds the Defer for the specified item and resolves its promise with null
   * @param {any} item - The item that failed
   * @returns {Promise<void>} Promise resolving when failure is handled
   */
  handleItemFailure(item: any): Promise<void> {
    return (this as any).getDeferredForResponse(item).then((defer: any) => {
      defer.resolve(null);
    });
  }

  /**
   * Finds the Defer for the specified item and resolves its promise
   * @param {any} item - The item that succeeded
   * @returns {Promise<void>} Promise resolving when success is handled
   */
  handleItemSuccess(item: any): Promise<void> {
    return (this as any).getDeferredForResponse(item).then((defer: any) => {
      defer.resolve(item.entity);
    });
  }

  /**
   * Returns a promise with the unique key for the item
   * @param {any} item - The item to fingerprint
   * @returns {Promise<any>} Promise resolving to the fingerprint
   */
  fingerprintRequest(item: any): Promise<any> {
    return Promise.resolve(item);
  }

  /**
   * Returns a promise with the unique key for the item
   * @param {any} item - The item to fingerprint
   * @returns {Promise<any>} Promise resolving to the fingerprint
   */
  fingerprintResponse(item: any): Promise<any> {
    return Promise.resolve(item.requestValue);
  }
}

export default DssBatcher;
