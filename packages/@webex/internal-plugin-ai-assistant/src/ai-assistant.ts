/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */
import uuid from 'uuid';
import {WebexPlugin} from '@webex/webex-core';
import '@webex/internal-plugin-mercury';
import {get, merge} from 'lodash';
import {Timer} from '@webex/common-timers';

import {
  MakeMeetingRequestOptions,
  RequestOptions,
  RequestResponse,
  SummarizeMeetingOptions,
} from './types';
import {
  AI_ASSISTANT_ERROR_CODES,
  AI_ASSISTANT_ERRORS,
  AI_ASSISTANT_REGISTERED,
  AI_ASSISTANT_RESULT,
  AI_ASSISTANT_STREAM,
  AI_ASSISTANT_UNREGISTERED,
  AI_ASSISTANT_SERVICE_NAME,
  ASSISTANT_API_RESPONSE_EVENT,
  ACTION_TYPES,
  CONTENT_TYPES,
  CONTEXT_RESOURCE_TYPES,
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
   * This is used by the plugin to listen for the result of a particular request
   * @param {UUID} requestId the id of the request
   * @returns {string}
   */
  _getResultEventName(requestId: string) {
    return `${AI_ASSISTANT_RESULT}:${requestId}`;
  },

  /**
   * constructs the stream event name based on request id
   * This is used by the consumer to listen for the stream (i.e. the data) of a particular request
   * @param {UUID} requestId the id of the request
   * @returns {string}
   */
  _getStreamEventName(requestId: string) {
    return `${AI_ASSISTANT_STREAM}:${requestId}`;
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
   * Decrypts the encrypted value using the encryption key URL
   * @param {Object} options
   * @param {string} options.value the encrypted value to decrypt
   * @param {string} options.encryptionKeyUrl the encryption key URL to use for
   * @returns {Promise<Object>} returns a promise that resolves with the decrypted value
   */
  async _decryptData({value, encryptionKeyUrl}) {
    const result = await this.webex.internal.encryption.decryptText(encryptionKeyUrl, value);

    return result;
  },

  /**
   * Makes the request to the AI assistant service
   * @param {Object} options
   * @param {string} options.resource the URL to query
   * @param {Mixed} options.params additional params for the body of the request
   * @param {string} options.dataPath the path to get the data in the result object
   * @returns {Promise<Object>} Resolves with an object containing the requestId, sessionId and streamEventName
   */
  _request(options: RequestOptions): Promise<RequestResponse> {
    const {resource, params, dataPath} = options;

    const timeout = this.config.requestTimeout;
    const requestId = uuid.v4();
    const eventName = this._getResultEventName(requestId);
    const streamEventName = this._getStreamEventName(requestId);
    let concatenatedMessage = '';

    // eslint-disable-next-line no-async-promise-executor
    return new Promise((resolve, reject) => {
      const timer = new Timer(() => {
        this.stopListening(this, eventName);
        this.trigger(streamEventName, {
          requestId,
          finished: true,
          errorMessage: AI_ASSISTANT_ERRORS.AI_ASSISTANT_TIMEOUT,
          errorCode: AI_ASSISTANT_ERROR_CODES.AI_ASSISTANT_TIMEOUT,
        });
      }, timeout);

      this.listenTo(this, eventName, async (data) => {
        timer.reset();
        const resultData = get(data, dataPath, []);
        const errorMessage = get(data, 'response.errorMessage');
        const errorCode = get(data, 'response.errorCode');

        if (data.finished) {
          // For finished messages, decrypt and emit the final complete message
          timer.cancel();

          try {
            let decryptedMessage;
            if (resultData?.value) {
              decryptedMessage = await this._decryptData(resultData);
            }

            // Emit the final message with entire response object plus legacy properties
            this.trigger(
              streamEventName,
              merge({}, data.response, {
                message: decryptedMessage || '',
                requestId,
                finished: true,
                errorMessage,
                errorCode,
              })
            );

            this.stopListening(this, eventName);
          } catch (decryptError) {
            this.trigger(
              streamEventName,
              merge({}, data.response, {
                message: concatenatedMessage,
                requestId,
                finished: true,
                errorMessage: errorMessage || decryptError.message,
                errorCode,
              })
            );
          }
        } else {
          // For non-finished messages, concatenate and emit the accumulated message
          try {
            let decryptedMessage = '';
            if (resultData?.value) {
              decryptedMessage = await this._decryptData(resultData);
            }

            concatenatedMessage += decryptedMessage;

            // Emit the concatenated message so far with entire response object plus legacy properties
            this.trigger(
              streamEventName,
              merge({}, data.response, {
                message: concatenatedMessage,
                requestId,
                finished: false,
                errorMessage,
                errorCode,
              })
            );
          } catch (decryptError) {
            // If decryption fails, we still want to continue listening for more messages
            this.trigger(
              streamEventName,
              merge({}, data.response, {
                message: concatenatedMessage,
                requestId,
                finished: false,
                errorMessage: errorMessage || decryptError.message,
                errorCode,
              })
            );
          }
        }
      });

      this.webex
        .request({
          service: AI_ASSISTANT_SERVICE_NAME,
          resource,
          method: 'POST',
          contentType: 'application/json',
          body: {clientRequestId: requestId, ...params},
        })
        .catch((error) => {
          reject(error);
        })
        .then(({body}) => {
          resolve({...body, requestId, streamEventName});
          timer.start();
        });
    });
  },

  /**
   * Common method to make AI assistant requests for meeting analysis
   * @param {Object} options
   * @param {string} options.contextResources array of context resources to include in the request
   * @param {string} options.sessionId the session ID for subsequent requests, not required for the first request
   * @param {string} options.encryptionKeyUrl the encryption key URL for this meeting summary
   * @param {string} options.contentType the type of content ('action' or 'message')
   * @param {string} options.contentValue the value to use (action name or message text)
   * @param {Object} options.parameters optional parameters to include in the request (for action type only)
   * @param {Object} options.assistant optional parameter to specify the assistant to use
   * @param {Object} options.locale optional locale to use for the request, defaults to 'en_US'
   * @returns {Promise<Object>} Resolves with an object containing the requestId, sessionId and streamEventName
   */
  async _makeMeetingRequest(options: MakeMeetingRequestOptions): Promise<RequestResponse> {
    let value = options.contentValue;

    if (options.contentType === 'message') {
      value = await this._encryptData({
        text: options.contentValue,
        encryptionKeyUrl: options.encryptionKeyUrl,
      });
    }

    const content: any = {
      context: {
        resources: options.contextResources,
      },
      encryptionKeyUrl: options.encryptionKeyUrl,
      type: options.contentType,
      value,
    };

    if (options.contentType === 'action' && options.parameters) {
      content.parameters = options.parameters;
    }

    return this._request({
      resource: options.sessionId ? `sessions/${options.sessionId}/messages` : 'sessions/messages',
      dataPath: 'response.content',
      params: {
        async: 'chunked',
        locale: options.locale || 'en_US',
        content,
        ...(options.assistant ? {assistant: options.assistant} : {}),
      },
    });
  },

  /**
   * Returns the summary of a meeting
   * @param {Object} options
   * @param {string} options.meetingInstanceId the meeting instance ID for the meeting from locus
   * @param {string} options.meetingSite the name.webex.com site for the meeting
   * @param {string} options.sessionId the session ID for subsequent requests, not required for the first request
   * @param {string} options.encryptionKeyUrl the encryption key URL for this meeting summary
   * @param {number} options.lastMinutes Optional number of minutes to summarize from the end of the meeting. If not included, summarizes from the start.
   * @returns {Promise<Object>} Resolves with an object containing the requestId, sessionId and streamEventName
   */
  summarizeMeeting(options: SummarizeMeetingOptions): Promise<RequestResponse> {
    return this._makeMeetingRequest({
      ...options,
      contentType: CONTENT_TYPES.ACTION,
      contentValue: ACTION_TYPES.SUMMARIZE_FOR_ME,
      contextResources: [
        {
          id: options.meetingInstanceId,
          type: CONTEXT_RESOURCE_TYPES.MEETING,
          url: options.meetingSite,
        },
      ],
      ...(options.lastMinutes ? {parameters: {lastMinutes: options.lastMinutes}} : {}),
    });
  },

  /**
   * Checks if the user's name was mentioned in a meeting
   * @param {Object} options
   * @param {string} options.meetingInstanceId the meeting instance ID for the meeting from locus
   * @param {string} options.meetingSite the name.webex.com site for the meeting
   * @param {string} options.sessionId the session ID for subsequent requests, not required for the first request
   * @param {string} options.encryptionKeyUrl the encryption key URL for this meeting summary
   * @returns {Promise<Object>} Resolves with an object containing the requestId, sessionId and streamEventName
   */
  wasMyNameMentioned(options: SummarizeMeetingOptions): Promise<RequestResponse> {
    return this._makeMeetingRequest({
      ...options,
      contextResources: [
        {
          id: options.meetingInstanceId,
          type: CONTEXT_RESOURCE_TYPES.MEETING,
          url: options.meetingSite,
        },
      ],
      contentType: CONTENT_TYPES.ACTION,
      contentValue: ACTION_TYPES.WAS_MY_NAME_MENTIONED,
    });
  },

  /**
   * Returns all action items from a meeting
   * @param {Object} options
   * @param {string} options.meetingInstanceId the meeting instance ID for the meeting from locus
   * @param {string} options.meetingSite the name.webex.com site for the meeting
   * @param {string} options.sessionId the session ID for subsequent requests, not required for the first request
   * @param {string} options.encryptionKeyUrl the encryption key URL for this meeting summary
   * @returns {Promise<Object>} Resolves with an object containing the requestId, sessionId and streamEventName
   */
  showAllActionItems(options: SummarizeMeetingOptions): Promise<RequestResponse> {
    return this._makeMeetingRequest({
      ...options,
      contextResources: [
        {
          id: options.meetingInstanceId,
          type: CONTEXT_RESOURCE_TYPES.MEETING,
          url: options.meetingSite,
        },
      ],
      contentType: CONTENT_TYPES.ACTION,
      contentValue: ACTION_TYPES.SHOW_ALL_ACTION_ITEMS,
    });
  },

  /**
   * Helper method to encrypt text using the encryption key URL
   * @param {Object} options
   * @param {string} options.text the text to encrypt
   * @param {string} options.encryptionKeyUrl the encryption key URL to use for encryption
   * @returns {Promise<string>} returns a promise that resolves with the encrypted text
   */
  async _encryptData({text, encryptionKeyUrl}) {
    const result = await this.webex.internal.encryption.encryptText(encryptionKeyUrl, text);

    return result;
  },

  /**
   * Ask any question about the meeting content
   * @param {Object} options
   * @param {string} options.meetingInstanceId the meeting instance ID for the meeting from locus
   * @param {string} options.meetingSite the name.webex.com site for the meeting
   * @param {string} options.sessionId the session ID for subsequent requests, not required for the first request
   * @param {string} options.encryptionKeyUrl the encryption key URL for this meeting summary
   * @param {string} options.question the question to ask about the meeting content
   * @returns {Promise<Object>} Resolves with an object containing the requestId, sessionId and streamEventName
   */
  askMeAnything(options: SummarizeMeetingOptions & {question: string}): Promise<RequestResponse> {
    return this._makeMeetingRequest({
      ...options,
      contextResources: [
        {
          id: options.meetingInstanceId,
          type: CONTEXT_RESOURCE_TYPES.MEETING,
          url: options.meetingSite,
        },
      ],
      contentType: CONTENT_TYPES.MESSAGE,
      contentValue: options.question,
    });
  },
});

export default AIAssistant;
