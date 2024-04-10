// @ts-ignore
import {StatelessWebexPlugin} from '@webex/webex-core';

import {ROAP} from '../constants';
import LoggerProxy from '../common/logs/logger-proxy';

import RoapRequest from './request';
import TurnDiscovery, {TurnDiscoveryResult} from './turnDiscovery';
import Meeting from '../meeting';
import MeetingUtil from '../meeting/util';
import Metrics from '../metrics';
import BEHAVIORAL_METRICS from '../metrics/constants';

export {
  type TurnDiscoveryResult,
  type TurnServerInfo,
  type TurnDiscoverySkipReason,
} from './turnDiscovery';

/**
 * Roap options
 * @typedef {Object} RoapOptions
 * @property {String} sdp
 * @property {Meeting} meeting
 * @property {Number} seq
 * @property {Number} tieBreaker
 *  @property {Boolean} reconnect
 */

/**
 * @typedef {Object} SeqOptions
 * @property {String} correlationId
 * @property {String} mediaId
 * @property {Number} seq
 */

/**
 * @class Roap
 * @export
 * @private
 */
export default class Roap extends StatelessWebexPlugin {
  attrs: any;
  lastRoapOffer: any;
  options: any;
  roapHandler: any;
  roapRequest: any;
  turnDiscovery: TurnDiscovery;

  /**
   *
   * @param {Object} attrs
   * @param {Object} options
   */
  constructor(attrs: any, options: any) {
    super({}, options);
    /**
     * @instance
     * @type {Object}
     * @private
     * @memberof Roap
     */
    this.attrs = attrs;
    /**
     * @instance
     * @type {Object}
     * @private
     * @memberof Roap
     */
    this.options = options;
    /**
     * The Roap Request Server Proxy Object
     * @instance
     * @type {RoapRequest}
     * @private
     * @memberof Roap
     */
    // @ts-ignore
    this.roapRequest = new RoapRequest({}, options);

    this.turnDiscovery = new TurnDiscovery(this.roapRequest);
  }

  /**
   *
   * @param {SeqOptions} options
   * @returns {null}
   * @memberof Roap
   */
  public sendRoapOK(options: any) {
    return Promise.resolve().then(() => {
      // @ts-ignore
      const meeting = this.webex.meetings.meetingCollection.getByKey(
        'correlationId',
        options.correlationId
      );
      const roapMessage = {
        messageType: ROAP.ROAP_TYPES.OK,
        version: ROAP.ROAP_VERSION,
        seq: options.seq,
      };

      LoggerProxy.logger.log(`Roap:index#sendRoapOK --> ROAP OK sending with seq ${options.seq}`);

      return this.roapRequest
        .sendRoap({
          roapMessage,
          locusSelfUrl: meeting.selfUrl,
          mediaId: options.mediaId,
          meetingId: meeting.id,
          locusMediaRequest: meeting.locusMediaRequest,
        })
        .then(() => {
          LoggerProxy.logger.log(`Roap:index#sendRoapOK --> ROAP OK sent with seq ${options.seq}`);
        });
    });
  }

  /**
   * Sends a ROAP answer...
   * @param {SeqOptions} options
   * @param {Boolean} options.audioMuted
   * @param {Boolean} options.videoMuted
   * @returns {Promise}
   * @memberof Roap
   */
  public sendRoapAnswer(options: any) {
    // @ts-ignore
    const meeting = this.webex.meetings.meetingCollection.getByKey(
      'correlationId',
      options.correlationId
    );
    const roapMessage = {
      messageType: ROAP.ROAP_TYPES.ANSWER,
      sdps: [options.sdp],
      version: ROAP.ROAP_VERSION,
      seq: options.seq,
    };

    return this.roapRequest.sendRoap({
      roapMessage,
      locusSelfUrl: meeting.selfUrl,
      mediaId: options.mediaId,
      meetingId: meeting.id,
      locusMediaRequest: meeting.locusMediaRequest,
    });
  }

