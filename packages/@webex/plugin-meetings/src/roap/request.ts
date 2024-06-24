// @ts-ignore
import {StatelessWebexPlugin} from '@webex/webex-core';

import LoggerProxy from '../common/logs/logger-proxy';
import {IP_VERSION, REACHABILITY} from '../constants';
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
  async attachReachabilityData(localSdp: Record<string, any>) {
    let joinCookie;

    // @ts-ignore
    const reachabilityResult = await this.webex.meetings.reachability.getReachabilityResults();

    if (reachabilityResult && Object.keys(reachabilityResult).length) {
      localSdp.reachability = reachabilityResult;
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
   * @param {IP_VERSION} options.ipVersion only required for offers
   * @returns {Promise} returns the response/failure of the request
   */
  async sendRoap(options: {
    roapMessage: any;
    locusSelfUrl: string;
    mediaId: string;
    meetingId: string;
    ipVersion?: IP_VERSION;
    locusMediaRequest?: LocusMediaRequest;
  }) {
    const {roapMessage, locusSelfUrl, mediaId, locusMediaRequest, ipVersion} = options;

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

    return locusMediaRequest
      .send({
        type: 'RoapMessage',
        selfUrl: locusSelfUrl,
        joinCookie,
        mediaId,
        roapMessage,
        reachability: localSdpWithReachabilityData.reachability,
        ipVersion,
      })
      .then((res) => {
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
        LoggerProxy.logger.error(`Roap:request#sendRoap --> Error:`, err);
        LoggerProxy.logger.error(
          `Roap:request#sendRoapRequest --> roapMessage that caused error:${JSON.stringify(
            roapMessage,
            null,
            2
          )} + '\\n mediaId:'${options.mediaId}`
        );
        throw err;
      });
  }
}
