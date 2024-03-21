// @ts-ignore
import {StatelessWebexPlugin} from '@webex/webex-core';

import {MEETINGS, _PERSONAL_ROOM_} from '../constants';
import ParameterError from '../common/errors/parameter';

import PersonalMeetingRoomRequest from './request';

/**
 * @class PersonalMeetingRoom
 */
export default class PersonalMeetingRoom extends StatelessWebexPlugin {
  link: any;
  meetingInfo: any;
  name: any;
  personalMeetingRoomRequest: any;
  pmr: any;
  sipUri: any;
  userId: any;
  meetingLink: any;
  number: any;

  namespace = MEETINGS;

  /**
   *
   * @param {Object} attrs
   * @param {Object} options
   */
  constructor(attrs: any, options: any) {
    super({}, options);
    /**
     * The pmr server object
     * @instance
     * @type {Object}
     * @public
     * @memberof PersonalMeetingRoom
     */
    this.pmr = null;
    /**
     * The pmr sip Uri
     * @instance
     * @type {String}
     * @public
     * @memberof PersonalMeetingRoom
     */
    this.sipUri = null;
    /**
     * The pmr link
     * @instance
     * @type {String}
     * @public
     * @memberof PersonalMeetingRoom
     */
    this.link = null;
    /**
     * The pmr server object
     * @instance
     * @type {Object}
     * @public
     * @memberof PersonalMeetingRoom
     */
    this.userId = null;
    /**
     * The pmr name
     * @instance
     * @type {String}
     * @public
     * @memberof PersonalMeetingRoom
     */
    this.name = null;
    /**
     * The meeting info request server interface
     * @instance
     * @type {MeetingInfo}
     * @private
     * @memberof PersonalMeetingRoom
     */
    this.meetingInfo = attrs.meetingInfo;
    /**
     * The pmr server request interface
     * @instance
     * @type {Object}
     * @private
     * @memberof PersonalMeetingRoom
     */
    // @ts-ignore
    this.personalMeetingRoomRequest = new PersonalMeetingRoomRequest({}, options);
  }

  /**
   * claims a pmr and updates the cached PMR values
   * @param {String} link
   * @param {String} pin
   * @param {Boolean} [preferred] defaults to true to set this claimed PMR as the preferred
   * @returns {Promise}
   * @public
   * @memberof PersonalMeetingRoom
   */
  public claim(link: string, pin: string, preferred = true) {
    const options = {
      // @ts-ignore
      userId: this.webex.internal.device.userId,
      passcode: pin,
      meetingAddress: link,
      preferred,
    };

    return this.personalMeetingRoomRequest.claimPmr(options).then((pmr) => {
      if (pmr && pmr.body) {
        this.set(pmr.body);
      } else {
        return Promise.reject(new ParameterError('No PMR body provided. PMR values not updated.'));
      }

      return pmr.body;
    });
  }

  /**
   * @param {Object} body the response body from meeting info request
   * @returns {undefined}
   * @private
   * @memberof PersonalMeetingRoom
   */
  private set(body: any) {
    this.pmr = body;
    this.sipUri = body.sipMeetingUri;
    this.meetingLink = body.webExMeetingLink || body.meetingLink;
    this.userId = body.owner;
    this.name = body.meetingName;
    this.number = body.meetingNumber;
  }

  /**
   * TODO: implement TTL for syncing and caching so to not request again and again
   * @param {Object} options
   * @returns {Promise}
   * @public
   * @memberof PersonalMeetingRoom
   */
  public get() {
    const options = {
      type: _PERSONAL_ROOM_,
    };

    return this.meetingInfo.fetchMeetingInfo(options).then((pmr) => {
      if (pmr && pmr.body && pmr.body.isPmr) {
        this.set(pmr.body);
      } else {
        return Promise.reject(new TypeError('The PMR requested is NOT a PMR. PMR values not set.'));
      }

      return pmr.body;
    });
  }
}
