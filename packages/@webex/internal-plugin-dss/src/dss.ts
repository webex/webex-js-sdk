/* eslint-disable no-underscore-dangle */
/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */
import uuid from 'uuid';
import {WebexPlugin} from '@webex/webex-core';
import '@webex/internal-plugin-mercury';
import {range, isEqual, get} from 'lodash';
import type {
  SearchOptions,
  LookupDetailOptions,
  LookupOptions,
  LookupByEmailOptions,
  EntityProviderType,
} from './types';

import {
  DSS_REGISTERED,
  DSS_UNREGISTERED,
  DSS_LOOKUP_MERCURY_EVENT,
  DSS_LOOKUP_RESULT,
  DSS_SERVICE_NAME,
  DSS_SEARCH_MERCURY_EVENT,
  DSS_RESULT,
} from './constants';

import DssBatcher from './dss-batcher';

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
   * Initializer
   * @private
   * @param {Object} attrs
   * @param {Object} options
   * @returns {undefined}
   */
  initialize(...args) {
    Reflect.apply(WebexPlugin.prototype.initialize, this, args);
    this.batchers = {};
  },
  
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

    return this.webex.internal.mercury
      .connect()
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

    return this.webex.internal.mercury.disconnect().then(() => {
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
   * @param {string} options.dataPath the path to get the data in the result object
   * @param {string} options.foundPath the path to get the lookups of the found data (optional)
   * @param {string} options.notFoundPath the path to get the lookups of the not found data (optional)
   * @returns {Promise<Object>} result Resolves with an object
   * @returns {Array} result.resultArray an array of entities found
   * @returns {Array} result.foundArray an array of the lookups of the found entities (if foundPath provided)
   * @returns {Array} result.notFoundArray an array of the lookups of the not found entities (if notFoundPath provided)
   */
  _request(options) {
    const {resource, params, dataPath, foundPath, notFoundPath} = options;

    const requestId = uuid.v4();
    const eventName = this._getResultEventName(requestId);
    const result = {};
    let expectedSeqNums;
    let notFoundArray;

    return new Promise((resolve) => {
      this.listenTo(this, eventName, (data) => {
        const resultData = get(data, dataPath);
        let found;
        if (foundPath) {
          found = get(data, foundPath);
        }
        result[data.sequence] = foundPath ? {resultData, found} : {resultData};

        if (data.finished) {
          expectedSeqNums = range(data.sequence + 1).map(String);
          if (notFoundPath) {
            notFoundArray = get(data, notFoundPath);
          }
        }

        const done = isEqual(expectedSeqNums, Object.keys(result));

        if (done) {
          const resultArray = [];
          const foundArray = [];
          expectedSeqNums.forEach((index) => {
            const seqResult = result[index];
            if (seqResult) {
              resultArray.push(...seqResult.resultData);
              if (foundPath) {
                foundArray.push(...seqResult.found)
              }
            }
          });
          const resolveValue = {resultArray}
          if (foundPath) {
            resolveValue['foundArray'] = foundArray;
          }
          if (notFoundPath) {
            resolveValue['notFoundArray'] = notFoundArray;
          }
          resolve(resolveValue)
          this.stopListening(this, eventName);
        }
      });
      this.webex.request({
        service: DSS_SERVICE_NAME,
        resource,
        method: 'POST',
        contentType: 'application/json',
        body: {requestId, ...params},
      });
    });
  },

  /**
   * Uses a batcher to make the request to the directory service
   * @param {Object} options
   * @param {string} options.resource the URL to query
   * @param {string} options.requestType the type of lookup 'id' or 'email' (for error messages)
   * @param {string} options.value the id or email to lookup
   * @returns {Promise} Resolves with an array of entities found
   */
  _batchedLookup(options) {
    const {resource, requestType, lookupValue} = options;
    const dataPath = 'lookupResult.entities';
    const entitiesFoundPath = 'entitiesFound';
    const entitiesNotFoundPath = 'entitiesNotFound';
    const requestKey = 'lookupValues';
    const batcher = (this.batchers[resource] =
      this.batchers[resource] ||
      new DssBatcher({
        resource,
        requestType,
        dataPath,
        entitiesFoundPath,
        entitiesNotFoundPath,
        requestKey,
        parent: this,
      }));
    return batcher.request(lookupValue);
  },

  /**
   * Retrieves detailed information about an entity
   * @param {Object} options
   * @param {UUID} options.id the id of the entity to lookup
   * @returns {Promise} Resolves with the entity found or rejects if not found
   */
  lookupDetail(options: LookupDetailOptions) {
    const {id} = options;

    const resource = `/lookup/orgid/${this.webex.internal.device.orgId}/identity/${id}/detail`;
    const requestType = 'id';

    return this._request({
      dataPath: 'lookupResult.entities',
      foundPath: 'entitiesFound',
      resource,
    }).then(({resultArray, foundArray}) => {
      // TODO: find out what is actually returned!
      if (foundArray[0] === id) {
        return resultArray[0];
      } else {
        return Promise.reject(new Error(`DSS entity with ${requestType} ${id} was not found`));
      }
    });
  },

  /**
   * Retrieves basic information about an entity within an organization
   * @param {Object} options
   * @param {UUID} options.id the id of the entity to lookup
   * @param {UUID} options.entityProviderType the provider to query (optional)
   * @param {Boolean} options.shouldBatch whether to batch the query, set to false for single immediate result (defaults to true)
   * @returns {Promise} Resolves with the entity found or rejects if not found
   */
  lookup(options: LookupOptions) {
    const {id, entityProviderType, shouldBatch = true} = options;

    const resource = entityProviderType
      ? `/lookup/orgid/${this.webex.internal.device.orgId}/entityprovidertype/${entityProviderType}`
      : `/lookup/orgid/${this.webex.internal.device.orgId}/identities`;
    const requestType = 'id';

    if (shouldBatch) {
      return this._batchedLookup({
        resource,
        requestType,
        lookupValue: id,
      });
    }
    return this._request({
      dataPath: 'lookupResult.entities',
      foundPath: 'entitiesFound',
      resource,
      params: {
        lookupValues: [id],
      },
    }).then(({resultArray, foundArray}) => {
      if (foundArray[0] === id) {
        return resultArray[0];
      } else {
        return Promise.reject(new Error(`DSS entity with ${requestType} ${id} was not found`));
      }
    });
  },

  /**
   * Retrieves basic information about an enitity within an organization
   * @param {Object} options
   * @param {UUID} options.email the email of the entity to lookup
   * @returns {Promise} Resolves with the entity found or rejects if not found
   */
  lookupByEmail(options: LookupByEmailOptions) {
    const {email} = options;
    const resource = `/lookup/orgid/${this.webex.internal.device.orgId}/emails`;
    const requestType = 'email';

    return this._request({
      dataPath: 'lookupResult.entities',
      foundPath: 'entitiesFound',
      resource,
      params: {
        lookupValues: [email],
      },
    }).then(({resultArray, foundArray}) => {
      if (foundArray[0] === email) {
        return resultArray[0];
      } else {
        return Promise.reject(new Error(`DSS entity with ${requestType} ${email} was not found`));
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
    const {requestedTypes, resultSize, queryString} = options;

    return this._request({
      dataPath: 'directoryEntities',
      resource: `/search/orgid/${this.webex.internal.device.orgId}/entities`,
      params: {
        queryString,
        resultSize,
        requestedTypes,
      },
    }).then(({resultArray}) => {
      return resultArray;
    });
  },
});

export default DSS;
