/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */
import {WebexPlugin} from '@webex/webex-core';
import LoggerProxy from '../common/logs/logger-proxy';
import {HTTP_VERBS, INTERPRETATION, MEETINGS} from '../constants';

import SILanguageCollection from './collection';

/**
 * @class SimultaneousInterpretation
 */
const SimultaneousInterpretation = WebexPlugin.extend({
  namespace: MEETINGS,
  collections: {
    siLanguages: SILanguageCollection,
  },

  props: {
    locusUrl: 'string', // appears current meeting's locus url
    approvalUrl: 'string', // appears current meeting's approval url for handoff between interpreters
    originalLanguage: 'string', // appears current meeting's original language
    sourceLanguage: 'string', // appears self interpreter's source language
    targetLanguage: 'string', // appears self interpreter's target language
    receiveLanguage: 'string', // appears self's receive language
    order: 'number', // appears the order of self as interpreter
    isActive: 'boolean', // appears self is interpreter and is active
    selfParticipantId: 'string', // appears the self participant id
    canManageInterpreters: 'boolean', // appears the ability to manage interpreters
    supportLanguages: 'array', // appears the support languages
    meetingSIEnabled: 'boolean', // appears the meeting support SI feature
    hostSIEnabled: 'boolean', // appears the meeting host/interpreter feature of SI enabled
    selfIsInterpreter: 'boolean', // current user is interpreter or not
  },
  derived: {
    shouldQuerySupportLanguages: {
      cache: false,
      deps: ['canManageInterpreters', 'hostSIEnabled'],
      /**
       * Returns should query support languages or not
       * @returns {boolean}
       */
      fn() {
        return !!(this.canManageInterpreters && this.hostSIEnabled);
      },
    },
  },
  /**
   * initialize for interpretation
   * @returns {void}
   */
  initialize() {
    this.listenTo(this, 'change:shouldQuerySupportLanguages', () => {
      if (this.canManageInterpreters && !this.supportLanguages) {
        this.querySupportLanguages();
      }
    });
    this.listenToHandoffRequests();
  },

  /**
   * Calls this to clean up listeners
   * @returns {void}
   */
  cleanUp() {
    this.stopListening();
  },
  /**
   * Update the current locus url of the meeting
   * @param {string} locusUrl // locus url
   * @returns {void}
   */
  locusUrlUpdate(locusUrl) {
    this.set('locusUrl', locusUrl);
  },
  /**
   * Update the approval url for handoff
   * @param {string} approvalUrl // approval url
   * @returns {void}
   */
  approvalUrlUpdate(approvalUrl) {
    this.set('approvalUrl', approvalUrl);
  },
  /**
   * Update whether self has capability to manage interpreters (only host can manage it)
   * @param {boolean} canManageInterpreters
   * @returns {void}
   */
  updateCanManageInterpreters(canManageInterpreters) {
    this.set('canManageInterpreters', canManageInterpreters);
  },
  /**
   * Update whether the meeting's host si is enabled or not
   * @param {boolean} hostSIEnabled
   * @returns {void}
   */
  updateHostSIEnabled(hostSIEnabled) {
    this.set('hostSIEnabled', hostSIEnabled);
  },

  /**
   * Update whether the meeting support SI feature or not from meeting info
   * @param {boolean} meetingSIEnabled
   * @param {boolean} selfIsInterpreter
   * @returns {void}
   */
  updateMeetingSIEnabled(meetingSIEnabled: boolean, selfIsInterpreter): void {
    this.set('meetingSIEnabled', meetingSIEnabled);
    this.set('selfIsInterpreter', selfIsInterpreter);
  },

  /**
   * Update the interpretation languages channels which user can choose to subscribe
   * @param {Object} interpretation
   * @returns {void}
   */
  updateInterpretation(interpretation) {
    this.siLanguages.set(interpretation?.siLanguages || []);
  },
  /**
   * Update self's interpretation information (self is interpreter)
   * @param {Object} interpretation
   * @param {String} selfParticipantId
   * @returns {bool} is target language changed
   */
  updateSelfInterpretation({interpretation, selfParticipantId}) {
    const preTargetLanguage = this.targetLanguage;
    const {originalLanguage, sourceLanguage, order, isActive, targetLanguage, receiveLanguage} =
      interpretation || {};
    this.set({originalLanguage, sourceLanguage, order, isActive, targetLanguage, receiveLanguage});
    this.set('selfParticipantId', selfParticipantId);
    this.set('selfIsInterpreter', !!targetLanguage);

    return !!(preTargetLanguage !== targetLanguage);
  },

  /**
   * Get the language code of the interpreter target language
   * @returns {number}
   */
  getTargetLanguageCode() {
    if (this.selfIsInterpreter) {
      return this.siLanguages.get(this.targetLanguage)?.languageCode;
    }

    return 0;
  },

  /**
   * query interpretation languages
   * @returns {Promise}
   */
  querySupportLanguages() {
    return this.request({
      method: HTTP_VERBS.GET,
      uri: `${this.locusUrl}/languages/interpretation`,
    })
      .then((result) => {
        this.set('supportLanguages', result.body?.siLanguages);
        this.trigger(INTERPRETATION.EVENTS.SUPPORT_LANGUAGES_UPDATE);
      })
      .catch((error) => {
        LoggerProxy.logger.error('Meeting:interpretation#querySupportLanguages failed', error);
        throw error;
      });
  },
  /**
   * get interpreters of the meeting
   * @returns {Promise}
   */
  getInterpreters() {
    return this.request({
      method: HTTP_VERBS.GET,
      uri: `${this.locusUrl}/interpretation/interpreters`,
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:interpretation#getInterpreters failed', error);
      throw error;
    });
  },
  /**
   * update interpreters of the meeting
   * @param {Array} interpreters
   * @returns {Promise}
   */
  updateInterpreters(interpreters) {
    return this.request({
      method: HTTP_VERBS.PATCH,
      uri: `${this.locusUrl}/controls`,
      body: {
        interpretation: {
          interpreters,
        },
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:interpretation#updateInterpreters failed', error);
      throw error;
    });
  },
  /**
   * Change direction of interpretation for an interpreter participant
   * @returns {Promise}
   */
  changeDirection() {
    if (!this.sourceLanguage || !this.targetLanguage) {
      return Promise.reject(new Error('Missing sourceLanguage or targetLanguage'));
    }

    if (!this.selfParticipantId) {
      return Promise.reject(new Error('Missing self participant id'));
    }

    return this.request({
      method: HTTP_VERBS.PATCH,
      uri: `${this.locusUrl}/participant/${this.selfParticipantId}/controls`,
      body: {
        interpretation: {
          sourceLanguage: this.targetLanguage,
          targetLanguage: this.sourceLanguage,
          isActive: this.isActive,
          order: this.order,
        },
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:interpretation#changeDirection failed', error);
      throw error;
    });
  },
  /**
   * Sets up a listener for handoff requests from mercury
   * @returns {void}
   */
  listenToHandoffRequests() {
    this.listenTo(this.webex.internal.mercury, 'event:locus.approval_request', (event) => {
      if (event?.data?.approval?.resourceType === INTERPRETATION.RESOURCE_TYPE) {
        const {receivers, initiator, actionType, url} = event.data.approval;
        const receiverId = receivers?.[0]?.participantId;
        const isReceiver = !!receiverId && receiverId === this.selfParticipantId;
        const senderId = initiator?.participantId;
        const isSender = !!senderId && senderId === this.selfParticipantId;
        if (!isReceiver && !isSender) {
          return;
        }
        this.trigger(INTERPRETATION.EVENTS.HANDOFF_REQUESTS_ARRIVED, {
          actionType,
          isReceiver,
          isSender,
          senderId,
          receiverId,
          url,
        });
      }
    });
  },
  /**
   * handoff the active interpreter role to another interpreter in same group, only the interpreter is allowed to call this api
   * @param {string} participantId the participant id you want to hand off
   * @returns {Promise}
   */
  handoffInterpreter(participantId) {
    if (!participantId) {
      return Promise.reject(new Error('Missing target participant id'));
    }
    if (!this.approvalUrl) {
      return Promise.reject(new Error('Missing approval url'));
    }

    return this.request({
      method: HTTP_VERBS.POST,
      uri: this.approvalUrl,
      body: {
        actionType: INTERPRETATION.ACTION_TYPE.OFFERED,
        resourceType: INTERPRETATION.RESOURCE_TYPE,
        receivers: [
          {
            participantId,
          },
        ],
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:interpretation#handoffInterpreter failed', error);
      throw error;
    });
  },
  /**
   * the in-active interpreter request to hand off the active role to self
   * @returns {Promise}
   */
  requestHandoff() {
    if (!this.approvalUrl) {
      return Promise.reject(new Error('Missing approval url'));
    }

    return this.request({
      method: HTTP_VERBS.POST,
      uri: this.approvalUrl,
      body: {
        actionType: INTERPRETATION.ACTION_TYPE.REQUESTED,
        resourceType: INTERPRETATION.RESOURCE_TYPE,
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:interpretation#requestHandoff failed', error);
      throw error;
    });
  },
  /**
   * accept the request of handoff
   * @param {String} url the url get from last approval event
   * @returns {Promise}
   */
  acceptRequest(url) {
    if (!url) {
      return Promise.reject(new Error('Missing the url to accept'));
    }

    return this.request({
      method: HTTP_VERBS.PUT,
      uri: url,
      body: {
        actionType: INTERPRETATION.ACTION_TYPE.ACCEPTED,
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:interpretation#acceptRequest failed', error);
      throw error;
    });
  },
  /**
   * decline the request of handoff
   * @param {String} url the url get from last approval event
   * @returns {Promise}
   */
  declineRequest(url) {
    if (!url) {
      return Promise.reject(new Error('Missing the url to decline'));
    }

    return this.request({
      method: HTTP_VERBS.PUT,
      uri: url,
      body: {
        actionType: INTERPRETATION.ACTION_TYPE.DECLINED,
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:interpretation#declineRequest failed', error);
      throw error;
    });
  },
});

export default SimultaneousInterpretation;
