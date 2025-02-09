// @ts-ignore
import {StatelessWebexPlugin} from '@webex/webex-core';

import LoggerProxy from '../common/logs/logger-proxy';
import {IP_VERSION, REACHABILITY} from '../constants';
import {LocusMediaRequest} from '../meeting/locusMediaRequest';
import MeetingUtil from '../meeting/util';
import {ClientMediaPreferences} from '../reachability/reachability.types';

/**
 * @class RoapRequest
 */
export default class RoapRequest extends StatelessWebexPlugin {
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
    isMultistream: boolean;
    locusMediaRequest?: LocusMediaRequest;
  }) {
    const {roapMessage, locusSelfUrl, isMultistream, mediaId, locusMediaRequest} = options;

    if (!mediaId) {
      LoggerProxy.logger.info('Roap:request#sendRoap --> sending empty mediaID');
    }

    if (!locusMediaRequest) {
      LoggerProxy.logger.warn(
        'Roap:request#sendRoap --> locusMediaRequest unavailable, not sending roap'
      );

      return Promise.reject(new Error('sendRoap called when locusMediaRequest is undefined'));
    }

    let reachability;
    let clientMediaPreferences: ClientMediaPreferences = {
      // bare minimum fallback value that should allow us to join;
      joinCookie: undefined,
      ipver: IP_VERSION.unknown,
      preferTranscoding: !isMultistream,
    };

    try {
      clientMediaPreferences =
        // @ts-ignore
        await this.webex.meetings.reachability.getClientMediaPreferences(
          isMultistream,
          // @ts-ignore
          MeetingUtil.getIpVersion(this.webex)
        );
      reachability =
        // @ts-ignore
        await this.webex.meetings.reachability.getReachabilityReportToAttachToRoap();
    } catch (error) {
      LoggerProxy.logger.error('Roap:request#sendRoap --> reachability error:', error);
    }

    LoggerProxy.logger.info(
      `Roap:request#sendRoap --> ${roapMessage.messageType} seq:${roapMessage.seq} ${
        clientMediaPreferences?.ipver ? `ipver=${clientMediaPreferences?.ipver} ` : ''
      } ${locusSelfUrl}`
    );

    return locusMediaRequest
      .send({
        type: 'RoapMessage',
        selfUrl: locusSelfUrl,
        mediaId,
        roapMessage,
        reachability,
        clientMediaPreferences,
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
