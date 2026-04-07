/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */
import {WebexPlugin, config} from '@webex/webex-core';
import uuid from 'uuid';
import {get} from 'lodash';
import {DataChannelTokenType} from '@webex/internal-plugin-llm';
import {
  _ID_,
  HEADERS,
  HTTP_VERBS,
  MEETINGS,
  SELF_ROLES,
  SHARE_STATUS,
  DEFAULT_LARGE_SCALE_WEBINAR_ATTENDEE_SEARCH_LIMIT,
  LLM_PRACTICE_SESSION,
} from '../constants';

import WebinarCollection from './collection';
import LoggerProxy from '../common/logs/logger-proxy';
import {sanitizeParams} from './utils';

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
    meetingId: 'string',
  },

  /**
   * Calls this to clean up listeners
   * @returns {void}
   */
  cleanUp() {
    this.cleanupPSDataChannel();
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
      (oldRoles.includes(SELF_ROLES.PANELIST) && newRoles.includes(SELF_ROLES.ATTENDEE)) ||
      (!oldRoles.includes(SELF_ROLES.ATTENDEE) && newRoles.includes(SELF_ROLES.ATTENDEE)); // for attendee just join meeting case
    this.set('selfIsPanelist', newRoles.includes(SELF_ROLES.PANELIST));
    this.set('selfIsAttendee', newRoles.includes(SELF_ROLES.ATTENDEE));
    this.updateCanManageWebcast(newRoles.includes(SELF_ROLES.MODERATOR));
    this.updateStatusByRole({isPromoted, isDemoted});

    return {isPromoted, isDemoted};
  },

  /**
   * should join practice session data channel or not
   * @param {Object} {isPromoted: boolean, isDemoted: boolean}} Role transition states
   * @returns {void}
   */
  updateStatusByRole({isPromoted, isDemoted}) {
    const meeting = this.webex.meetings.getMeetingByType(_ID_, this.meetingId);

    if (
      (isDemoted && meeting?.shareStatus === SHARE_STATUS.WHITEBOARD_SHARE_ACTIVE) ||
      isPromoted
    ) {
      // attendees in webinar should subscribe streaming for whiteboard sharing
      // while panelist still need subscribe native mode so trigger force update here
      meeting?.locusInfo?.updateMediaShares(meeting?.locusInfo?.mediaShares, true);
    }

    this.updatePSDataChannel();
  },

  /**
   * should join practice session data channel or not
   * @returns {boolean}
   */
  isJoinPracticeSessionDataChannel() {
    return this.selfIsPanelist && this.practiceSessionEnabled;
  },

  /**
   * Disconnects the practice session data channel and removes its relay listener.
   * @returns {Promise<void>}
   */
  async cleanupPSDataChannel() {
    if (this._pendingOnlineListener) {
      // @ts-ignore - Fix type
      this.webex.internal.llm.off('online', this._pendingOnlineListener);
      this._pendingOnlineListener = null;
    }

    const meeting = this.webex.meetings.getMeetingByType(_ID_, this.meetingId);

    // @ts-ignore - Fix type
    await this.webex.internal.llm.disconnectLLM(
      {
        code: 3050,
        reason: 'done (permanent)',
      },
      LLM_PRACTICE_SESSION
    );
    // @ts-ignore - Fix type
    this.webex.internal.llm.off(
      `event:relay.event:${LLM_PRACTICE_SESSION}`,
      meeting?.processRelayEvent
    );
  },

  /**
   * Ensures practice-session token exists before registering the practice LLM channel.
   * @param {object} meeting
   * @returns {Promise<string|undefined>}
   */
  async ensurePracticeSessionDatachannelToken(meeting) {
    // @ts-ignore
    const isDataChannelTokenEnabled = await this.webex.internal.llm.isDataChannelTokenEnabled();

    if (!isDataChannelTokenEnabled) {
      return undefined;
    }

    // @ts-ignore
    const cachedToken = this.webex.internal.llm.getDatachannelToken(
      DataChannelTokenType.PracticeSession
    );

    if (cachedToken) {
      return cachedToken;
    }

    try {
      const refreshResponse = await meeting.refreshDataChannelToken();
      const {datachannelToken, dataChannelTokenType} = refreshResponse?.body ?? {};

      if (!datachannelToken) {
        return undefined;
      }

      // @ts-ignore
      this.webex.internal.llm.setDatachannelToken(
        datachannelToken,
        dataChannelTokenType || DataChannelTokenType.PracticeSession
      );

      return datachannelToken;
    } catch (error) {
      LoggerProxy.logger.warn(
        `Webinar:index#ensurePracticeSessionDatachannelToken --> failed to proactively refresh practice-session token: ${
          error?.message || String(error)
        }`
      );

      return undefined;
    }
  },

  /**
   * Connects to low latency mercury and reconnects if the address has changed
   * It will also disconnect if called when the meeting has ended
   * @returns {Promise}
   */
  async updatePSDataChannel() {
    this._updatePSDataChannelSequence = (this._updatePSDataChannelSequence || 0) + 1;
    const invocationSequence = this._updatePSDataChannelSequence;

    const meeting = this.webex.meetings.getMeetingByType(_ID_, this.meetingId);
    const isPracticeSession = meeting?.isJoined() && this.isJoinPracticeSessionDataChannel();

    if (!isPracticeSession) {
      await this.cleanupPSDataChannel();

      return undefined;
    }

    // @ts-ignore - Fix type
    const {url = undefined, info: {practiceSessionDatachannelUrl = undefined} = {}} =
      meeting?.locusInfo || {};

    // @ts-ignore
    let practiceSessionDatachannelToken = this.webex.internal.llm.getDatachannelToken(
      DataChannelTokenType.PracticeSession
    );

    const isCaptionBoxOn = this.webex.internal.voicea.getIsCaptionBoxOn();

    if (!practiceSessionDatachannelUrl) {
      return undefined;
    }
    // @ts-ignore - Fix type
    if (this.webex.internal.llm.isConnected(LLM_PRACTICE_SESSION)) {
      if (
        // @ts-ignore - Fix type
        url === this.webex.internal.llm.getLocusUrl(LLM_PRACTICE_SESSION) &&
        // @ts-ignore - Fix type
        practiceSessionDatachannelUrl ===
          this.webex.internal.llm.getDatachannelUrl(LLM_PRACTICE_SESSION)
      ) {
        return undefined;
      }

      await this.cleanupPSDataChannel();
    }

    // Ensure the default session data channel is connected before connecting the practice session.
    // Subscribe before checking isConnected() to avoid a race where the 'online' event fires
    // between the check and the subscription — Mercury does not replay missed events.
    if (!this._pendingOnlineListener) {
      const onDefaultSessionConnected = () => {
        this._pendingOnlineListener = null;
        // @ts-ignore - Fix type
        this.webex.internal.llm.off('online', onDefaultSessionConnected);
        this.updatePSDataChannel();
      };
      this._pendingOnlineListener = onDefaultSessionConnected;
      // @ts-ignore - Fix type
      this.webex.internal.llm.on('online', onDefaultSessionConnected);
    }

    // @ts-ignore - Fix type
    if (!this.webex.internal.llm.isConnected()) {
      LoggerProxy.logger.info(
        'Webinar:index#updatePSDataChannel --> default session not yet connected, deferring practice session connect.'
      );

      return undefined;
    }

    // Default session is already connected — cancel the pending listener and proceed
    if (this._pendingOnlineListener) {
      // @ts-ignore - Fix type
      this.webex.internal.llm.off('online', this._pendingOnlineListener);
      this._pendingOnlineListener = null;
    }

    const refreshedPracticeSessionToken = await this.ensurePracticeSessionDatachannelToken(meeting);

    const latestPracticeSessionDatachannelUrl = get(
      meeting,
      'locusInfo.info.practiceSessionDatachannelUrl'
    );
    const isStillPracticeSession = meeting?.isJoined() && this.isJoinPracticeSessionDataChannel();

    // Skip stale invocations after async refresh to avoid reconnecting a session
    // that was already updated/cleaned by a newer state transition.
    if (
      invocationSequence !== this._updatePSDataChannelSequence ||
      !isStillPracticeSession ||
      !latestPracticeSessionDatachannelUrl ||
      latestPracticeSessionDatachannelUrl !== practiceSessionDatachannelUrl
    ) {
      return undefined;
    }

    if (refreshedPracticeSessionToken) {
      practiceSessionDatachannelToken = refreshedPracticeSessionToken;
    }

    // @ts-ignore - Fix type
    return this.webex.internal.llm
      .registerAndConnect(
        url,
        practiceSessionDatachannelUrl,
        practiceSessionDatachannelToken,
        LLM_PRACTICE_SESSION
      )
      .then((registerAndConnectResult) => {
        // @ts-ignore - Fix type
        this.webex.internal.llm.off(
          `event:relay.event:${LLM_PRACTICE_SESSION}`,
          meeting?.processRelayEvent
        );
        // @ts-ignore - Fix type
        this.webex.internal.llm.on(
          `event:relay.event:${LLM_PRACTICE_SESSION}`,
          meeting?.processRelayEvent
        );
        // @ts-ignore - Fix type
        this.webex.internal.voicea?.announce?.();
        if (isCaptionBoxOn) {
          this.webex.internal.voicea.updateSubchannelSubscriptions({subscribe: ['transcription']});
        }
        LoggerProxy.logger.info(
          `Webinar:index#updatePSDataChannel --> enabled to receive relay events for default session for ${LLM_PRACTICE_SESSION}!`
        );

        return Promise.resolve(registerAndConnectResult);
      });
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
    this.set('practiceSessionEnabled', !!payload?.enabled);
    this.updatePSDataChannel().then(() => {});
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
        videoLayout: layout.videoLayout,
        contentLayout: layout.contentLayout,
        syncStageLayout: layout.syncStageLayout,
        syncStageInMeeting: layout.syncStageInMeeting,
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:webinar#updateWebcastLayout failed', error);
      throw error;
    });
  },

  /**
   * view all webcast attendees
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

  /**
   * search large scale webinar attendees
   * @param {object} payload
   * @param {string} payload.queryString
   * @param {number} payload.limit
   * @param {string} payload.next
   * @returns {Promise}
   */
  async searchLargeScaleWebinarAttendees(payload) {
    const meeting = this.webex.meetings.getMeetingByType(_ID_, this.meetingId);
    const rawParams = {
      search_text: payload?.queryString,
      limit: payload?.limit ?? DEFAULT_LARGE_SCALE_WEBINAR_ATTENDEE_SEARCH_LIMIT,
      next: payload?.next,
    };
    const attendeeSearchUrl = meeting?.locusInfo?.links?.resources?.attendeeSearch?.url;
    if (!attendeeSearchUrl) {
      LoggerProxy.logger.error(`Meeting:webinar5k#searchLargeScaleWebinarAttendees failed`);
      throw new Error('Meeting:webinar5k#Attendee search url is not available');
    }

    return this.request({
      method: HTTP_VERBS.GET,
      uri: `${attendeeSearchUrl}?${new URLSearchParams(sanitizeParams(rawParams)).toString()}`,
      headers: {
        authorization: await this.webex.credentials.getUserToken(),
        trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
      },
    }).catch((error) => {
      LoggerProxy.logger.error('Meeting:webinar5k#searchLargeScaleWebinarAttendees failed', error);
      throw error;
    });
  },
});

export default Webinar;
