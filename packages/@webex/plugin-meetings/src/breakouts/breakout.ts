/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin} from '@webex/webex-core';

import uuid from 'uuid';
import {_ID_, HTTP_VERBS, MEETINGS} from '../constants';
import Members from '../members';
import BreakoutRequest from './request';
import breakoutEvent from './events';
/**
 * @class
 */
class Breakout extends WebexPlugin {
  idAttribute = 'sessionId';

  namespace = MEETINGS;

  breakoutRequest: BreakoutRequest;
  active = false;
  allowed = false;
  assigned = false;
  assignedCurrent = false;
  requested = false;
  current = false;
  name: string;
  meetingId: string;
  sessionId: string;
  sessionType: string;
  groupId: string;
  url: string;
  requestedLastModifiedTime: string;
  members: Members;
  breakoutRosterLocus: any;
  webex: any;
  request: any;

  /**
   * If the breakout has no name, assume it is the main session
   * @returns {boolean}
   */
  get isMain(): boolean {
    return this.sessionType === 'MAIN';
  }

  /**
   * initializer for the Breakout class
   * @param {any} attrs - Initial attributes
   * @param {any} options - Constructor options
   * @returns {void}
   */
  constructor(attrs = {}, options = {}) {
    // Call WebexPlugin constructor
    super(attrs, options);

    // Assign all attributes to instance properties
    Object.assign(this, attrs);

    this.breakoutRequest = new BreakoutRequest(attrs, options);
    this.breakoutRosterLocus = null;
  }

  /**
   * Joins the breakout session
   * @returns {Promise}
   */
  async join() {
    const breakoutMoveId = uuid.v4();
    const deviceUrl = this.webex.internal.device.url;
    const meeting = this.webex.meetings.getMeetingByType(_ID_, this.meetingId);
    breakoutEvent.onBreakoutMoveRequest(
      {currentSession: this, meeting, breakoutMoveId},
      this.webex.internal.newMetrics.submitClientEvent.bind(this.webex.internal.newMetrics)
    );
    const result = await this.request({
      method: HTTP_VERBS.POST,
      uri: `${this.url}/move`,
      body: {
        breakoutMoveId,
        deviceUrl,
        groupId: this.groupId,
        sessionId: this.sessionId,
      },
    });
    breakoutEvent.onBreakoutMoveResponse(
      {currentSession: this, meeting, breakoutMoveId},
      this.webex.internal.newMetrics.submitClientEvent.bind(this.webex.internal.newMetrics)
    );

    return result;
  }

  /**
   * Leaves the breakout session to return to the main session
   * @returns {Promise}
   * @throws {Error} if an attempt is made to leave the main session or if the main session cannot be found
   */
  leave() {
    if (this.isMain) {
      throw new Error('Cannot leave the main session');
    }
    const mainSession = this.webex.breakouts.filter((breakout) => breakout.isMain)[0];

    if (!mainSession) {
      throw new Error('Cannot leave, no main session found');
    }

    return mainSession.join();
  }

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
  }

  /**
   * inits the members object
   * @returns {void}
   */
  initMembers() {
    const meeting = this.webex.meetings.getMeetingByType(_ID_, this.meetingId);
    this.members = new Members(
      {
        meeting,
      },
      {parent: this.webex}
    );
  }

  /**
   * check sequence and determine whether to update the new roster or not
   * @param {Object} locus Locus object
   * @returns {Boolean}
   */
  isNeedHandleRoster(locus: any) {
    if (!this.breakoutRosterLocus?.sequence?.entries?.length || !locus?.sequence?.entries?.length) {
      return true;
    }
    const prevSequence = this.breakoutRosterLocus.sequence.entries[0];
    const currentSequence = locus.sequence.entries[0];

    return currentSequence > prevSequence;
  }

  /**
   * Parses the participants from the locus object
   * @param {Object} locus Locus object
   * @returns {void}
   */
  parseRoster(locus) {
    if (!this.members) {
      this.initMembers();
    }
    if (!this.isNeedHandleRoster(locus)) {
      return;
    }
    this.breakoutRosterLocus = locus;
    this.members.locusParticipantsUpdate(locus);
  }

  /**
   * Broadcast message to this breakout session's participants
   * @param {String} message
   * @param {Object} options
   * @returns {Promise}
   */
  broadcast(message, options) {
    return this.breakoutRequest.broadcast({
      url: this.url,
      message,
      options,
      groupId: this.groupId,
      sessionId: this.sessionId,
    });
  }
}

export default Breakout;
