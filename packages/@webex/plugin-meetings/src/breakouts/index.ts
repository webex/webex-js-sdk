/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */
import {WebexPlugin} from '@webex/webex-core';
import {debounce, forEach} from 'lodash';
import LoggerProxy from '../common/logs/logger-proxy';

import {BREAKOUTS, MEETINGS, HTTP_VERBS} from '../constants';

import Breakout from './breakout';
import BreakoutCollection from './collection';
import BreakoutRequest from './request';
import {boServiceErrorHandler} from './utils';

/**
 * @class Breakouts
 */
const Breakouts = WebexPlugin.extend({
  namespace: MEETINGS,
  breakoutRequest: BreakoutRequest,
  collections: {
    breakouts: BreakoutCollection,
  },

  props: {
    allowBackToMain: 'boolean', // only present when in a breakout session
    delayCloseTime: 'number', // appears once breakouts start
    enableBreakoutSession: 'boolean', // appears from the moment you enable breakouts
    hasBreakoutPreAssignments: 'boolean', // appears from the moment you enable breakouts
    groupId: 'string', // appears from the moment you enable breakouts
    name: 'string', // only present when in a breakout session
    sessionId: 'string', // appears from the moment you enable breakouts
    sessionType: 'string', // appears from the moment you enable breakouts
    startTime: 'string', // appears once breakouts start
    status: 'string', // only present when in a breakout session
    url: 'string', // appears from the moment you enable breakouts
    locusUrl: 'string', // the current locus url
    breakoutServiceUrl: 'string', // the current breakout resource url
    mainLocusUrl: 'string', // the locus url of the main session
    groups: 'array', // appears when create breakouts
    shouldFetchPreassignments: 'boolean', // Controlling the lifecycle of the pre-assign API
    editLock: 'object', // appears when getBreakout info editlock = true
    intervalID: 'number',
    meetingId: 'string',
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
    isActiveBreakout: {
      deps: ['sessionType', 'status'],
      /**
       * Returns true if the breakout status is active
       * @returns {boolean}
       */
      fn() {
        return (
          this.sessionType === BREAKOUTS.SESSION_TYPES.BREAKOUT &&
          (this.status === BREAKOUTS.STATUS.OPEN || this.status === BREAKOUTS.STATUS.CLOSING)
        );
      },
    },
    breakoutGroupId: {
      deps: ['groups'],
      /**
       * Returns the actived group id
       * @returns {boolean}
       */
      fn() {
        if (this.groups?.length) {
          return this.groups[0].id;
        }

        return '';
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
    // @ts-ignore
    this.breakoutRequest = new BreakoutRequest({webex: this.webex});
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
    const {isInMainSession, mainLocusUrl} = this;
    if (isInMainSession || !mainLocusUrl) {
      this.set('mainLocusUrl', locusUrl);
    }
  },

  /**
   * Update the current breakout resource url
   * @param {string} breakoutServiceUrl
   * @returns {void}
   */
  breakoutServiceUrlUpdate(breakoutServiceUrl) {
    this.set('breakoutServiceUrl', `${breakoutServiceUrl}/breakout/`);
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

        rosters?.forEach(({locus}) => {
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
    const preEnableBreakoutSession = this.get('enableBreakoutSession');
    this.set(params);
    this.set('groups', params.groups);

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

    // We need to call queryPreAssignments when enableBreakoutSession become true
    if (
      params.enableBreakoutSession &&
      params.hasBreakoutPreAssignments &&
      preEnableBreakoutSession !== params.enableBreakoutSession
    ) {
      this.queryPreAssignments();
    }
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
   * get main session
   * @returns {Breakout}
   */
  getMainSession() {
    if (this.isInMainSession) {
      return this.currentBreakoutSession;
    }

    const mainSession = this.breakouts.filter((breakout) => breakout.isMain)[0];
    if (!mainSession) {
      throw new Error('no main session found');
    }

    return mainSession;
  },
  /**
   * Host/CoHost ask all participants return to main session
   * @returns {Promise}
   */
  askAllToReturn() {
    const mainSession = this.getMainSession();

    return this.webex.request({
      method: HTTP_VERBS.POST,
      uri: `${this.url}/requestMove`,
      body: {
        groupId: mainSession.groupId,
        sessionId: mainSession.sessionId,
      },
    });
  },

  /**
   * Broadcast message to all breakout session's participants
   * @param {String} message
   * @param {Object} options
   * @returns {Promise}
   */
  broadcast(message, options) {
    const {breakoutGroupId} = this;
    if (!breakoutGroupId) {
      throw new Error('Cannot broadcast, no breakout session found');
    }

    return this.breakoutRequest.broadcast({
      url: this.url,
      message,
      options,
      groupId: breakoutGroupId,
    });
  },
  /**
   * Make enable breakout resource
   * @returns {Promise}
   */
  enableBreakouts() {
    if (this.breakoutServiceUrl) {
      // @ts-ignore
      return this.webex
        .request({
          method: HTTP_VERBS.POST,
          uri: this.breakoutServiceUrl,
          body: {
            locusUrl: this.locusUrl,
          },
        })
        .catch((err) => {
          LoggerProxy.logger.error(
            `Meeting:request#touchBreakout --> Error provisioning error ${err}`
          );
          throw err;
        });
    }

    return Promise.reject(new Error(`enableBreakouts: the breakoutServiceUrl is empty`));
  },

  /**
   * Make the meeting enable or disable breakout session
   * @param {boolean} enable
   * @returns {Promise}
   */
  async toggleBreakout(enable) {
    if (this.enableBreakoutSession === undefined) {
      const info = await this.enableBreakouts();
      if (!enable) {
        // if enable is false, updateBreakout set the param then set enableBreakoutSession as false
        this.updateBreakout(info.body);
        await this.doToggleBreakout(enable);
      }
    } else {
      await this.doToggleBreakout(enable);
    }
  },

  /**
   * do toggle meeting breakout session enable or disable
   * @param {boolean} enable
   * @returns {Promise}
   */
  doToggleBreakout(enable) {
    const body = {
      ...(this.editLock && !!this.editLock.token ? {editlock: {token: this.editLock.token}} : {}),
      ...{enableBreakoutSession: enable},
    };

    // @ts-ignore
    return this.webex.request({
      method: HTTP_VERBS.PUT,
      uri: this.url,
      body,
    });
  },

  /**
   * Create new breakout sessions
   * @param {object} sessions -- breakout session group
   * @returns {Promise}
   */
  async create(sessions) {
    const body = {
      ...(this.editLock && !!this.editLock.token ? {editlock: {token: this.editLock.token}} : {}),
      ...{groups: [{sessions}]},
    };
    // @ts-ignore
    const breakInfo = await this.webex
      .request({
        method: HTTP_VERBS.PUT,
        uri: this.url,
        body,
      })
      .catch((error) => {
        return Promise.reject(boServiceErrorHandler(error, 'Breakouts#create'));
      });

    if (breakInfo.body?.groups) {
      this.set('groups', breakInfo.body.groups);
    }

    // clear edit lock info after save breakout session info
    this._clearEditLockInfo();

    return Promise.resolve(breakInfo);
  },

  /**
   * Delete all breakout sessions
   * @returns {Promise}
   */
  async clearSessions() {
    const body = {
      ...(this.editLock && !!this.editLock.token ? {editlock: {token: this.editLock.token}} : {}),
      ...{groups: [{action: BREAKOUTS.ACTION.DELETE}]},
    };
    // @ts-ignore
    const breakInfo = await this.webex
      .request({
        method: HTTP_VERBS.PUT,
        uri: this.url,
        body,
      })
      .catch((error) => {
        return Promise.reject(boServiceErrorHandler(error, 'Breakouts#clearSessions'));
      });

    if (breakInfo.body?.groups) {
      this.set('groups', breakInfo.body.groups);
    }
    this.shouldFetchPreassignments = false;

    return Promise.resolve(breakInfo);
  },

  /**
   * Host or cohost starts breakout sessions
   * @param {object} params
   * @returns {Promise}
   */
  start(params = {}) {
    const action = BREAKOUTS.ACTION.START;
    const payload = {
      id: this.breakoutGroupId,
      action,
      allowBackToMain: false,
      allowToJoinLater: false,
      duration: BREAKOUTS.DEFAULT_DURATION,
      ...params,
    };

    const body = {
      ...(this.editLock && !!this.editLock.token
        ? {editlock: {token: this.editLock.token, refresh: true}}
        : {}),
      ...{groups: [payload]},
    };

    return this.request({
      method: HTTP_VERBS.PUT,
      uri: this.url,
      body,
    }).catch((error) => {
      return Promise.reject(boServiceErrorHandler(error, 'Breakouts#start'));
    });
  },

  /**
   * Host or cohost ends breakout sessions
   * @param {object} params
   * @returns {Promise}
   */
  end(params = {}) {
    const {delayCloseTime, breakoutGroupId: id} = this;
    const action = BREAKOUTS.ACTION.CLOSE;
    const payload = {
      id,
      action,
      delayCloseTime,
      ...params,
    };

    const body = {
      ...(this.editLock && !!this.editLock.token
        ? {editlock: {token: this.editLock.token, refresh: true}}
        : {}),
      ...{groups: [payload]},
    };

    return this.request({
      method: HTTP_VERBS.PUT,
      uri: this.url,
      body,
    }).catch((error) => {
      return Promise.reject(boServiceErrorHandler(error, 'Breakouts#end'));
    });
  },

  /**
   * Host or cohost update breakout sessions
   * @param {Object} params
   * @param {String} params.id
   * @returns {Promise}
   */
  update(params: {id: string}) {
    if (!params.id) {
      return Promise.reject(new Error('Missing breakout group id'));
    }
    const payload = {...params};

    const body = {
      ...(this.editLock?.token ? {editlock: {token: this.editLock.token, refresh: true}} : {}),
      ...{groups: [payload]},
    };

    return this.request({
      method: HTTP_VERBS.PUT,
      uri: this.url,
      body,
    }).catch((error) => {
      return Promise.reject(boServiceErrorHandler(error, 'Breakouts#update'));
    });
  },

  /**
   * get existed breakout sessions
   * @param {boolean} editlock -- lock operations of the breakout sessions
   * @returns {Promise}
   */
  async getBreakout(editlock) {
    const breakout = await this.request({
      method: HTTP_VERBS.GET,
      uri: this.url + (editlock ? `?editlock=${editlock}` : ''),
    });

    if (breakout.body?.groups) {
      this.set('groups', breakout.body.groups);
    }
    if (editlock && breakout.body?.editlock?.token) {
      this.set('editLock', breakout.body.editlock);
      this.keepEditLockAlive();
    }

    return breakout;
  },

  /**
   * enable and edit lock breakout
   * @returns {void}
   */
  async enableAndLockBreakout() {
    if (this.enableBreakoutSession) {
      this.lockBreakout();
    } else {
      const info = await this.enableBreakouts();

      if (info.body) {
        this.lockBreakout();
      }
    }
  },

  /**
   * send breakout edit lock
   * @returns {void}
   */
  async lockBreakout() {
    if (this.editLock && !!this.editLock.token) {
      if (this.editLock.state === BREAKOUTS.EDIT_LOCK_STATUS.LOCKED) {
        throw new Error('Breakout already locked');
      } else {
        this.keepEditLockAlive();
      }
    } else {
      const breakout = await this.getBreakout(true);
      if (breakout.body?.editlock) {
        this.keepEditLockAlive();
      }
    }
  },

  /**
   * keep edit lock alive
   * @returns {void}
   */
  keepEditLockAlive() {
    if (this.editLock && !!this.editLock.token) {
      const ttl = this.editLock.ttl < 30 ? BREAKOUTS.DEFAULT_TTL : this.editLock.ttl;
      if (this.intervalID) {
        window.clearInterval(this.intervalID);
      }

      this.intervalID = window.setInterval(() => {
        this.request({
          method: HTTP_VERBS.PUT,
          uri: `${this.url}/editlock/${this.editLock.token}`,
        }).catch((error) => {
          this._clearEditLockInfo();

          return Promise.reject(boServiceErrorHandler(error, 'Breakouts#keepEditLockAlive'));
        });
      }, (ttl / 2) * 1000);
    }
  },

  /**
   * unlock edit breakout
   * @returns {void}
   */
  unLockEditBreakout() {
    if (this.editLock && !!this.editLock.token) {
      this.request({
        method: HTTP_VERBS.DELETE,
        uri: `${this.url}/editlock/${this.editLock.token}`,
      })
        .then(() => {
          this._clearEditLockInfo();
        })
        .catch((error) => {
          return Promise.reject(boServiceErrorHandler(error, 'Breakouts#unLockEditBreakout'));
        });
    }
  },

  /**
   * clear interval and edit lock info
   * @private
   * @returns {void}
   */
  _clearEditLockInfo() {
    if (this.intervalID) {
      clearInterval(this.intervalID);
    }
    this.set('editLock', {});
  },

  /**
   * assign participants to breakout session
   * @param {Array} sessions
   * @returns {void}
   */
  assign(sessions: any[]) {
    const internalSessions = sessions.map((item) => {
      return {
        id: item.id,
        assigned: item.memberIds,
        assignedEmails: item.emails,
        anyoneCanJoin: !!item.anyone,
      };
    });

    return this.request({
      method: HTTP_VERBS.PUT,
      uri: this.url,
      body: {
        groups: [
          {
            id: this.breakoutGroupId,
            sessions: internalSessions,
          },
        ],
      },
    });
  },

  /**
   * The pre-assignments need to be queried when "hasBreakoutPreAssignments" is true
   * @returns {void}
   */
  queryPreAssignments() {
    if (!this.shouldFetchPreassignments) {
      this.webex
        .request({uri: `${this.url}/preassignments`, qs: {locusUrl: btoa(this.locusUrl)}})
        .then((result) => {
          if (result.body?.groups) {
            this.set('groups', result.body.groups);
          }
        })
        .catch((error) => {
          LoggerProxy.logger.error('Meeting:breakouts#queryPreAssignments failed', error);
        });
      this.shouldFetchPreassignments = true;
    }
  },
  /**
   * assign participants dynamically after breakout sessions started,
   * but currently it only used for admitting participants from lobby into breakout directly
   * @param {Array} sessions
   * @returns {void}
   */
  dynamicAssign(sessions: any[]) {
    const updatedSessions = sessions.map((item) => {
      return {
        id: item.id,
        participants: item.participants,
        targetState: item.targetState,
      };
    });

    const body = {
      groups: [
        {
          id: this.breakoutGroupId,
          sessions: updatedSessions,
        },
      ],
      editlock: null,
    };

    if (this.editLock && this.editLock.token) {
      body.editlock = this.editLock;
    }

    return this.request({
      method: HTTP_VERBS.PUT,
      uri: `${this.url}/dynamicAssign`,
      body,
    });
  },
});

export default Breakouts;
