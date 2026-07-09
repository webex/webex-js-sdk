/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */
import {WebexPlugin, config} from '@webex/webex-core';
import uuid from 'uuid';
import {get} from 'lodash';
import type LLMChannel from '@webex/internal-plugin-llm';
import {
  _ID_,
  HEADERS,
  HTTP_VERBS,
  MEETINGS,
  SELF_ROLES,
  SHARE_STATUS,
  DEFAULT_LARGE_SCALE_WEBINAR_ATTENDEE_SEARCH_LIMIT,
  LOCUS_LLM_EVENT,
} from '../constants';

import WebinarCollection from './collection';
import LoggerProxy from '../common/logs/logger-proxy';
import MeetingUtil from '../meeting/util';
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
   * LLM channel for practice session, owned by this webinar instance.
   * @type {LLMChannel|undefined}
   */
  practiceSessionLLMChannel: undefined as LLMChannel | undefined,

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
   * Resolves the meeting associated with this webinar instance, guarded against the
   * meetingId pointer drifting onto an unrelated transient meeting (e.g. an inbound
   * 1:1 call) that may exist in the meeting collection. Returns the meeting only when
   * its locusUrl matches this webinar's tracked locusUrl. Returns undefined (with a
   * warning) when the meeting cannot be resolved or when the webinar's locusUrl has
   * not been initialized yet — callers must treat this as "no owned meeting" rather
   * than fall through to an unvalidated lookup.
   * @returns {object|undefined}
   */
  getValidatedWebinarMeeting() {
    const meeting = this.webex.meetings.getMeetingByType(_ID_, this.meetingId);

    if (!meeting) {
      return undefined;
    }

    if (!this.locusUrl) {
      LoggerProxy.logger.warn(
        `Webinar:index#getValidatedWebinarMeeting --> skipping; webinar locusUrl is not yet initialized for meetingId ${this.meetingId}`
      );

      return undefined;
    }

    if (meeting.locusUrl !== this.locusUrl) {
      LoggerProxy.logger.warn(
        `Webinar:index#getValidatedWebinarMeeting --> skipping; meeting ${this.meetingId} locusUrl ${meeting.locusUrl} does not match webinar locusUrl ${this.locusUrl}`
      );

      return undefined;
    }

    return meeting;
  },

  /**
   * should join practice session data channel or not
   * @param {Object} {isPromoted: boolean, isDemoted: boolean}} Role transition states
   * @returns {void}
   */
  updateStatusByRole({isPromoted, isDemoted}) {
    const meeting = this.getValidatedWebinarMeeting();

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
   * Disconnects the practice session LLM channel and cleans up listeners.
   * @returns {Promise<void>}
   */
  async cleanupPSDataChannel() {
    // Remove pending online listener if any
    if (this._pendingOnlineListener) {
      const meeting = this.getValidatedWebinarMeeting();
      meeting?.llmChannel?.off('online', this._pendingOnlineListener);
      this._pendingOnlineListener = null;
    }

    if (!this.practiceSessionLLMChannel) {
      return;
    }

    try {
      await this.practiceSessionLLMChannel.disconnect({
        code: 3050,
        reason: 'done (permanent)',
      });
    } catch (error) {
      LoggerProxy.logger.error(
        'Webinar:index#cleanupPSDataChannel --> Failed to disconnect practice session LLM channel',
        error
      );
      throw error;
    } finally {
      // Remove listeners from the channel
      const meeting = this.getValidatedWebinarMeeting();
      if (meeting) {
        this.practiceSessionLLMChannel?.off('event:relay.event', meeting.processRelayEvent);
        this.practiceSessionLLMChannel?.off(LOCUS_LLM_EVENT, meeting.processLocusLLMEvent);
        this.practiceSessionLLMChannel?.off('online', meeting.handleLLMOnline);

        // Unregister annotation from practice session
        meeting.annotation.unregisterChannel('practice-session');
      }
      this.practiceSessionLLMChannel = undefined;
    }
  },

  /**
   * Ensures practice-session token exists before registering the practice LLM channel.
   * Caller is responsible for passing a meeting that has already been resolved via
   * getValidatedWebinarMeeting() — this method does not re-validate ownership.
   * @param {object} meeting
   * @returns {Promise<string|undefined>}
   */
  async ensurePracticeSessionDatachannelToken(meeting) {
    // @ts-ignore
    const isDataChannelTokenEnabled = await this.webex.internal.llm.isDataChannelTokenEnabled();

    if (!isDataChannelTokenEnabled) {
      return undefined;
    }

    // Check for cached token on the channel or pending token on the meeting
    const cachedToken =
      this.practiceSessionLLMChannel?.getDatachannelToken() ??
      meeting._pendingPracticeSessionDatachannelToken;

    if (cachedToken) {
      return cachedToken;
    }

    try {
      const refreshResponse = await meeting.refreshDataChannelToken();
      const {datachannelToken} = refreshResponse?.body ?? {};

      if (!datachannelToken) {
        return undefined;
      }

      // Store token on the channel if it exists, otherwise on meeting for later
      if (this.practiceSessionLLMChannel) {
        this.practiceSessionLLMChannel.setDatachannelToken(datachannelToken);
      } else {
        meeting._pendingPracticeSessionDatachannelToken = datachannelToken;
      }

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
   * Connects practice session LLM channel. Creates a new channel if needed.
   * Will disconnect if the meeting has ended or is no longer in practice session mode.
   * Waits for the main LLM channel to be connected before connecting practice session.
   * @returns {Promise}
   */
  async updatePSDataChannel() {
    this._updatePSDataChannelSequence = (this._updatePSDataChannelSequence || 0) + 1;
    const invocationSequence = this._updatePSDataChannelSequence;

    const meeting = this.getValidatedWebinarMeeting();
    const isPracticeSession = meeting?.isJoined() && this.isJoinPracticeSessionDataChannel();

    if (!isPracticeSession) {
      await this.cleanupPSDataChannel();

      return undefined;
    }

    // @ts-ignore - Fix type
    const {url = undefined, info: {practiceSessionDatachannelUrl = undefined} = {}} =
      meeting?.locusInfo || {};

    if (!practiceSessionDatachannelUrl) {
      return undefined;
    }

    // If already connected to same URLs, skip reconnect
    if (this.practiceSessionLLMChannel?.isConnected()) {
      if (
        url === this.practiceSessionLLMChannel.getLocusUrl() &&
        practiceSessionDatachannelUrl === this.practiceSessionLLMChannel.getDatachannelUrl()
      ) {
        return undefined;
      }
      // URLs changed, disconnect existing channel
      await this.cleanupPSDataChannel();
    }

    // Ensure the default session LLM channel is connected before connecting the practice session.
    // Subscribe before checking isConnected() to avoid a race where the 'online' event fires
    // between the check and the subscription — the channel does not replay missed events.
    if (!this._pendingOnlineListener && meeting?.llmChannel) {
      const onDefaultSessionConnected = () => {
        this._pendingOnlineListener = null;
        meeting.llmChannel?.off('online', onDefaultSessionConnected);
        this.updatePSDataChannel();
      };
      this._pendingOnlineListener = onDefaultSessionConnected;
      meeting.llmChannel.on('online', onDefaultSessionConnected);
    }

    if (!meeting?.llmChannel?.isConnected()) {
      LoggerProxy.logger.info(
        'Webinar:index#updatePSDataChannel --> default session not yet connected, deferring practice session connect.'
      );

      return undefined;
    }

    // Default session is already connected — cancel the pending listener and proceed
    if (this._pendingOnlineListener) {
      meeting.llmChannel.off('online', this._pendingOnlineListener);
      this._pendingOnlineListener = null;
    }

    const isCaptionBoxOn = this.webex.internal.voicea.getIsCaptionBoxOn();

    // Get token from pending on meeting or refresh if needed
    let practiceSessionDatachannelToken =
      meeting._pendingPracticeSessionDatachannelToken ??
      this.practiceSessionLLMChannel?.getDatachannelToken();

    const refreshedToken = await this.ensurePracticeSessionDatachannelToken(meeting);

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

    if (refreshedToken) {
      practiceSessionDatachannelToken = refreshedToken;
    }

    // Create a new practice session LLM channel
    // @ts-ignore - Fix type
    this.practiceSessionLLMChannel = this.webex.internal.llm.createConnection();

    // Set up refresh handler before registration
    this.practiceSessionLLMChannel.setRefreshHandler(() => meeting.refreshDataChannelToken());

    // If we have a pending token, store it on the channel
    if (meeting._pendingPracticeSessionDatachannelToken) {
      this.practiceSessionLLMChannel.setDatachannelToken(
        meeting._pendingPracticeSessionDatachannelToken
      );
      meeting._pendingPracticeSessionDatachannelToken = undefined;
    }

    return this.practiceSessionLLMChannel
      .registerAndConnect(url, practiceSessionDatachannelUrl, practiceSessionDatachannelToken)
      .then((registerAndConnectResult) => {
        // Register event listeners on the practice session channel
        this.practiceSessionLLMChannel.off('event:relay.event', meeting.processRelayEvent);
        this.practiceSessionLLMChannel.on('event:relay.event', meeting.processRelayEvent);
        this.practiceSessionLLMChannel.off(LOCUS_LLM_EVENT, meeting.processLocusLLMEvent);
        this.practiceSessionLLMChannel.on(LOCUS_LLM_EVENT, meeting.processLocusLLMEvent);
        this.practiceSessionLLMChannel.off('online', meeting.handleLLMOnline);
        this.practiceSessionLLMChannel.on('online', meeting.handleLLMOnline);

        // Register annotation channel for practice session
        meeting.annotation.registerChannel(this.practiceSessionLLMChannel, 'practice-session');

        // @ts-ignore - Fix type
        this.webex.internal.voicea?.announce?.();
        if (keepTranscriptionSubscribed) {
          this.webex.internal.voicea.updateSubchannelSubscriptions({subscribe: ['transcription']});
        }
        LoggerProxy.logger.info(
          'Webinar:index#updatePSDataChannel --> enabled to receive relay events for practice session!'
        );

        return Promise.resolve(registerAndConnectResult);
      })
      .catch((error) => {
        // Clean up the channel on failure
        this.practiceSessionLLMChannel = undefined;
        throw error;
      });
  },

  /**
   * start or stop practice session for webinar
   * @param {boolean} enabled
   * @returns {Promise}
   */
  setPracticeSessionState(enabled) {
    const meeting = this.getValidatedWebinarMeeting();

    return this.request({
      method: HTTP_VERBS.PATCH,
      uri: `${this.locusUrl}/controls`,
      body: {
        practiceSession: {
          enabled,
        },
      },
    })
      .then((response) => {
        MeetingUtil.updateLocusFromApiResponse(meeting, response);

        return response;
      })
      .catch((error) => {
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
    const meeting = this.getValidatedWebinarMeeting();
    if (!meeting) {
      LoggerProxy.logger.error(
        'Meeting:webinar5k#searchLargeScaleWebinarAttendees failed --> webinar meeting could not be validated'
      );
      throw new Error('Meeting:webinar5k#Webinar meeting is not resolvable for the current locus');
    }

    const rawParams = {
      search_text: payload?.queryString,
      limit: payload?.limit ?? DEFAULT_LARGE_SCALE_WEBINAR_ATTENDEE_SEARCH_LIMIT,
      next: payload?.next,
    };
    const attendeeSearchUrl = meeting?.locusInfo?.links?.resources?.attendeeSearch?.url;
    if (!attendeeSearchUrl) {
      LoggerProxy.logger.error(
        'Meeting:webinar5k#searchLargeScaleWebinarAttendees failed --> attendee search url unavailable'
      );
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
