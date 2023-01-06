/* global window */
// @ts-ignore
import {StatelessWebexPlugin} from '@webex/webex-core';

import LoggerProxy from '../common/logs/logger-proxy';
import {PARTICIPANT, LOCI, CALL, MEDIA, HTTP_VERBS, REACHABILITY} from '../constants';
import Metrics from '../metrics';
import {eventType} from '../metrics/config';
import ParameterError from '../common/errors/parameter';
/**
 * @class RoapRequest
 */
export default class RoapRequest extends StatelessWebexPlugin {
  /**
   * Joins a meeting via ROAP
   * @param {Object} options
   * @returns {Promise} returns a promise that resolves/rejects whatever the request does
   */

  attachRechabilityData(localSdp) {
    const reachabilityData = window.localStorage.getItem(REACHABILITY.localStorage);

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

    return localSdp;
  }

  joinMeetingWithRoap(options) {
    LoggerProxy.logger.info('Roap:request#joinMeetingWithRoap --> Join locus with roap');
    LoggerProxy.logger.info(
      `Roap:request#joinMeetingWithRoap --> Local SDP: ${options.roapMessage}`
    );

    return Promise.resolve().then(async () => {
      // @ts-ignore
      const deviceUrl = this.webex.internal.device.url;
      let url = '';

      const body: any = {
        deviceUrl,
        usingResource: options.resourceId || null,
        correlationId: options.correlationId,
        localMedias: [
          {
            localSdp: JSON.stringify(
              this.attachRechabilityData({
                roapMessage: options.roapMessage,
                audioMuted: false,
                videoMuted: false,
              })
            ),
          },
        ],
        clientMediaPreferences: {
          preferTranscoding: options.preferTranscoding ?? true,
        },
      };

      if (options.locusUrl) {
        url = `${options.locusUrl}/${PARTICIPANT}`;
      } else if (options.sipUrl) {
        try {
          // @ts-ignore
          await this.webex.internal.services.waitForCatalog('postauth');
          // @ts-ignore
          url = `${this.webex.internal.services.get('locus')}/${LOCI}/${CALL}`;
          body.invitee = {
            address: options.sipTarget,
          };
        } catch (e) {
          LoggerProxy.logger.error(`Roap:request#joinMeetingWithRoap --> ${e}`);
          throw e;
        }
      } else {
        throw new ParameterError('Must provide a locusUrl or sipTarget');
      }

      // @ts-ignore
      return this.webex
        .request({
          method: HTTP_VERBS.POST,
          uri: url,
          body,
        })
        .then((res) => {
          const {locus} = res.body;

          locus.roapSeq = options.roapMessage.seq;
          locus.id = locus.url.split('/').pop();
          LoggerProxy.logger.info(
            `Roap:request#joinMeetingWithRoap --> Joined locus [${locus.id}][${locus.fullState.lastActive}]`
          );

          return locus;
        })
        .catch((err) => {
          LoggerProxy.logger.error(
            `Roap:request#joinMeetingWithRoap --> failed with error: ${err}`
          );
          throw err;
        });
    });
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
   * @returns {Promise} returns the response/failure of the request
   */
  sendRoap(options: {
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

    const mediaUrl = `${locusSelfUrl}/${MEDIA}`;
    // @ts-ignore
    const deviceUrl = this.webex.internal.device.url;

    LoggerProxy.logger.info(
      `Roap:request#sendRoap --> ${mediaUrl} \n ${roapMessage.messageType} \n seq:${roapMessage.seq}`
    );

    Metrics.postEvent({event: eventType.MEDIA_REQUEST, meetingId});

    // @ts-ignore
    return this.webex
      .request({
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
              localSdp: JSON.stringify(
                this.attachRechabilityData({
                  roapMessage,
                  // eslint-disable-next-line no-warning-comments
                  // TODO: check whats the need for video and audiomute
                  audioMuted: !!options.audioMuted,
                  videoMuted: !!options.videoMuted,
                })
              ),
              mediaId: options.mediaId,
            },
          ],
          clientMediaPreferences: {
            preferTranscoding: options.preferTranscoding ?? true,
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

        LoggerProxy.logger.info(
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
