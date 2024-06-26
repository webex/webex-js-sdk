/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {_MEETING_LINK_, _SIP_URI_, _PERSONAL_ROOM_} from '../constants';
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
      .then((info: Record<string, any>) => {
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
      .catch((error: Record<string, any>) => {
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
   * @param {{url: string} | string | null} destination
   * @param {string | null} type
   * @returns {Promise}
   * @private
   * @memberof MeetingInfo
   */
  private fetchInfoOptions(destination: {url: string} | string | null, type: string | null) {
    return MeetingInfoUtil.generateOptions({
      destination,
      type,
      webex: this.webex,
    });
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * Fetches meeting info from the server
   * @param {string} destination one of many different types of destinations to look up info for
   * @param {string | null} [type] to match up with the destination value
   * @param {string | null} [password] meeting password
   * @param {{
   *       code: string;
   *       id: string;
   *     } | null} [captchaInfo] captcha code and id
   * @param {string | null} [installedOrgID]
   * @param {string | null} [locusId]
   * @param {Record<string, any>} [extraParams]
   * @param {{meetingId?: string; sendCAevents?: boolean}} [options] meeting Id and whether Call Analyzer events should be sent
   * @returns {Promise} returns a meeting info object
   * @public
   * @memberof MeetingInfo
   */
  public fetchMeetingInfo(
    destination: string,
    type: string | null = null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    password: string | null = null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    captchaInfo: {
      code: string;
      id: string;
    } | null = null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    installedOrgID: string | null = null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    locusId: string | null = null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    extraParams: Record<string, any> = {},
    options: {meetingId?: string; sendCAevents?: boolean} = {}
  ) {
    if (type === _PERSONAL_ROOM_ && !destination) {
      destination = this.webex.internal.device.userId;
    }

    return this.fetchInfoOptions(MeetingInfoUtil.extractDestination(destination, type), type).then(
      (infoOptions) =>
        // fetch meeting info
        this.requestFetchInfo({...infoOptions, ...options}).catch((error: unknown) => {
          // if it failed the first time as meeting link
          if (infoOptions.type === _MEETING_LINK_) {
            // convert the meeting link to sip URI and retry
            return this.requestFetchInfo({
              ...this.fetchInfoOptions(MeetingInfoUtil.convertLinkToSip(destination), _SIP_URI_),
              ...options,
            });
          }

          return Promise.reject(error);
        })
    );
  }
}
