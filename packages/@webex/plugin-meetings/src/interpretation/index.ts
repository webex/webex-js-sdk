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
class SimultaneousInterpretation extends WebexPlugin {
  namespace = MEETINGS;
  siLanguages: SILanguageCollection;
  locusUrl: string; // appears current meeting's locus url
  approvalUrl: string; // appears current meeting's approval url for handoff between interpreters
  originalLanguage: string; // appears current meeting's original language
  sourceLanguage: string; // appears self interpreter's source language
  targetLanguage: string; // appears self interpreter's target language
  receiveLanguage: string; // appears self's receive language
  order: number; // appears the order of self as interpreter
  isActive: boolean; // appears self is interpreter and is active
  selfParticipantId: string; // appears the self participant id
  canManageInterpreters: boolean; // appears the ability to manage interpreters
  supportLanguages: any[]; // appears the support languages
  meetingSIEnabled: boolean; // appears the meeting support SI feature
  hostSIEnabled: boolean; // appears the meeting host/interpreter feature of SI enabled
  selfIsInterpreter: boolean; // current user is interpreter or not

  /**
   * Returns should query support languages or not
   * @returns {boolean}
   */
  get shouldQuerySupportLanguages() {
    return !!(this.canManageInterpreters && this.hostSIEnabled && this.locusUrl);
  }

  /**
   * initialize for interpretation
   * @returns {void}
   */
  constructor(attrs = {}, options = {}) {
    super(attrs, options);
    this.siLanguages = new SILanguageCollection();
    this.siLanguages.parent = this;
    // @ts-ignore
    this.on('interpretation:change:shouldQuerySupportLanguages', () => {
      if (this.shouldQuerySupportLanguages && !this.supportLanguages) {
        this.querySupportLanguages();
      }
    });
    this.listenToHandoffRequests();
  }

  /**
   * Calls this to clean up listeners
   * @returns {void}
   */
  cleanUp() {
    // @ts-ignore
    this.off('interpretation:change:shouldQuerySupportLanguages');
    // @ts-ignore
    this.webex.internal.mercury.off('event:locus.approval_request');
  }

  /**
   * Update the current locus url of the meeting
   * @param {string} locusUrl // locus url
   * @returns {void}
   */
  locusUrlUpdate(locusUrl) {
    this.locusUrl = locusUrl;
  }

  /**
   * Update the approval url for handoff
   * @param {string} approvalUrl // approval url
   * @returns {void}
   */
  approvalUrlUpdate(approvalUrl) {
    this.approvalUrl = approvalUrl;
  }

  /**
   * Update whether self has capability to manage interpreters (only host can manage it)
   * @param {boolean} canManageInterpreters
   * @returns {void}
   */
  updateCanManageInterpreters(canManageInterpreters) {
    const previousValue = this.canManageInterpreters;
    this.canManageInterpreters = canManageInterpreters;
    if (previousValue !== canManageInterpreters) {
      // @ts-ignore
      this.emit('interpretation:change:shouldQuerySupportLanguages');
    }
  }

  /**
   * Update whether the meeting's host si is enabled or not
   * @param {boolean} hostSIEnabled
   * @returns {void}
   */
  updateHostSIEnabled(hostSIEnabled) {
    const previousValue = this.hostSIEnabled;
    this.hostSIEnabled = hostSIEnabled;
    if (previousValue !== hostSIEnabled) {
      // @ts-ignore
      this.emit('interpretation:change:shouldQuerySupportLanguages');
    }
  }

  /**
   * Update whether the meeting support SI feature or not from meeting info
   * @param {boolean} meetingSIEnabled
   * @param {boolean} selfIsInterpreter
   * @returns {void}
   */
  updateMeetingSIEnabled(meetingSIEnabled: boolean, selfIsInterpreter): void {
    this.meetingSIEnabled = meetingSIEnabled;
    this.selfIsInterpreter = selfIsInterpreter;
  }

