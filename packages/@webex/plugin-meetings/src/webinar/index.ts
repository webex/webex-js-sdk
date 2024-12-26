/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */
import {WebexPlugin, config} from '@webex/webex-core';
import uuid from 'uuid';
import {get} from 'lodash';
import {HEADERS, HTTP_VERBS, MEETINGS, SELF_ROLES} from '../constants';

import WebinarCollection from './collection';
import LoggerProxy from '../common/logs/logger-proxy';

/**
 * @class Webinar
 */
const Webinar = WebexPlugin.extend({
  namespace: MEETINGS,
  collections: {
    webinar: WebinarCollection,
  },

  props: {
    locusUrl: 'string', // appears current webinar's locus url
    webcastInstanceUrl: 'string', // current webinar's webcast instance url
    canManageWebcast: 'boolean', // appears the ability to manage webcast
    selfIsPanelist: 'boolean', // self is panelist
    selfIsAttendee: 'boolean', // self is attendee
    practiceSessionEnabled: 'boolean', // practice session enabled
  },

  /**
   * Update the current locus url of the webinar
   * @param {string} locusUrl
   * @returns {void}
   */
  locusUrlUpdate(locusUrl) {
    this.set('locusUrl', locusUrl);
  },

  /**
   * Update the current webcast instance url of the meeting
   * @param {object} payload
   * @returns {void}
   */
  updateWebcastUrl(payload) {
    this.set('webcastInstanceUrl', get(payload, 'resources.webcastInstance.url'));
  },

  /**
   * Update whether self has capability to manage start/stop webcast (only host can manage it)
   * @param {boolean} canManageWebcast
   * @returns {void}
   */
  updateCanManageWebcast(canManageWebcast) {
    this.set('canManageWebcast', canManageWebcast);
  },

  /**
   * Updates user roles and manages associated state transitions
   * @param {object} payload
   * @param {string[]} payload.oldRoles - Previous roles of the user
   * @param {string[]} payload.newRoles - New roles of the user
   * @returns {{isPromoted: boolean, isDemoted: boolean}} Role transition states
   */
  updateRoleChanged(payload) {
    const oldRoles = get(payload, 'oldRoles', []);
    const newRoles = get(payload, 'newRoles', []);

    const isPromoted =
      oldRoles.includes(SELF_ROLES.ATTENDEE) && newRoles.includes(SELF_ROLES.PANELIST);
    const isDemoted =
      oldRoles.includes(SELF_ROLES.PANELIST) && newRoles.includes(SELF_ROLES.ATTENDEE);
    this.set('selfIsPanelist', newRoles.includes(SELF_ROLES.PANELIST));
    this.set('selfIsAttendee', newRoles.includes(SELF_ROLES.ATTENDEE));
    this.updateCanManageWebcast(newRoles.includes(SELF_ROLES.MODERATOR));

    return {isPromoted, isDemoted};
  },

  /**
   * start or stop practice session for webinar
   * @param {boolean} enabled
   * @returns {Promise}
   */
  setPracticeSessionState(enabled) {
    return this.request({
      method: HTTP_VERBS.PATCH,
      uri: `${this.locusUrl}/controls`,
      body: {
        practiceSession: {
          enabled,
        },
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:webinar#setPracticeSessionState failed', error);
      throw error;
    });
  },

  /**
   * update practice session status
   * @param {object} payload
   * @returns {void}
   */
  updatePracticeSessionStatus(payload) {
    this.set('practiceSessionEnabled', payload.enabled);
  },

  /**
   * start webcast mode for webinar
   * @param {object} meeting
   * @param {object} layout
   * @returns {Promise}
   */
  async startWebcast(meeting, layout) {
    if (!meeting) {
      LoggerProxy.logger.error(
        `Meeting:webinar#startWebcast failed --> meeting parameter : ${meeting}`
      );
      throw new Error('Meeting parameter does not meet expectations');
    }

    return this.request({
      method: HTTP_VERBS.PUT,
      uri: `${this.webcastInstanceUrl}/streaming`,
      headers: {
        authorization: await this.webex.credentials.getUserToken(),
        trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
        [HEADERS.CONTENT_TYPE]: HEADERS.CONTENT_TYPE_VALUE.APPLICATION_JSON,
      },
      body: {
        action: 'start',
        meetingInfo: {
          locusId: meeting.locusId,
          correlationId: meeting.correlationId,
        },
        layout,
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:webinar#startWebcast failed', error);
      throw error;
    });
  },

  /**
   * stop webcast mode for webinar
   * @returns {Promise}
   */
  async stopWebcast() {
    return this.request({
      method: HTTP_VERBS.PUT,
      uri: `${this.webcastInstanceUrl}/streaming`,
      headers: {
        authorization: await this.webex.credentials.getUserToken(),
        trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
        [HEADERS.CONTENT_TYPE]: HEADERS.CONTENT_TYPE_VALUE.APPLICATION_JSON,
      },
      body: {
        action: 'stop',
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:webinar#stopWebcast failed', error);
      throw error;
    });
  },

  /**
   * query webcast layout for webinar
   * @returns {Promise}
   */
  async queryWebcastLayout() {
    return this.request({
      method: HTTP_VERBS.GET,
      uri: `${this.webcastInstanceUrl}/layout`,
      headers: {
        authorization: await this.webex.credentials.getUserToken(),
        trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:webinar#queryWebcastLayout failed', error);
      throw error;
    });
  },

  /**
   * update webcast layout for webinar
   * @param {object} layout
   * @returns {Promise}
   */
  async updateWebcastLayout(layout) {
    return this.request({
      method: HTTP_VERBS.PUT,
      uri: `${this.webcastInstanceUrl}/layout`,
      headers: {
        authorization: await this.webex.credentials.getUserToken(),
        trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
        [HEADERS.CONTENT_TYPE]: HEADERS.CONTENT_TYPE_VALUE.APPLICATION_JSON,
      },
      body: {
        layout: {
          videoLayout: layout.videoLayout,
          contentLayout: layout.contentLayout,
          syncStageLayout: layout.syncStageLayout,
          syncStageInMeeting: layout.syncStageInMeeting,
        },
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:webinar#updateWebcastLayout failed', error);
      throw error;
    });
  },

  /**
   * view all webcast attendees
   * @param {string} queryString
   * @returns {Promise}
   */
  async viewAllWebcastAttendees() {
    return this.request({
      method: HTTP_VERBS.GET,
      uri: `${this.webcastInstanceUrl}/attendees`,
      headers: {
        authorization: await this.webex.credentials.getUserToken(),
        trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:webinar#viewAllWebcastAttendees failed', error);
      throw error;
    });
  },

  /**
   * search webcast attendees by query string
   * @param {string} queryString
   * @returns {Promise}
   */
  async searchWebcastAttendees(queryString = '') {
    return this.request({
      method: HTTP_VERBS.GET,
      uri: `${this.webcastInstanceUrl}/attendees?keyword=${encodeURIComponent(queryString)}`,
      headers: {
        authorization: await this.webex.credentials.getUserToken(),
        trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:webinar#searchWebcastAttendees failed', error);
      throw error;
    });
  },

  /**
   * expel webcast attendee by participantId
   * @param {string} participantId
   * @returns {Promise}
   */
  async expelWebcastAttendee(participantId) {
    return this.request({
      method: HTTP_VERBS.DELETE,
      uri: `${this.webcastInstanceUrl}/attendees/${participantId}`,
      headers: {
        authorization: await this.webex.credentials.getUserToken(),
        trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:webinar#expelWebcastAttendee failed', error);
      throw error;
    });
  },
});

export default Webinar;
