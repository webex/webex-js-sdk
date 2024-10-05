/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {DESTINATION_TYPE} from '../constants';
import LoggerProxy from '../common/logs/logger-proxy';

import MeetingInfoCollection from './collection';
import MeetingInfoRequest from './request';
import MeetingInfoUtil from './util';

/**
 * @class MeetingInfo
 */
export default class MeetingInfo {
  meetingInfoCollection: any;
  meetingInfoRequest: any;
  webex: any;

  /**
   *
   * @param {WebexSDK} webex
   */
  constructor(webex: any) {
    this.webex = webex;

    /**
     * The meeting info request server interface
     * @instance
     * @type {Object}
     * @private
     * @memberof MeetingInfo
     */
    this.meetingInfoRequest = new MeetingInfoRequest(this.webex);
    /**
     * The meeting information collection interface
     * @instance
     * @type {Object}
     * @private
     * @memberof MeetingInfo
     */
    this.meetingInfoCollection = new MeetingInfoCollection();
  }

  /**
   * @param {string} id
   * @returns {object}
   * @public
   * @memberof MeetingInfo
   */
  public getMeetingInfo(id: string) {
    return this.meetingInfoCollection.get(id);
  }

  /**
   * @param {string} id
   * @param {object} info
   * @returns {null}
   * @public
   * @memberof MeetingInfo
   */
  public setMeetingInfo(id: string, info: object) {
    this.meetingInfoCollection.set(id, info);
  }

  /**
   * Helper to make the actual MeetingInfo request and set the meetingInfo if successful, else reject
   * @param {Object} options
   * @returns {Promise}
   * @private
   * @memberof MeetingInfo
   */
  private requestFetchInfo(options: any) {
    const {meetingId, sendCAevents} = options;
    if (meetingId && sendCAevents) {
      this.webex.internal.newMetrics.submitInternalEvent({
        name: 'internal.client.meetinginfo.request',
      });
      this.webex.internal.newMetrics.submitClientEvent({
        name: 'client.meetinginfo.request',
        options: {
          meetingId,
        },
      });
    }

    return this.meetingInfoRequest
      .fetchMeetingInfo(options)
      .then((info) => {
        if (meetingId && sendCAevents) {
          this.webex.internal.newMetrics.submitInternalEvent({
            name: 'internal.client.meetinginfo.response',
          });
          this.webex.internal.newMetrics.submitClientEvent({
            name: 'client.meetinginfo.response',
            payload: {
              identifiers: {
                meetingLookupUrl: info?.url,
              },
            },
            options: {
              meetingId,
              webexConferenceIdStr: info?.body?.confIdStr || info?.body?.confID,
              globalMeetingId: info?.body?.meetingId,
            },
          });
        }
        if (info && info.body) {
          this.setMeetingInfo(info.body.sipMeetingUri || info.body.meetingLink, info.body);
        }

        return info;
      })
      .catch((error) => {
        LoggerProxy.logger.error(
          `Meeting-info:index#requestFetchInfo -->  ${error} fetch meetingInfo`
        );
        if (meetingId && sendCAevents) {
          this.webex.internal.newMetrics.submitInternalEvent({
            name: 'internal.client.meetinginfo.response',
          });
          this.webex.internal.newMetrics.submitClientEvent({
            name: 'client.meetinginfo.response',
            payload: {
              identifiers: {
                meetingLookupUrl: error?.url,
              },
            },
            options: {
              meetingId,
              rawError: error,
            },
          });
        }

        return Promise.reject(error);
      });
  }

  /**
   * Helper to generate the options for the MeetingInfo request
   * @param {String} destination
   * @param {String} type
   * @returns {Promise}
   * @private
   * @memberof MeetingInfo
   */
  private fetchInfoOptions(destination: string, type: string) {
    return MeetingInfoUtil.generateOptions({
      destination,
      type,
      webex: this.webex,
    });
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * Fetches meeting info from the server
   * @param {String} destination one of many different types of destinations to look up info for
   * @param {DESTINATION_TYPE} [type] to match up with the destination value
   * @param {String} [password] meeting password
   * @param {Object} [captchaInfo] captcha code and id
   * @param {String} [installedOrgID]
   * @param {String} [locusId]
   * @param {Object} [extraParams]
   * @param {Boolean} [options] meeting Id and whether Call Analyzer events should be sent
   * @returns {Promise} returns a meeting info object
   * @public
   * @memberof MeetingInfo
   */
  public fetchMeetingInfo(
    destination: string,
    type: DESTINATION_TYPE = null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    password: string = null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    captchaInfo: {
      code: string;
      id: string;
    } = null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    installedOrgID = null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    locusId = null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    extraParams: object = {},
    options: {meetingId?: string; sendCAevents?: boolean} = {}
  ) {
    if (type === DESTINATION_TYPE.PERSONAL_ROOM && !destination) {
      destination = this.webex.internal.device.userId;
    }

    return this.fetchInfoOptions(MeetingInfoUtil.extractDestination(destination, type), type).then(
      (infoOptions) =>
        // fetch meeting info
        this.requestFetchInfo({...infoOptions, ...options}).catch((error) => {
          // if it failed the first time as meeting link
          if (infoOptions.type === DESTINATION_TYPE.MEETING_LINK) {
            // convert the meeting link to sip URI and retry
            return this.requestFetchInfo({
              ...this.fetchInfoOptions(
                MeetingInfoUtil.convertLinkToSip(destination),
                DESTINATION_TYPE.SIP_URI
              ),
              ...options,
            });
          }

          return Promise.reject(error);
        })
    );
  }
}