  /**
   * Update the interpretation languages channels which user can choose to subscribe
   * @param {Object} interpretation
   * @returns {void}
   */
  updateInterpretation(interpretation) {
    this.siLanguages.reset(interpretation?.siLanguages || []);
  }

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
    this.originalLanguage = originalLanguage;
    this.sourceLanguage = sourceLanguage;
    this.order = order;
    this.isActive = isActive;
    this.targetLanguage = targetLanguage;
    this.receiveLanguage = receiveLanguage;
    this.selfParticipantId = selfParticipantId;
    this.selfIsInterpreter = !!targetLanguage;

    return !!(preTargetLanguage !== targetLanguage);
  }

  /**
   * Get the language code of the interpreter target language
   * @returns {number}
   */
  getTargetLanguageCode() {
    if (this.selfIsInterpreter) {
      // @ts-ignore
      return this.siLanguages.get(this.targetLanguage)?.languageCode;
    }

    return 0;
  }

  /**
   * query interpretation languages
   * @returns {Promise}
   */
  querySupportLanguages() {
    // @ts-ignore
    return this.request({
      method: HTTP_VERBS.GET,
      uri: `${this.locusUrl}/languages/interpretation`,
    })
      .then((result) => {
        this.supportLanguages = result.body?.siLanguages;
        // @ts-ignore
        this.emit(INTERPRETATION.EVENTS.SUPPORT_LANGUAGES_UPDATE);
      })
      .catch((error) => {
        LoggerProxy.logger.error('Meeting:interpretation#querySupportLanguages failed', error);
        throw error;
      });
  }

  /**
   * get interpreters of the meeting
   * @returns {Promise}
   */
  getInterpreters() {
    // @ts-ignore
    return this.request({
      method: HTTP_VERBS.GET,
      uri: `${this.locusUrl}/interpretation/interpreters`,
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:interpretation#getInterpreters failed', error);
      throw error;
    });
  }

  /**
   * update interpreters of the meeting
   * @param {Array} interpreters
   * @returns {Promise}
   */
  updateInterpreters(interpreters) {
    // @ts-ignore
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
  }

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

    // @ts-ignore
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
  }

  /**
   * Sets up a listener for handoff requests from mercury
   * @returns {void}
   */
  listenToHandoffRequests() {
    // @ts-ignore
    this.webex.internal.mercury.on('event:locus.approval_request', (event) => {
      if (event?.data?.approval?.resourceType === INTERPRETATION.RESOURCE_TYPE) {
        const {receivers, initiator, actionType, url} = event.data.approval;
        const receiverId = receivers?.[0]?.participantId;
        const isReceiver = !!receiverId && receiverId === this.selfParticipantId;
        const senderId = initiator?.participantId;
        const isSender = !!senderId && senderId === this.selfParticipantId;
        if (!isReceiver && !isSender) {
          return;
        }
        // @ts-ignore
        this.emit(INTERPRETATION.EVENTS.HANDOFF_REQUESTS_ARRIVED, {
          actionType,
          isReceiver,
          isSender,
          senderId,
          receiverId,
          url,
        });
      }
    });
  }

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

    // @ts-ignore
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
  }

  /**
   * the in-active interpreter request to hand off the active role to self
   * @returns {Promise}
   */
  requestHandoff() {
    if (!this.approvalUrl) {
      return Promise.reject(new Error('Missing approval url'));
    }

    // @ts-ignore
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
  }

  /**
   * accept the request of handoff
   * @param {String} url the url get from last approval event
   * @returns {Promise}
   */
  acceptRequest(url) {
    if (!url) {
      return Promise.reject(new Error('Missing the url to accept'));
    }

    // @ts-ignore
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
  }

  /**
   * decline the request of handoff
   * @param {String} url the url get from last approval event
   * @returns {Promise}
   */
  declineRequest(url) {
    if (!url) {
      return Promise.reject(new Error('Missing the url to decline'));
    }

    // @ts-ignore
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
  }
}

export default SimultaneousInterpretation;
