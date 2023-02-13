/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin} from '@webex/webex-core';

import {HTTP_VERBS, MEETINGS} from '../constants';
import LocusInfo from '../locus-info';
import Members from '../members';
import {getBroadcastRoles} from './utils';

/**
 * @class
 */
const Breakout = WebexPlugin.extend({
  idAttribute: 'sessionId',

  namespace: MEETINGS,

  props: {
    active: ['boolean', false, false], // this session is active
    allowed: ['boolean', false, false], // allowed to join this session
    assigned: ['boolean', false, false], // assigned to this session, but not necessarily joined yet
    assignedCurrent: ['boolean', false, false], // assigned AND current session
    requested: ['boolean', false, false], // requested by the host to join this session
    current: ['boolean', false, false], // the current joined session
    name: 'string',
    sessionId: 'string',
    sessionType: 'string',
    groupId: 'string',
    url: 'string', // where to send requests to
  },

  derived: {
    isMain: {
      deps: ['sessionType'],
      /**
       * If the breakout has no name, assume it is the main session
       * @returns {boolean}
       */
      fn() {
        return this.sessionType === 'MAIN';
      },
    },
  },

  initialize() {
    this.members = new Members({}, {parent: this.webex});
  },

  /**
   * Joins the breakout session
   * @returns {Promise}
   */
  join() {
    return this.request({
      method: HTTP_VERBS.POST,
      uri: `${this.url}/move`,
      body: {
        groupId: this.groupId,
        sessionId: this.sessionId,
      },
    });
  },

  /**
   * Leaves the breakout session to return to the main session
   * @returns {Promise}
   * @throws {Error} if an attempt is made to leave the main session or if the main session cannot be found
   */
  leave() {
    if (this.isMain) {
      throw new Error('Cannot leave the main session');
    }

    const mainSession = this.parent.breakouts.filter((breakout) => breakout.isMain)[0];

    if (!mainSession) {
      throw new Error('Cannot leave, no main session found');
    }

    return mainSession.join();
  },

  /**
   * Sends a help request for the current breakout
   * @returns {Promise}
   */
  askForHelp() {
    return this.request({
      method: HTTP_VERBS.POST,
      uri: `${this.url}/help`,
      body: {
        groupId: this.groupId,
        sessionId: this.sessionId,
      },
    });
  },

  /**
   * Parses the participants from the locus object
   * @param locus Locus object
   * @returns {void}
   */

  parseRoster(locus) {
    this.members.locusParticipantsUpdate(locus);
  },

  /**
   * Broadcast message to this breakout session's participants
   * @param {String} message
   * @param {Object} options
   * @returns {void}
   */
  broadcast(message, options) {
    const roles = getBroadcastRoles(options);
    const params = {
      id: this.groupId,
      recipientRoles: roles.length ? roles : undefined,
      sessions: [
        {
          id: this.sessionId,
        },
      ],
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

export default Breakout;
