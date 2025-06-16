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

import {AIAssistantTimeoutError} from './ai-assistant-errors';
import {RequestOptions, RequestResult, SummarizeMeetingOptions} from './types';
import {
  AI_ASSISTANT_REGISTERED,
  AI_ASSISTANT_RESULT,
  AI_ASSISTANT_UNREGISTERED,
  AI_ASSITANT_SERVICE_NAME,
  ASSISTANT_API_RESPONSE_EVENT,
} from './constants';

const AIAssistant = WebexPlugin.extend({
  namespace: 'AIAssistant',

  /**
   * registered value indicating events registration is successful
   * @instance
   * @type {Boolean}
   * @memberof AIAssistant
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
   * Explicitly sets up the AI assistant plugin by connecting to mercury, and listening for AI assistant events.
   * @returns {Promise}
   * @public
   * @memberof AIAssistant
   */
  register() {
    if (!this.webex.canAuthorize) {
      this.logger.error('AI assistant->register#ERROR, Unable to register, SDK cannot authorize');

      return Promise.reject(new Error('SDK cannot authorize'));
    }

    if (this.registered) {
      this.logger.info('AI assistant->register#INFO, AI assistant plugin already registered');

      return Promise.resolve();
    }

    return this.webex.internal.mercury
      .connect()
      .then(() => {
        this.listenForEvents();
        this.trigger(AI_ASSISTANT_REGISTERED);
        this.registered = true;
      })
      .catch((error) => {
        this.logger.error(`AI assistant->register#ERROR, Unable to register, ${error.message}`);

        return Promise.reject(error);
      });
  },

  /**
   * Explicitly tears down the AI assistant plugin by disconnecting from mercury, and stops listening to AI assistant events
   * @returns {Promise}
   * @public
   * @memberof AIAssistant
   */
  unregister() {
    if (!this.registered) {
      this.logger.info('AI assistant->unregister#INFO, AI assistant plugin already unregistered');

      return Promise.resolve();
    }

    this.stopListeningForEvents();

    return this.webex.internal.mercury.disconnect().then(() => {
      this.trigger(AI_ASSISTANT_UNREGISTERED);
      this.registered = false;
    });
  },

  /**
   * registers for Assistant API events through mercury
   * @returns {undefined}
   * @private
   */
  listenForEvents() {
    this.webex.internal.mercury.on(ASSISTANT_API_RESPONSE_EVENT, (envelope) => {
      this._handleEvent(envelope.data);
    });
  },

  /**
   * unregisteres all the Assistant API events from mercury
   * @returns {undefined}
   * @private
   */
  stopListeningForEvents() {
    this.webex.internal.mercury.off(ASSISTANT_API_RESPONSE_EVENT);
  },

  /**
   * constructs the event name based on request id
   * @param {UUID} requestId the id of the request
   * @returns {string}
   */
  _getResultEventName(requestId) {
    return `${AI_ASSISTANT_RESULT}${requestId}`;
  },

  /**
   * Takes incoming data and triggers correct events
   * @param {Object} data the event data
   * @returns {undefined}
   */
  _handleEvent(data) {
    this.trigger(this._getResultEventName(data.clientRequestId), data);
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
   * @throws {AIAssistantTimeoutError} when server does not respond in the specified timeframe
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
        reject(new AIAssistantTimeoutError({requestId, timeout, resource, params}));
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
        service: AI_ASSITANT_SERVICE_NAME,
        resource,
        method: 'POST',
        contentType: 'application/json',
        body: {clientRequestId: requestId, ...params},
      });
      timer.start();
    });
  },

  /**
   * Returns the summary of a meeting
   * @param {Object} options
   * @param {string} options.meetingInstanceId the URL to query
   * @param {string} options.meetingSite the URL to query
   * @returns {Promise<RequestResult>} Resolves with an object
   */
  summarizeMeeting(options: SummarizeMeetingOptions): Promise<RequestResult> {
    return this._request({
      async: 'chunked',
      locale: 'en_US',
      content: {
        context: {
          resources: [
            {
              id: options.meetingInstanceId,
              type: 'meeting',
              url: options.meetingSite,
            },
          ],
        },
        parameters: {
          lastMinutes: 15,
        },
        type: 'action',
        value: 'SUMMARIZE_FOR_ME',
      },
    });
  },
});

export default AIAssistant;
