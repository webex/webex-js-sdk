/* global window */
// @ts-ignore
import {StatelessWebexPlugin} from '@webex/webex-core';

import LoggerProxy from '../common/logs/logger-proxy';
import {MEDIA, HTTP_VERBS, REACHABILITY} from '../constants';
import Metrics from '../metrics';
import {eventType} from '../metrics/config';

/**
 * @class RoapRequest
 */
export default class RoapRequest extends StatelessWebexPlugin {
  /**
   * Returns reachability data.
   * @param {Object} localSdp
   * @returns {Object}
   */
  async attachReachabilityData(localSdp) {
    let joinCookie;

    // @ts-ignore
    const reachabilityData = await this.webex.boundedStorage
      .get(REACHABILITY.namespace, REACHABILITY.localStorageResult)
      .catch(() => {});

    if (reachabilityData) {
      try {
        const reachabilityResult = JSON.parse(reachabilityData);

        /* istanbul ignore else */
        if (reachabilityResult && Object.keys(reachabilityResult).length) {
          localSdp.reachability = reachabilityResult;
        }
      } catch (e) {
        LoggerProxy.logger.error(
          `Roap:request#attachReachabilityData --> Error in parsing reachability data: ${e}`
        );
      }
    }

    // @ts-ignore
    const joinCookieRaw = await this.webex.boundedStorage
      .get(REACHABILITY.namespace, REACHABILITY.localStorageJoinCookie)
      .catch(() => {});

    if (joinCookieRaw) {
      try {
        joinCookie = JSON.parse(joinCookieRaw);
      } catch (e) {
        LoggerProxy.logger.error(
          `MeetingRequest#constructor --> Error in parsing join cookie data: ${e}`
        );
      }
    }

    return {localSdp, joinCookie};
  }

  /**
   * Sends a ROAP message
   * @param {Object} options
   * @param {Object} options.roapMessage
   * @param {String} options.locusSelfUrl
   * @param {String} options.mediaId
   * @param {String} options.correlationId
   * @param {Boolean} options.audioMuted
   * @param {Boolean} options.videoMuted
   * @param {String} options.meetingId
   * @param {Boolean} options.preferTranscoding
   * @returns {Promise} returns the response/failure of the request
   */
  async sendRoap(options: {
    roapMessage: any;
    locusSelfUrl: string;
    mediaId: string;
    correlationId: string;
    audioMuted: boolean;
    videoMuted: boolean;
    meetingId: string;
    preferTranscoding?: boolean;
  }) {
    const {roapMessage, locusSelfUrl, mediaId, correlationId, meetingId} = options;

    if (!mediaId) {
      LoggerProxy.logger.info('Roap:request#sendRoap --> Race Condition /call mediaID not present');
    }

    const {localSdp: localSdpWithReachabilityData, joinCookie} = await this.attachReachabilityData({
      roapMessage,
      // eslint-disable-next-line no-warning-comments
      // TODO: check whats the need for video and audiomute
      audioMuted: !!options.audioMuted,
      videoMuted: !!options.videoMuted,
    });

    const mediaUrl = `${locusSelfUrl}/${MEDIA}`;
    // @ts-ignore
    const deviceUrl = this.webex.internal.device.url;

    LoggerProxy.logger.info(
      `Roap:request#sendRoap --> ${mediaUrl} \n ${roapMessage.messageType} \n seq:${roapMessage.seq}`
    );

    Metrics.postEvent({event: eventType.MEDIA_REQUEST, meetingId});

    // @ts-ignore
    return this.request({
      uri: mediaUrl,
      method: HTTP_VERBS.PUT,
      body: {
        device: {
          url: deviceUrl,
          // @ts-ignore
          deviceType: this.config.meetings.deviceType,
        },
        correlationId,
        localMedias: [
          {
            localSdp: JSON.stringify(localSdpWithReachabilityData),
            mediaId: options.mediaId,
          },
        ],
        clientMediaPreferences: {
          preferTranscoding: options.preferTranscoding ?? true,
          joinCookie,
        },
      },
    })
      .then((res) => {
        Metrics.postEvent({event: eventType.MEDIA_RESPONSE, meetingId});

        // always it will be the first mediaConnection Object
        const mediaConnections =
          res.body.mediaConnections &&
          res.body.mediaConnections.length > 0 &&
          res.body.mediaConnections[0];

        LoggerProxy.logger.debug(
          `Roap:request#sendRoap --> response:${JSON.stringify(
            mediaConnections,
            null,
            2
          )}'\n StatusCode:'${res.statusCode}`
        );
        const {locus} = res.body;

        locus.roapSeq = options.roapMessage.seq;

        return {
          locus,
          ...(mediaConnections && {mediaConnections: res.body.mediaConnections}),
        };
      })
      .catch((err) => {
        Metrics.postEvent({
          event: eventType.MEDIA_RESPONSE,
          meetingId,
          data: {error: Metrics.parseLocusError(err, true)},
        });
        LoggerProxy.logger.error(`Roap:request#sendRoap --> Error:${JSON.stringify(err, null, 2)}`);
        LoggerProxy.logger.error(
          `Roap:request#sendRoapRequest --> errorBody:${JSON.stringify(
            roapMessage,
            null,
            2
          )} + '\\n mediaId:'${options.mediaId}`
        );
        throw err;
      });
  }
}
