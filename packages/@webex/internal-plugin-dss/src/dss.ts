/* eslint-disable no-underscore-dangle */
/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */
import { v4 as uuidv4 } from 'uuid';
import {WebexPlugin} from '@webex/webex-core';
import '@webex/internal-plugin-mercury';
import {range, isEqual, get} from 'lodash';
import type {SearchOptions, LookupDetailOptions, LookupOptions, LookupByEmailOptions} from './types';

import {
  DSS_REGISTERED,
  DSS_UNREGISTERED,
  DSS_LOOKUP_MERCURY_EVENT,
  DSS_LOOKUP_RESULT,
  DSS_SERVICE_NAME,
  DSS_SEARCH_MERCURY_EVENT,
  DSS_RESULT,
} from './constants';

const DSS = WebexPlugin.extend({
  namespace: 'DSS',

  /**
   * registered value indicating events registration is successful
   * @instance
   * @type {Boolean}
   * @memberof DSS
   */
  registered: false,

  /**
   * Explicitly sets up the DSS plugin by connecting to mercury, and listening for DSS events.
   * @returns {Promise}
   * @public
   * @memberof DSS
   */
  register() {
    if (!this.webex.canAuthorize) {
      this.logger.error('DSS->register#ERROR, Unable to register, SDK cannot authorize');

      return Promise.reject(new Error('SDK cannot authorize'));
    }

    if (this.registered) {
      this.logger.info('dss->register#INFO, DSS plugin already registered');

      return Promise.resolve();
    }

    return this.webex.internal.mercury.connect()
      .then(() => {
        this.listenForEvents();
        this.trigger(DSS_REGISTERED);
        this.registered = true;
      })
      .catch((error) => {
        this.logger.error(`DSS->register#ERROR, Unable to register, ${error.message}`);

        return Promise.reject(error);
      });
  },

  /**
   * Explicitly tears down the DSS plugin by disconnecting from mercury, and stops listening to DSS events
   * @returns {Promise}
   * @public
   * @memberof DSS
   */
  unregister() {
    if (!this.registered) {
      this.logger.info('DSS->unregister#INFO, DSS plugin already unregistered');

      return Promise.resolve();
    }

    this.stopListeningForEvents();

    return this.webex.internal.mercury.disconnect()
      .then(() => {
        this.trigger(DSS_UNREGISTERED);
        this.registered = false;
      });
  },

  /**
   * registers for DSS events through mercury
   * @returns {undefined}
   * @private
   */
  listenForEvents() {
    this.webex.internal.mercury.on(DSS_LOOKUP_MERCURY_EVENT, (envelope) => {
      this._handleEvent(envelope.data);
    });
    this.webex.internal.mercury.on(DSS_SEARCH_MERCURY_EVENT, (envelope) => {
      this._handleEvent(envelope.data);
    });
  },

  /**
   * unregisteres all the DSS events from mercury
   * @returns {undefined}
   * @private
   */
  stopListeningForEvents() {
    this.webex.internal.mercury.off(DSS_LOOKUP_MERCURY_EVENT);
    this.webex.internal.mercury.off(DSS_SEARCH_MERCURY_EVENT);
  },

  /**
   * @param {UUID} requestId the id of the request
   * @returns {string}
   */
  _getResultEventName(requestId) {
    return `${DSS_RESULT}${requestId}`;
  },

  /**
   * @param {Object} data the event data
   * @returns {undefined}
   */
  _handleEvent(data) {
    this.trigger(this._getResultEventName(data.requestId), data);
    this.trigger(DSS_LOOKUP_RESULT, data);
  },

  /**
    * Makes the request to the directory service
    * @param {Object} options
    * @param {string} options.resource the URL to query
    * @param {string} options.params additional params for the body of the request
    * @param {string} options.dataPath to path to get the data in the result object
    * @returns {Promise} Resolves with an array of entities found
  */
  _request(options) {
    const {resource, params, dataPath} = options;

    const requestId = uuidv4();
    const eventName = this._getResultEventName(requestId);
    const result = {};
    let expectedSeqNums;

    return new Promise((resolve) => {
      this.listenTo(this, eventName, (data) => {
        const resultData = get(data, dataPath);

        result[data.sequence] = resultData;

        if (data.finished) {
          expectedSeqNums = range(data.sequence + 1).map(String);
        }

        const done = isEqual(expectedSeqNums, Object.keys(result));

        if (done) {
          const resultArray = [];
          expectedSeqNums.forEach((index) => {
            const seqResult = result[index];
            if (seqResult) {
              resultArray.push(...seqResult);
            }
          })

          resolve(resultArray);
          this.stopListening(this, eventName);
        }
      });
      this.webex.request({
        service: DSS_SERVICE_NAME,
        resource,
        method: 'POST',
        contentType: 'application/json',
        body: {requestId, ...params}
      });
    });
  },

  /**
   * Retrieves detailed information about an entity
   * @param {Object} options
   * @param {UUID} options.id the id of the entity to lookup
   * @returns {Promise} Resolves with an array of entities found
   */
  lookupDetail(options: LookupDetailOptions) {
    const {id} = options;

    return this._request({
      dataPath: 'lookupResult.entities',
      resource: `/lookup/orgid/${this.webex.internal.device.orgId}/identity/${id}/detail`
    });
  },

  /**
   * Retrieves basic information about a list entities within an organization
   * @param {Object} options
   * @param {UUID} options.ids the id of the entity to lookup
   * @returns {Promise} Resolves with an array of entities found
   */
  lookup(options: LookupOptions) {
    const {ids} = options;

    return this._request({
      dataPath: 'lookupResult.entities',
      resource: `/lookup/orgid/${this.webex.internal.device.orgId}/identities`,
      params: {
        lookupValues: ids,
      }
    });
  },

  /**
   * Retrieves basic information about a list entities within an organization
   * @param {Object} options
   * @param {UUID} options.emails the emails of the entities to lookup
   * @returns {Promise} Resolves with an array of entities found
   */
  lookupByEmail(options: LookupByEmailOptions) {
    const {emails} = options;

    return this._request({
      dataPath: 'lookupResult.entities',
      resource: `/lookup/orgid/${this.webex.internal.device.orgId}/emails`,
      params: {
        lookupValues: emails,
      }
    });
  },

  /**
   * Search for information about entities
   * @param {Object} options
   * @param {SearchType[]} options.requestedTypes an array of search types from: PERSON, CALLING_SERVICE, EXTERNAL_CALLING, ROOM, ROBOT
   * @param {string[]} options.queryString A query string that will be transformed into a Directory search filter query. It is used to search the following fields: username, givenName, familyName, displayName and email
   * @param {number} options.resultSize The maximum number of results returned from each provider
   * @returns {Promise} Resolves with an array of entities found
   */
  search(options: SearchOptions) {
    const {
      requestedTypes, resultSize, queryString
    } = options;

    return this._request({
      dataPath: 'directoryEntities',
      resource: `/search/orgid/${this.webex.internal.device.orgId}/entities`,
      params: {
        queryString,
        resultSize,
        requestedTypes
      }
    });
  }

});

export default DSS;
