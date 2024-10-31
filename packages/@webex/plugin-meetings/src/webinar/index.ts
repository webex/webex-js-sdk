/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */
import {WebexPlugin} from '@webex/webex-core';
import {get} from 'lodash';
import {MEETINGS, SELF_ROLES} from '../constants';

import WebinarCollection from './collection';

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
    webcastUrl: 'string', // current webinar's webcast url
    webinarAttendeesSearchingUrl: 'string', // current webinarAttendeesSearching url
    canManageWebcast: 'boolean', // appears the ability to manage webcast
    selfIsPanelist: 'boolean', // self is panelist
    selfIsAttendee: 'boolean', // self is attendee
  },

  /**
   * Update the current locus url of the webinar
   * @param {string} locusUrl // locus url
   * @returns {void}
   */
  locusUrlUpdate(locusUrl) {
    this.set('locusUrl', locusUrl);
  },

  /**
   * Update the current webcast url of the meeting
   * @param {string} webcastUrl // webcast url
   * @returns {void}
   */
  webcastUrlUpdate(webcastUrl) {
    this.set('webcastUrl', webcastUrl);
  },

  /**
   * Update the current webinarAttendeesSearching url of the meeting
   * @param {string} webinarAttendeesSearchingUrl // webinarAttendeesSearching url
   * @returns {void}
   */
  webinarAttendeesSearchingUrlUpdate(webinarAttendeesSearchingUrl) {
    this.set('webinarAttendeesSearchingUrl', webinarAttendeesSearchingUrl);
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
   * Update whether self has capability to manage start/stop webcast (only host can manage it)
   * @param {object} payload
   * @returns {void}
   */
  updateRoleChanged(payload) {
    const isPromoted =
      get(payload, 'oldRoles', []).includes(SELF_ROLES.ATTENDEE) &&
      get(payload, 'newRoles', []).includes(SELF_ROLES.PANELIST);
    const isDemoted =
      get(payload, 'oldRoles', []).includes(SELF_ROLES.PANELIST) &&
      get(payload, 'newRoles', []).includes(SELF_ROLES.ATTENDEE);
    this.set('selfIsPanelist', get(payload, 'newRoles', []).includes(SELF_ROLES.PANELIST));
    this.set('selfIsAttendee', get(payload, 'newRoles', []).includes(SELF_ROLES.ATTENDEE));
    this.updateCanManageWebcast(payload.newRoles?.includes(SELF_ROLES.MODERATOR));
  },
});

export default Webinar;
