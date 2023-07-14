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
    originalLanguage: 'string', // appears current meeting's original language
    sourceLanguage: 'string', // appears self interpreter's source language
    targetLanguage: 'string', // appears self interpreter's target language
    receiveLanguage: 'string', // appears self's receive language
    order: 'number', // appears the order of self as interpreter
    isActive: 'boolean', // appears self is interpreter and is active
    selfParticipantId: 'string', // appears the self participant id
    canManageInterpreters: 'boolean', // appears the ability to manage interpreters
    supportLanguages: 'array', // appears the support languages
    siEnabled: 'boolean', // appears the meeting enabled SI
  },
  derived: {
    shouldQuerySupportLanguages: {
      cache: false,
      deps: ['canManageInterpreters', 'siEnabled'],
      /**
       * Returns should query support languages or not
       * @returns {boolean}
       */
      fn() {
        return !!(this.canManageInterpreters && this.siEnabled);
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
   * Update whether self has capability to manage interpreters (only host can manage it)
   * @param {boolean} canManageInterpreters
   * @returns {void}
   */
  updateCanManageInterpreters(canManageInterpreters) {
    this.set('canManageInterpreters', canManageInterpreters);
  },
  /**
   * Update the interpretation languages channels which user can choose to subscribe
   * @param {Object} interpretation
   * @returns {void}
   */
  updateInterpretation(interpretation) {
    this.set('siEnabled', !!interpretation);
    this.siLanguages.set(interpretation?.siLanguages || []);
  },
  /**
   * Update self's interpretation information (self is interpreter)
   * @param {Object} interpretation
   * @param {String} selfParticipantId
   * @returns {void}
   */
  updateSelfInterpretation({interpretation, selfParticipantId}) {
    const {originalLanguage, sourceLanguage, order, isActive, targetLanguage, receiveLanguage} =
      interpretation || {};
    this.set({originalLanguage, sourceLanguage, order, isActive, targetLanguage, receiveLanguage});
    this.set('selfParticipantId', selfParticipantId);
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
});

export default SimultaneousInterpretation;
