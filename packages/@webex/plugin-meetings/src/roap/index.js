import {StatelessWebexPlugin} from '@webex/webex-core';

import {ROAP} from '../constants';
import LoggerProxy from '../common/logs/logger-proxy';
import MeetingUtil from '../meeting/util';

import RoapHandler from './handler';
import RoapRequest from './request';
import RoapCollection from './collection';

/**
 * Roap options
 * @typedef {Object} RoapOptions
 * @property {String} sdp
 * @property {Meeting} meeting
 * @property {Number} roapSeq
 * @property {Boolean} reconnect
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
  /**
   *
   * @param {Object} attrs
   * @param {Object} options
   */
  constructor(attrs, options) {
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
     * The Roap Process State Handler
     * @instance
     * @type {RoapHandler}
     * @private
     * @memberof Roap
     */
    this.roapHandler = new RoapHandler(this.attrs, this.options, this.sendRoapOK.bind(this), this.sendRoapAnswer.bind(this), this.roapFinished.bind(this));
    /**
     * The Roap Request Server Proxy Object
     * @instance
     * @type {RoapRequest}
     * @private
     * @memberof Roap
     */
    this.roapRequest = new RoapRequest({}, options);
    /**
     * The last roap offer sent to server and acked
     * @instance
     * @type {Object}
     * @private
     * @memberof Roap
     */
    this.lastRoapOffer = {};
  }

  /**
   * Starts listening to mercury events for Roap messages
   * @param {object} data event object
   * @returns {Promise}
   * @private
   * @memberof Roap
   */
  roapEvent(data) {
    const msg = data.message;
    const {correlationId} = data;

    LoggerProxy.logger.log(`Roap:index#roapEvent --> Received Roap Message [${JSON.stringify(msg, null, 2)}]`);
    this.roapHandler.submit({
      type: ROAP.RECEIVE_ROAP_MSG,
      msg,
      correlationId
    });
  }

  /**
   *
   * @param {String} correlationId correlation id of a meeting
   * @param {Number} seq ROAP sequence number
   * @returns {Promise}
   * @private
   * @memberof Roap
   */
  stop(correlationId, seq) {
    this.roapHandler.submit({
      type: ROAP.RECEIVE_CALL_LEAVE,
      seq,
      correlationId
    });

    return Promise.resolve();
  }

  /**
   *
   * @param {SeqOptions} options
   * @returns {null}
   * @private
   * @memberof Roap
   */
  sendRoapOK(options) {
    return Promise.resolve().then(() => {
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
          meetingId: meeting.id
        })
        .then(() => {
          this.roapHandler.submit({
            type: ROAP.SEND_ROAP_MSG,
            msg: roapMessage,
            correlationId: options.correlationId
          });
          LoggerProxy.logger.log(`Roap:index#sendRoapOK --> ROAP OK sent with seq ${options.seq}`);
          meeting.setRoapSeq(options.seq);
        });
    });
  }

  // eslint-disable-next-line no-warning-comments
  // TODO: try to merge sendRoapOk and roapAnswer
  /**
   * Sends a ROAP answer...
   * @param {SeqOptions} options
   * @param {Boolean} options.audioMuted
   * @param {Boolean} options.videoMuted
   * @returns {Promise}
   * @private
   * @memberof Roap
   */
  sendRoapAnswer(options) {
    const meeting = this.webex.meetings.meetingCollection.getByKey('correlationId', options.correlationId);
    const roapMessage = {
      messageType: ROAP.ROAP_TYPES.ANSWER,
      sdps: options.sdps,
      version: ROAP.ROAP_VERSION,
      seq: options.seq
    };

    this.roapHandler.submit({
      type: ROAP.SEND_ROAP_MSG,
      msg: roapMessage,
      correlationId: options.correlationId
    });

    return this.roapRequest
      .sendRoap({
        roapMessage,
        locusSelfUrl: meeting.selfUrl,
        mediaId: options.mediaId,
        correlationId: options.correlationId,
        audioMuted: options.audioMuted,
        videoMuted: options.videoMuted,
        meetingId: meeting.id
      })
      .then(() => {
        meeting.setRoapSeq(options.seq);

        this.roapHandler.submit({
          type: ROAP.SEND_ROAP_MSG_SUCCESS,
          seq: roapMessage.seq,
          correlationId: meeting.correlationId
        });
      });
  }

  /**
   * Sends a ROAP error...
   * @param {Object} session
   * @param {Object} locus
   * @param {String} errorType
   * @returns {Promise}
   * @private
   * @memberof Roap
   */
  sendRoapError(session, locus, errorType) {
    const msg = {
      messageType: ROAP.ROAP_TYPES.ERROR,
      version: ROAP.ROAP_VERSION,
      errorType,
      seq: session.OFFER.seq
    };

    return this.roapRequest.sendRoap(msg, locus);
  }

  /**
   * sends a roap media request
   * @param {RoapOptions} options
   * @returns {Promise}
   * @private
   * @memberof Roap
   */
  sendRoapMediaRequest(options) {
    const {meeting, reconnect} = options;
    const roapMessage = {
      messageType: ROAP.ROAP_TYPES.OFFER,
      sdps: [options.sdp],
      // sdps: [options.sdp],
      version: ROAP.ROAP_VERSION,
      seq: typeof options.roapSeq !== 'number' && Number.isNaN(parseFloat(options.roapSeq)) ? 0 : options.roapSeq + 1,
      tieBreaker: 4294967294 // Math.floor(Math.random() * (2 ** 32) - 1) // TODO: Handle the roap  conflict scenario
    };

    this.roapHandler.submit({
      type: ROAP.SEND_ROAP_MSG,
      msg: roapMessage,
      correlationId: meeting.correlationId
    });

    return this.roapRequest
      .sendRoap({
        roapMessage,
        correlationId: meeting.correlationId,
        locusSelfUrl: meeting.selfUrl,
        mediaId: reconnect ? '' : meeting.mediaId,
        audioMuted: meeting.isAudioMuted(),
        videoMuted: meeting.isVideoMuted(),
        meetingId: meeting.id
      })
      .then(({locus, mediaConnections}) => {
        this.roapHandler.submit({
          type: ROAP.SEND_ROAP_MSG_SUCCESS,
          seq: roapMessage.seq,
          correlationId: meeting.correlationId
        });
        meeting.setRoapSeq(roapMessage.seq);

        if (mediaConnections) {
          meeting.updateMediaConnections(mediaConnections);
        }

        // eslint-disable-next-line no-warning-comments
        // TODO: we need to attach peerconenction to locus not sure if we need to pass everything here
        return locus;
        // eslint-disable-next-line no-warning-comments
        // TODO: check where to update the sequence number
      });
  }

  /**
   * sends a roap media request
   * @param {RoapOptions} options
   * @returns {Promise}
   * @private
   * @memberof Roap
   */
  sendRoapCallRequest = (options) => {
    const {meeting} = options;
    const roapMessage = {
      messageType: ROAP.ROAP_TYPES.OFFER,
      sdps: [options.sdp],
      version: ROAP.ROAP_VERSION,
      seq: typeof options.roapSeq !== 'number' && Number.isNaN(parseFloat(options.roapSeq)) ? 0 : options.roapSeq + 1,
      tieBreaker: 4294967294 // Math.floor(Math.random() * (2 ** 32) - 1) // TODO: Handle the roap  conflict scenario
    };

    this.roapHandler.submit({
      type: ROAP.SEND_ROAP_MSG,
      msg: roapMessage,
      correlationId: meeting.correlationId
    });

    const roapBody = {
      localMedias: [
        {
          localSdp: JSON.stringify(this.roapRequest.attachRechabilityData({
            roapMessage,
            // eslint-disable-next-line no-warning-comments
            // TODO: check whats the need for video and audiomute
            audioMuted: !!meeting.isAudioMuted(),
            videoMuted: !!meeting.isVideoMuted()
          }))
        // mediaId: meeting.mediaId
        }
      ]
    };

    return MeetingUtil.joinMeetingOptions(meeting, {roapMessage: roapBody})
      .then((locus) => {
        this.roapHandler.submit({
          type: ROAP.SEND_ROAP_MSG_SUCCESS,
          seq: roapMessage.seq,
          correlationId: meeting.correlationId
        });
        meeting.setRoapSeq(roapMessage.seq);

        // eslint-disable-next-line no-warning-comments
        // TODO: we need to attach peerconenction to locus not sure if we need to pass everything here
        return locus;
      // eslint-disable-next-line no-warning-comments
      // TODO: check where to update the sequence number
      });
  };

  /**
 * Called when the roap sequence is finished (completed successfully or failed)
 * @param {String} correlationId id of the meeting affected
 * @param {String} sequenceId the id of the finished sequence
 * @returns {undefined}
 * @private
 * @memberof Roap
 */
  roapFinished(correlationId, sequenceId) {
    RoapCollection.onSessionSequenceFinish(correlationId, sequenceId);
    const meeting = this.webex.meetings.meetingCollection.getByKey('correlationId', correlationId);

    meeting.mediaNegotiatedEvent();
    if (!RoapCollection.isBusy(correlationId)) {
      meeting.processNextQueuedMediaUpdate();
    }
  }
}
