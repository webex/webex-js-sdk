/* eslint-disable no-underscore-dangle */
/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */
/* eslint-disable no-underscore-dangle */
import uuid from 'uuid';
import {WebexPlugin} from '@webex/webex-core';
import '@webex/internal-plugin-mercury';
import {range, isEqual, get} from 'lodash';

import {Timer} from '@webex/common-timers';
import type {
  SearchOptions,
  LookupDetailOptions,
  LookupOptions,
  LookupByEmailOptions,
  SearchPlaceOptions,
} from './types';
import {
  DSS_REGISTERED,
  DSS_UNREGISTERED,
  DSS_LOOKUP_MERCURY_EVENT,
  DSS_LOOKUP_RESULT,
  DSS_SERVICE_NAME,
  DSS_SEARCH_MERCURY_EVENT,
  DSS_RESULT,
  LOOKUP_DATA_PATH,
  LOOKUP_FOUND_PATH,
  LOOKUP_NOT_FOUND_PATH,
  LOOKUP_REQUEST_KEY,
  SEARCH_DATA_PATH,
} from './constants';
import DssBatcher from './dss-batcher';
import {DssTimeoutError} from './dss-errors';
import {BatcherOptions, RequestOptions, RequestResult} from './types';

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
   * constructs the event name based on request id
   * @param {UUID} requestId the id of the request
   * @returns {string}
   */
  _getResultEventName(requestId) {
    return `${DSS_RESULT}${requestId}`;
  },

  /**
   * Takes incoming data and triggers correct events
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
   * @param {Mixed} options.params additional params for the body of the request
   * @param {string} options.dataPath the path to get the data in the result object
   * @param {string} [options.foundPath] the path to get the lookups of the found data
   * @param {string} [options.notFoundPath] the path to get the lookups of the not found data
   * @returns {Promise<Object>} result Resolves with an object
   * @returns {Array} result.resultArray an array of entities found
   * @returns {Array} result.foundArray an array of the lookups of the found entities (if foundPath provided)
   * @returns {Array} result.notFoundArray an array of the lookups of the not found entities (if notFoundPath provided)
   * @throws {DssTimeoutError} when server does not respond in the specified timeframe
   */
  _request(options: RequestOptions): Promise<RequestResult> {
    const {resource, params, dataPath, foundPath, notFoundPath} = options;

    const timeout = this.config.requestTimeout;
    const requestId = uuid.v4();
    const eventName = this._getResultEventName(requestId);
    const result = {};
    let expectedSeqNums: string[];
    let notFoundArray: unknown[];

    return new Promise((resolve, reject) => {
      const timer = new Timer(() => {
        this.stopListening(this, eventName);
        reject(new DssTimeoutError({requestId, timeout, resource, params}));
      }, timeout);

      this.listenTo(this, eventName, (data) => {
        timer.reset();
        const resultData = get(data, dataPath, []);
        let found;

        if (foundPath) {
          found = get(data, foundPath, []);
        }
        result[data.sequence] = foundPath ? {resultData, found} : {resultData};

        if (data.finished) {
          expectedSeqNums = range(data.sequence + 1).map(String);
          if (notFoundPath) {
            notFoundArray = get(data, notFoundPath, []);
          }
        }

        const done = isEqual(expectedSeqNums, Object.keys(result));

        if (done) {
          timer.cancel();

          const resultArray: any[] = [];
          const foundArray: any[] = [];

          expectedSeqNums.forEach((index) => {
            const seqResult = result[index];

            if (seqResult) {
              resultArray.push(...seqResult.resultData);
              if (foundPath) {
                foundArray.push(...seqResult.found);
              }
            }
          });
          const resolveValue: RequestResult = {
            resultArray,
          };

          if (foundPath) {
            resolveValue.foundArray = foundArray;
          }
          if (notFoundPath) {
            resolveValue.notFoundArray = notFoundArray;
          }
          resolve(resolveValue);
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
      timer.start();
    });
  },

  /**
   * Uses a batcher to make the request to the directory service
   * @param {Object} options
   * @param {string} options.resource the URL to query
   * @param {string} options.value the id or email to lookup
   * @returns {Promise} Resolves with an array of entities found
   * @throws {DssTimeoutError} when server does not respond in the specified timeframe
   */
  _batchedLookup(options: BatcherOptions) {
    const {resource, lookupValue} = options;
    const dataPath = LOOKUP_DATA_PATH;
    const entitiesFoundPath = LOOKUP_FOUND_PATH;
    const entitiesNotFoundPath = LOOKUP_NOT_FOUND_PATH;
    const requestKey = LOOKUP_REQUEST_KEY;

    this.batchers[resource] =
      this.batchers[resource] ||
      new DssBatcher({
        resource,
        dataPath,
        entitiesFoundPath,
        entitiesNotFoundPath,
        requestKey,
        parent: this,
      });

    return this.batchers[resource].request(lookupValue);
  },

  /**
   * Retrieves detailed information about an entity
   * @param {Object} options
   * @param {UUID} options.id the id of the entity to lookup
   * @returns {Promise} Resolves with the entity found or null if not found
   * @throws {DssTimeoutError} when server does not respond in the specified timeframe
   */
  lookupDetail(options: LookupDetailOptions) {
    const {id} = options;

    const resource = `/lookup/orgid/${this.webex.internal.device.orgId}/identity/${id}/detail`;

    return this._request({
      dataPath: LOOKUP_DATA_PATH,
      foundPath: LOOKUP_FOUND_PATH,
      resource,
    }).then(({resultArray, foundArray}) => {
      // TODO: find out what is actually returned!
      if (foundArray[0] === id) {
        return resultArray[0];
      }

      return null;
    });
  },

  /**
   * Retrieves basic information about an entity within an organization
   * @param {Object} options
   * @param {UUID} options.id the id of the entity to lookup
   * @param {UUID} [options.entityProviderType] the provider to query
   * @param {Boolean} options.shouldBatch whether to batch the query, set to false for single immediate result (defaults to true)
   * @returns {Promise} Resolves with the entity found or null if not found
   * @throws {DssTimeoutError} when server does not respond in the specified timeframe
   */
  lookup(options: LookupOptions) {
    const {id, entityProviderType, shouldBatch = true} = options;

    const resource = entityProviderType
      ? `/lookup/orgid/${this.webex.internal.device.orgId}/entityprovidertype/${entityProviderType}`
      : `/lookup/orgid/${this.webex.internal.device.orgId}/identities`;

    if (shouldBatch) {
      return this._batchedLookup({
        resource,
        lookupValue: id,
      });
    }

    return this._request({
      dataPath: LOOKUP_DATA_PATH,
      foundPath: LOOKUP_FOUND_PATH,
      resource,
      params: {
        [LOOKUP_REQUEST_KEY]: [id],
      },
    }).then(({resultArray, foundArray}) => {
      if (foundArray[0] === id) {
        return resultArray[0];
      }

      return null;
    });
  },

  /**
   * Retrieves basic information about an enitity within an organization
   * @param {Object} options
   * @param {UUID} options.email the email of the entity to lookup
   * @returns {Promise} Resolves with the entity found or rejects if not found
   * @throws {DssTimeoutError} when server does not respond in the specified timeframe
   */
  lookupByEmail(options: LookupByEmailOptions) {
    const {email} = options;
    const resource = `/lookup/orgid/${this.webex.internal.device.orgId}/emails`;

    return this._request({
      dataPath: LOOKUP_DATA_PATH,
      foundPath: LOOKUP_FOUND_PATH,
      resource,
      params: {
        [LOOKUP_REQUEST_KEY]: [email],
      },
    }).then(({resultArray, foundArray}) => {
      if (foundArray[0] === email) {
        return resultArray[0];
      }

      return null;
    });
  },

  /**
   * Search for information about entities
   * @param {Object} options
   * @param {SearchType[]} options.requestedTypes an array of search types from: PERSON, CALLING_SERVICE, EXTERNAL_CALLING, ROOM, ROBOT
   * @param {string[]} options.queryString A query string that will be transformed into a Directory search filter query. It is used to search the following fields: username, givenName, familyName, displayName and email
   * @param {number} options.resultSize The maximum number of results returned from each provider
   * @returns {Promise} Resolves with an array of entities found
   * @throws {DssTimeoutError} when server does not respond in the specified timeframe
   */
  search(options: SearchOptions) {
    const {requestedTypes, resultSize, queryString} = options;

    return this._request({
      dataPath: SEARCH_DATA_PATH,
      resource: `/search/orgid/${this.webex.internal.device.orgId}/entities`,
      params: {
        queryString,
        resultSize,
        requestedTypes,
      },
    }).then(({resultArray}) => resultArray);
  },

  /**
   * Search for information about places
   * @param {Object} options
   * @param {string} options.queryString A query string that will be transformed into a Directory search filter query. It is used to search the following fields: placeName, displayName.
   * @param {number} options.resultSize The maximum number of results returned from each provider
   * @returns {Promise} Resolves with an array of entities found
   */
  searchPlaces(options: SearchPlaceOptions) {
    const {resultSize, queryString, isOnlySchedulableRooms} = options;

    return this._request({
      dataPath: 'directoryEntities',
      resource: `/search/orgid/${this.webex.internal.device.orgId}/places`,
      params: {
        queryString,
        resultSize,
        isOnlySchedulableRooms,
      },
    }).catch((error) => {
      this.logger.error(`DSS->search place#ERROR, search place failure, ${error.message}`);

      return Promise.reject(error);
    });
  },
});

export default DSS;