  /**
   * Sends a ROAP error...
   * @param {Object} options
   * @returns {Promise}
   * @memberof Roap
   */
  sendRoapError(options) {
    // @ts-ignore
    const meeting = this.webex.meetings.meetingCollection.getByKey(
      'correlationId',
      options.correlationId
    );
    const roapMessage = {
      messageType: ROAP.ROAP_TYPES.ERROR,
      version: ROAP.ROAP_VERSION,
      errorType: options.errorType,
      seq: options.seq,
    };

    return this.roapRequest
      .sendRoap({
        roapMessage,
        locusSelfUrl: meeting.selfUrl,
        mediaId: options.mediaId,
        meetingId: meeting.id,
        locusMediaRequest: meeting.locusMediaRequest,
      })
      .then(() => {
        LoggerProxy.logger.log(
          `Roap:index#sendRoapError --> ROAP ERROR sent with seq ${options.seq}`
        );
      });
  }

  /**
   * sends a roap media request
   * @param {RoapOptions} options
   * @returns {Promise}
   * @memberof Roap
   */
  sendRoapMediaRequest(options: any) {
    const {meeting, seq, sdp, tieBreaker} = options;
    const roapMessage = {
      messageType: ROAP.ROAP_TYPES.OFFER,
      sdps: [sdp],
      version: ROAP.ROAP_VERSION,
      seq,
      tieBreaker,
      headers: ['includeAnswerInHttpResponse', 'noOkInTransaction'],
    };

    // The only time we want to send an empty media id is when we are reconnecting, because this way we tell Locus
    // that it needs to create a new confluence, but when reconnecting we always send TURN_DISCOVERY_REQUEST first,
    // so we don't need to ever send an empty media id here
    const sendEmptyMediaId = false;

    return this.roapRequest
      .sendRoap({
        roapMessage,
        locusSelfUrl: meeting.selfUrl,
        mediaId: sendEmptyMediaId ? '' : meeting.mediaId,
        meetingId: meeting.id,
        preferTranscoding: !meeting.isMultistream,
        locusMediaRequest: meeting.locusMediaRequest,
        ipVersion: MeetingUtil.getIpVersion(meeting.webex),
      })
      .then(({locus, mediaConnections}) => {
        if (mediaConnections) {
          meeting.updateMediaConnections(mediaConnections);
        }

        let roapAnswer;

        if (mediaConnections?.[0]?.remoteSdp) {
          const remoteSdp = JSON.parse(mediaConnections[0].remoteSdp);

          if (remoteSdp.roapMessage) {
            const {
              seq: answerSeq,
              messageType,
              sdps,
              errorType,
              errorCause,
              headers,
            } = remoteSdp.roapMessage;

            roapAnswer = {
              seq: answerSeq,
              messageType,
              sdp: sdps[0],
              errorType,
              errorCause,
              headers,
            };
          }
        }

        if (!roapAnswer) {
          Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.ROAP_HTTP_RESPONSE_MISSING, {
            correlationId: meeting.correlationId,
            messageType: 'ANSWER',
            isMultistream: meeting.isMultistream,
          });
        }

        return {locus, roapAnswer};
      });
  }

  /**
   * Performs a TURN server discovery procedure, which involves exchanging
   * some roap messages with the server. This exchange has to be done before
   * any other roap messages are sent
   *
   * @param {Meeting} meeting
   * @param {Boolean} isReconnecting should be set to true if this is a new
   *                                 media connection just after a reconnection
   * @param {Boolean} [isForced]
   * @returns {Promise}
   */
  doTurnDiscovery(
    meeting: Meeting,
    isReconnecting: boolean,
    isForced?: boolean
  ): Promise<TurnDiscoveryResult> {
    return this.turnDiscovery.doTurnDiscovery(meeting, isReconnecting, isForced);
  }

  generateTurnDiscoveryRequestMessage(meeting: Meeting, isForced: boolean) {
    return this.turnDiscovery.generateTurnDiscoveryRequestMessage(meeting, isForced);
  }

  handleTurnDiscoveryHttpResponse(meeting: Meeting, httpResponse: object) {
    return this.turnDiscovery.handleTurnDiscoveryHttpResponse(meeting, httpResponse);
  }

  abortTurnDiscovery() {
    return this.turnDiscovery.abort();
  }
}
