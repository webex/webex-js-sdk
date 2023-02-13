/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */
import {WebexPlugin} from '@webex/webex-core';
import {debounce, forEach} from 'lodash';
import LoggerProxy from '../common/logs/logger-proxy';

import {BREAKOUTS, HTTP_VERBS, MEETINGS} from '../constants';

import Breakout from './breakout';
import BreakoutCollection from './collection';
import {getBroadcastRoles} from './utils';

/**
 * @class Breakouts
 */
const Breakouts = WebexPlugin.extend({
  namespace: MEETINGS,

  collections: {
    breakouts: BreakoutCollection,
  },

  props: {
    allowBackToMain: 'boolean', // only present when in a breakout session
    delayCloseTime: 'number', // appears once breakouts start
    enableBreakoutSession: 'boolean', // appears from the moment you enable breakouts
    groupId: 'string', // appears from the moment you enable breakouts
    mainGroupId: 'string',
    mainSessionId: 'string',
    breakoutGroupId: 'string',
    name: 'string', // only present when in a breakout session
    sessionId: 'string', // appears from the moment you enable breakouts
    sessionType: 'string', // appears from the moment you enable breakouts
    startTime: 'string', // appears once breakouts start
    status: 'string', // only present when in a breakout session
    url: 'string', // appears from the moment you enable breakouts
    locusUrl: 'string', // the current locus url
  },

  children: {
    currentBreakoutSession: Breakout,
  },

  derived: {
    isInMainSession: {
      deps: ['sessionType'],
      /**
       * Returns true if the user is in the main session
       * @returns {boolean}
       */
      fn() {
        return this.sessionType === BREAKOUTS.SESSION_TYPES.MAIN;
      },
    },
  },

  /**
   * initialize for the breakouts
   * @returns {void}
   */
  initialize() {
    this.listenTo(this, 'change:status', () => {
      if (this.status === BREAKOUTS.STATUS.CLOSING) {
        this.trigger(BREAKOUTS.EVENTS.BREAKOUTS_CLOSING);
      }
    });
    this.debouncedQueryRosters = debounce(this.queryRosters, 10, {
      leading: true,
      trailing: false,
    });
    this.listenTo(this.breakouts, 'add', () => {
      this.debouncedQueryRosters();
    });
    this.listenToBroadcastMessages();
    this.listenToBreakoutRosters();
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
   * The initial roster lists need to be queried because you don't
   * get a breakout.roster event when you join the meeting
   * @returns {void}
   */
  queryRosters() {
    this.webex
      .request({uri: `${this.url}/roster`, qs: {locusUrl: btoa(this.locusUrl)}})
      .then((result) => {
        const {
          body: {rosters},
        } = result;

        rosters.forEach(({locus}) => {
          this.handleRosterUpdate(locus);
        });

        this.trigger(BREAKOUTS.EVENTS.MEMBERS_UPDATE);
      })
      .catch((error) => {
        LoggerProxy.logger.error('Meeting:breakouts#queryRosters failed', error);
      });
  },

  /**
   *
   * @param {Object} locus // locus object
   * @returns {void}
   */
  handleRosterUpdate(locus) {
    const sessionId = locus.controls?.breakout?.sessionId;

    const session = this.breakouts.get(sessionId);

    if (!session) {
      return;
    }

    session.parseRoster(locus);
  },

  /**
   * Sets up listener for broadcast messages sent to the breakout session
   * @returns {void}
   */
  listenToBroadcastMessages() {
    this.listenTo(this.webex.internal.llm, 'event:breakout.message', (event) => {
      const {
        data: {senderUserId, sentTime, message},
      } = event;

      this.trigger(BREAKOUTS.EVENTS.MESSAGE, {
        senderUserId,
        sentTime,
        message,
        // FIXME: This is only the current sessionId
        // We'd need to check that the dataChannelUrl is still the same
        // to guarantee that this message was sent to this session
        sessionId: this.currentBreakoutSession.sessionId,
      });
    });
  },

  /**
   * Sets up a listener for roster messags from mecury
   * @returns {void}
   */
  listenToBreakoutRosters() {
    this.listenTo(this.webex.internal.mercury, 'event:breakout.roster', (event) => {
      this.handleRosterUpdate(event.data.locus);
      this.trigger(BREAKOUTS.EVENTS.MEMBERS_UPDATE);
    });
  },

  /**
   * Updates the information about the current breakout
   * @param {Object} params
   * @returns {void}
   */
  updateBreakout(params) {
    this.set(params);
    if (params.sessionType === BREAKOUTS.SESSION_TYPES.MAIN) {
      this.set({
        mainGroupId: params.groupId,
        mainSessionId: params.sessionId,
        breakoutGroupId: params.groups && params.groups.length ? params.groups[0].id : '',
      });
    }

    this.set('currentBreakoutSession', {
      sessionId: params.sessionId,
      groupId: params.groupId,
      name: params.name,
      current: true,
      sessionType: params.sessionType,
      url: params.url,
      [BREAKOUTS.SESSION_STATES.ACTIVE]: false,
      [BREAKOUTS.SESSION_STATES.ALLOWED]: false,
      [BREAKOUTS.SESSION_STATES.ALLOWED]: false,
      [BREAKOUTS.SESSION_STATES.ASSIGNED_CURRENT]: false,
      [BREAKOUTS.SESSION_STATES.REQUESTED]: false,
    });
  },

  /**
   * Updates the information about available breakouts
   * @param {Object} payload
   * @returns {void}
   */
  updateBreakoutSessions(payload) {
    const breakouts = {};

    if (payload.breakoutSessions) {
      forEach(BREAKOUTS.SESSION_STATES, (state) => {
        forEach(payload.breakoutSessions[state], (breakout) => {
          const {sessionId} = breakout;

          if (!breakouts[sessionId]) {
            breakouts[sessionId] = breakout;
            breakouts[sessionId][BREAKOUTS.SESSION_STATES.ACTIVE] = false;
            breakouts[sessionId][BREAKOUTS.SESSION_STATES.ASSIGNED] = false;
            breakouts[sessionId][BREAKOUTS.SESSION_STATES.ALLOWED] = false;
            breakouts[sessionId][BREAKOUTS.SESSION_STATES.ASSIGNED_CURRENT] = false;
            breakouts[sessionId][BREAKOUTS.SESSION_STATES.REQUESTED] = false;
          }

          breakouts[sessionId][state] = true;
        });
      });
    }

    forEach(breakouts, (breakout: typeof Breakout) => {
      // eslint-disable-next-line no-param-reassign
      breakout.url = this.url;
    });

    this.breakouts.set(Object.values(breakouts));
  },

  /**
   * Host/CoHost ask all participants return to main session
   * @returns {void}
   */
  askAllToReturn() {
    return this.webex.request({
      method: HTTP_VERBS.POST,
      uri: `${this.url}/requestMove`,
      body: {
        groupId: this.mainGroupId,
        sessionId: this.mainSessionId,
      },
    });
  },

  /**
   * Broadcast message to all breakout session's participants
   * @param {String} message
   * @param {Object} options
   * @returns {void}
   */
  broadcast(message, options) {
    const roles = getBroadcastRoles(options);
    const params = {
      id: this.breakoutGroupId,
      recipientRoles: roles.length ? roles : undefined,
    };

    return this.webex.request({
      method: HTTP_VERBS.POST,
      uri: `${this.url}/message`,
      body: {
        message,
        groups: [params],
      },
    });
  },
});

export default Breakouts;
