/* global window */
// @ts-ignore
import {StatelessWebexPlugin} from '@webex/webex-core';

import LoggerProxy from '../common/logs/logger-proxy';
import {REACHABILITY} from '../constants';
import Metrics from '../metrics';
import {eventType} from '../metrics/config';
import {LocusMediaRequest} from '../meeting/locusMediaRequest';

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
   * @param {String} options.meetingId
   * @returns {Promise} returns the response/failure of the request
   */
  async sendRoap(options: {
    roapMessage: any;
    locusSelfUrl: string;
    mediaId: string;
    meetingId: string;
    locusMediaRequest?: LocusMediaRequest;
  }) {
    const {roapMessage, locusSelfUrl, mediaId, meetingId, locusMediaRequest} = options;

    if (!mediaId) {
      LoggerProxy.logger.info('Roap:request#sendRoap --> sending empty mediaID');
    }

    if (!locusMediaRequest) {
      LoggerProxy.logger.warn(
        'Roap:request#sendRoap --> locusMediaRequest unavailable, not sending roap'
      );

      return Promise.reject(new Error('sendRoap called when locusMediaRequest is undefined'));
    }
    const {localSdp: localSdpWithReachabilityData, joinCookie} = await this.attachReachabilityData({
      roapMessage,
    });

    LoggerProxy.logger.info(
      `Roap:request#sendRoap --> ${locusSelfUrl} \n ${roapMessage.messageType} \n seq:${roapMessage.seq}`
    );

    Metrics.postEvent({event: eventType.MEDIA_REQUEST, meetingId});

    return locusMediaRequest
      .send({
        type: 'RoapMessage',
        selfUrl: locusSelfUrl,
        joinCookie,
        mediaId,
        roapMessage,
        reachability: localSdpWithReachabilityData.reachability,
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
