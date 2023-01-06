// @ts-ignore
import {StatelessWebexPlugin} from '@webex/webex-core';

import {ROAP} from '../constants';
import LoggerProxy from '../common/logs/logger-proxy';

import RoapRequest from './request';
import TurnDiscovery from './turnDiscovery';
import Meeting from '../meeting';

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
  turnDiscovery: any;

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
      const meeting = this.webex.meetings.meetingCollection.getByKey('correlationId', options.correlationId);
      const roapMessage = {
        messageType: ROAP.ROAP_TYPES.OK,
        version: ROAP.ROAP_VERSION,
        seq: options.seq
      };

      LoggerProxy.logger.log(`Roap:index#sendRoapOK --> ROAP OK sending with seq ${options.seq}`);

      return this.roapRequest
        .sendRoap({
          roapMessage,
          locusSelfUrl: meeting.selfUrl,
          mediaId: options.mediaId,
          correlationId: options.correlationId,
          audioMuted: meeting.isAudioMuted(),
          videoMuted: meeting.isVideoMuted(),
          meetingId: meeting.id,
          preferTranscoding: !meeting.isMultistream,
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
    const meeting = this.webex.meetings.meetingCollection.getByKey('correlationId', options.correlationId);
    const roapMessage = {
      messageType: ROAP.ROAP_TYPES.ANSWER,
      sdps: [options.sdp],
      version: ROAP.ROAP_VERSION,
      seq: options.seq
    };

    return this.roapRequest
      .sendRoap({
        roapMessage,
        locusSelfUrl: meeting.selfUrl,
        mediaId: options.mediaId,
        correlationId: options.correlationId,
        audioMuted: meeting.isAudioMuted(),
        videoMuted: meeting.isVideoMuted(),
        meetingId: meeting.id,
        preferTranscoding: !meeting.isMultistream,
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
    const meeting = this.webex.meetings.meetingCollection.getByKey('correlationId', options.correlationId);
    const roapMessage = {
      messageType: ROAP.ROAP_TYPES.ERROR,
      version: ROAP.ROAP_VERSION,
      errorType: options.errorType,
      seq: options.seq

    };

    return this.roapRequest.sendRoap({
      roapMessage,
      locusSelfUrl: meeting.selfUrl,
      mediaId: options.mediaId,
      correlationId: options.correlationId,
      audioMuted: meeting.isAudioMuted(),
      videoMuted: meeting.isVideoMuted(),
      meetingId: meeting.id,
      preferTranscoding: !meeting.isMultistream,
    })
      .then(() => {
        LoggerProxy.logger.log(`Roap:index#sendRoapError --> ROAP ERROR sent with seq ${options.seq}`);
      });
  }

  /**
   * sends a roap media request
   * @param {RoapOptions} options
   * @returns {Promise}
   * @memberof Roap
   */
  sendRoapMediaRequest(options: any) {
    const {
      meeting, seq, sdp, reconnect, tieBreaker
    } = options;
    const roapMessage = {
      messageType: ROAP.ROAP_TYPES.OFFER,
      sdps: [sdp],
      version: ROAP.ROAP_VERSION,
      seq,
      tieBreaker
    };

    // When reconnecting, it's important that the first roap message being sent out has empty media id.
    // Normally this is the roap offer, but when TURN discovery is enabled,
    // then this is the TURN discovery request message
    const sendEmptyMediaId = reconnect && !meeting.config.experimental.enableTurnDiscovery;

    return this.roapRequest
      .sendRoap({
        roapMessage,
        correlationId: meeting.correlationId,
        locusSelfUrl: meeting.selfUrl,
        mediaId: sendEmptyMediaId ? '' : meeting.mediaId,
        audioMuted: meeting.isAudioMuted(),
        videoMuted: meeting.isVideoMuted(),
        meetingId: meeting.id,
        preferTranscoding: !meeting.isMultistream,
      })
      .then(({locus, mediaConnections}) => {
        if (mediaConnections) {
          meeting.updateMediaConnections(mediaConnections);
        }

        return locus;
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
   * @returns {Promise}
   */
  doTurnDiscovery(meeting: Meeting, isReconnecting: boolean) {
    return this.turnDiscovery.doTurnDiscovery(meeting, isReconnecting);
  }
}
