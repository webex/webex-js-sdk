/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */
/* eslint-disable no-underscore-dangle */

import {Batcher} from '@webex/webex-core';

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
   * Submits the DSS request
   * @param {Object} payload
   * @returns {Promise<Array>}
   */
  submitHttpRequest(payload) {
    return this.parent._request({
      dataPath: this.dataPath,
      foundPath: this.entitiesFoundPath,
      notFoundPath: this.entitiesNotFoundPath,
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
    const successItems = res.foundArray.map((requestValue, index) => ({requestValue, entity: res.resultArray[index]}));
    const failureItems = res.notFoundArray.map((requestValue) => ({requestValue, entity: null}));

    return Promise.all(successItems.concat(failureItems).map((item) => this.acceptItem(item)));
  },

  /**
   * Checks if the item was found
   * @param {Object} item
   * @returns {Promise<Boolean>}
   */
  didItemFail(item) {
    return Promise.resolve(item.entity === null);
  },

  /**
   * Finds the Defer for the specified item and resolves its promise with null
   * @param {Object} item
   * @returns {Promise<undefined>}
   */
  handleItemFailure(item) {
    return this.getDeferredForResponse(item).then((defer) => {
      defer.resolve(null);
    });
  },

  /**
   * Finds the Defer for the specified item and resolves its promise
   * @param {Object} item
   * @returns {Promise<undefined>}
   */
  handleItemSuccess(item) {
    return this.getDeferredForResponse(item).then((defer) => {
      defer.resolve(item.entity);
    });
  },

  /**
   * Returns a promise with the unique key for the item
   * @param {Object} item
   * @returns {Promise}
   */
  fingerprintRequest(item) {
    return Promise.resolve(item);
  },

  /**
   * Returns a promise with the unique key for the item
   * @param {Object} item
   * @returns {Promise}
   */
  fingerprintResponse(item) {
    return Promise.resolve(item.requestValue);
  },
});

export default DssBatcher;
