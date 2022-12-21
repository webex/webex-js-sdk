/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */

import {Batcher} from '@webex/webex-core';
import {get} from 'lodash';

/**
 * @class
 */
const DssBatcher = Batcher.extend({
  namespace: 'DSS',

  props: {
    resource: {
      type: 'string',
      required: true,
      setOnce: true,
      allowNull: false,
    },
    requestType: {
      type: 'string',
      required: true,
      setOnce: true,
      allowNull: false,
    },
    dataPath: {
      type: 'string',
      required: true,
      setOnce: true,
      allowNull: false,
    },
    entitiesFoundPath: {
      type: 'string',
      required: true,
      setOnce: true,
      allowNull: false,
    },
    entitiesNotFoundPath: {
      type: 'string',
      required: true,
      setOnce: true,
      allowNull: false,
    },
    requestKey: {
      type: 'string',
      required: true,
      setOnce: true,
      allowNull: false,
    },
  },

  /**
   * @param {Object} payload
   * @returns {Promise<Array>}
   */
  submitHttpRequest(payload) {
    return this.parent._request({
      dataPath: this.dataPath,
      resource: this.resource,
      params: {
        lookupValues: payload,
      },
    });
  },

  /**
   * Actions taken when the http request returns a success
   * @param {Promise<Array>} res
   * @returns {Promise<undefined>}
   */
  handleHttpSuccess(res) {
    const successItems = get(res.data, this.entitiesFoundPath).map((requestValue, index) => {
      return {requestValue, entity: res.resultArray[index]};
    });
    const failureItems = get(res.data, this.entitiesNotFoundPath).map((requestValue) => {
      return {requestValue, entity: null};
    });
    return Promise.all(successItems.concat(failureItems).map((item) => this.acceptItem(item)));
  },

  /**
   * @param {Object} item
   * @returns {Promise<boolean>}
   */
  didItemFail(item) {
    return Promise.resolve(item.entity === null);
  },

  /**
   * Finds the Defer for the specified item and rejects its promise
   * Intended to be overridden
   * @param {Object} item
   * @returns {Promise<undefined>}
   */
  handleItemFailure(item) {
    return this.getDeferredForResponse(item).then((defer) => {
      defer.reject(
        new Error(`DSS entity with ${this.requestType} ${item.requestValue} was not found`)
      );
    });
  },

  /**
   * Finds the Defer for the specified item and resolves its promise
   * Intended to be overridden
   * @param {Object} item
   * @returns {Promise<undefined>}
   */
  handleItemSuccess(item) {
    return this.getDeferredForResponse(item).then((defer) => {
      defer.resolve(item.entity);
    });
  },

  /**
   * @param {Object} item
   * @returns {Promise}
   */
  fingerprintRequest(item) {
    return Promise.resolve(item);
  },

  /**
   * @param {Object} item
   * @returns {Promise}
   */
  fingerprintResponse(item) {
    return Promise.resolve(item.requestValue);
  },
});

export default DssBatcher;
