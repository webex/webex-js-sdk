/* no-param-reassign */
// @ts-ignore
import {StatelessWebexPlugin} from '@webex/webex-core';

import LoggerProxy from '../common/logs/logger-proxy';
import {ROAP, _OFFER_} from '../constants';
import Metrics from '../metrics';
import BEHAVIORAL_METRICS from '../metrics/constants';

import RoapUtil from './util';
import RoapCollection from './collection';
import Meeting from '../meeting';

const checkForAndHandleErrors = (action, meeting, correlationId) => {
  if (action && action.type) {
    if (action.msg && action.msg.messageType && action.msg.errorType) {
      if (RoapUtil.findError(action.msg.messageType, action.msg.errorType, action.type)) {
        RoapUtil.handleError(meeting.mediaProperties.peerConnection)
          .then((res) => {
            if (res) {
              RoapCollection.deleteSessionSequence(correlationId, action.msg.seq);
            }
          })
          .catch((err) => {
            LoggerProxy.logger.warn(
              `Roap:handler#checkForAndHandleErrors --> Cannot reset the peer connection with error: ${err}`
            );
          });

        return true;
      }
    }
    if (!RoapUtil.ensureMeeting(meeting, action.type)) {
      return true;
    }
  }

  return false;
};

const compareWithLastRoapMessage = (lastRoapMessage, currentRoapMessage) =>
  lastRoapMessage?.msg?.seq === currentRoapMessage.msg.seq &&
  lastRoapMessage?.msg?.messageType === currentRoapMessage.msg.messageType;

const handleSessionStep = ({roap, session, locusUrl, correlationId}) => {
  const {seq: sequenceId, messageType} = roap.msg;

  if (session.OFFER && messageType === _OFFER_) {
    session.GLARE_OFFER = roap.msg;
    session.GLARE_OFFER.remote = !!roap.remote;
    const metricName = BEHAVIORAL_METRICS.ROAP_GLARE_CONDITION;
    const data = {
      correlation_id: correlationId,
      locus_id: locusUrl.split('/').pop(),
      sequence: sequenceId,
    };

    Metrics.sendBehavioralMetric(metricName, data);

    LoggerProxy.logger.warn(
      `Roap:handler#handleSessionStep --> Glare condition occurred with new mercury event, sequenceId: ${sequenceId}`
    );
  } else {
    LoggerProxy.logger.info(
      `Roap:handler#handleSessionStep --> Save OFFER/ANSWER seq:${sequenceId} new mercury event ${messageType}local state: ${JSON.stringify(
        session.state.state,
        null,
        2
      )}`
    );
    session[messageType] = roap.msg;
    session[messageType].remote = !!roap.remote;
  }
};

/**
 * @class RoapHandler
 */
export default class RoapHandler extends StatelessWebexPlugin {
  attrs: any;
  lastRoapMessage: any;
  options: any;
  roapAnswer: any;
  roapFinished: any;
  roapOk: any;

  constructor(attrs, options, roapOk, roapAnswer, roapFinished) {
    super({}, options);
    this.attrs = attrs;
    this.options = options;
    this.roapOk = roapOk;
    this.roapFinished = roapFinished;
    this.roapAnswer = roapAnswer;
    this.lastRoapMessage = null;
  }

  /**
   *
   * @param {Object} session
   * @param {Meeting} meeting
   * @param {Object} action
   * @returns {null}
   */
  perform(session: any, meeting: any, action: any) {
    switch (session.state.state) {
      case ROAP.ROAP_STATE.INIT:
        this.roapFinished(meeting.correlationId, action.msg.seq);
        break;

      // TODO:  (important )handle roap state for sending offers as well
      // case ROAP.ROAP_STATE.WAIT_RX_OFFER:
      // case ROAP.ROAP_STATE.WAIT_RX_ANSWER:
      // case ROAP.ROAP_STATE.WAIT_RX_OK:
      case ROAP.ROAP_STATE.WAIT_TX_ANSWER:
        // eslint-disable-next-line no-warning-comments
        // TODO: sometime the you get an answer while you are creating an offer so SKIP
        // Server will send the mercury event comes back
        if (RoapUtil.shouldHandleMedia(meeting)) {
          RoapUtil.updatePeerConnection(meeting, session)
            .then((answerSdps) => {
              this.roapAnswer({
                mediaId: meeting.mediaId,
                sdps: answerSdps,
                seq: session.OFFER.seq,
                correlationId: meeting.correlationId,
                audioMuted: meeting.isAudioMuted(),
                videoMuted: meeting.isVideoMuted(),
              });
            })
            .catch((error) => {
              const metricName = BEHAVIORAL_METRICS.ROAP_ANSWER_FAILURE;
              const data = {
                correlation_id: meeting.correlationId,
                locus_id: meeting.locusUrl.split('/').pop(),
                reason: error.message,
                stack: error.stack,
              };
              const metadata = {
                type: error.name,
              };

              Metrics.sendBehavioralMetric(metricName, data, metadata);
              LoggerProxy.logger.error(
                `Roap:handler#perform --> Error occured during wait receive answer, continuing, ${error}`
              );
            });
        }
        break;
      case ROAP.ROAP_STATE.WAIT_TX_OK:
        if (!RoapUtil.shouldHandleMedia(meeting)) {
          RoapUtil.setRemoteDescription(meeting, session).then((res) => {
            this.roapOk(res);
          });
        }
        break;
      // case ROAP.ROAP_STATE.IDLE_LOCAL_OFFER:
      case ROAP.ROAP_STATE.ERROR:
        LoggerProxy.logger.error(
          `Roap:handler#perform --> Roap State ERROR for session: ${session}`
        );
        break;
      case ROAP.ROAP_STATE.GLARE:
        session.GLARE_OFFER.tieBreaker = session.GLARE_OFFER.tieBreaker || 0;
        session.OFFER.tieBreaker = session.OFFER.tieBreaker || 0;
        LoggerProxy.logger.warn(
          'Roap:handler#perform --> Roap State resolved the GLARE condition.'
        );
        if (session.GLARE_OFFER.tieBreaker < session.OFFER.tieBreaker) {
          // 2
          LoggerProxy.logger.log(
            'Roap:handler#perform --> Roap State local offer won after GLARE.'
          );
        } else {
          LoggerProxy.logger.log(
            'Roap:handler#perform --> Roap State remote offer won after GLARE.'
          );
        }
        session.state.step(ROAP.ROAP_SIGNAL.GLARE_RESOLVED, meeting, action);
        // @ts-ignore
        this.perform(session, meeting);
        break;
      default:
        break;
    }
  }

  /**
   *
   * @param {String} signal
   * @param {Object} session
   * @param {Object} action
   * @param {Meeting} meeting
   * @param {String} prefix
   * @returns {null}
   */
  execute(signal: string, session: any, action: any, meeting: Meeting, prefix: string) {
    if (session && session.state) {
      handleSessionStep({
        roap: action,
        locusUrl: meeting.locusUrl,
        correlationId: meeting.correlationId,
        session,
      });
      signal = ROAP.ROAP_SIGNAL[`${prefix}${action.msg.messageType}`];
      session.state.step(signal, meeting, action);
      this.perform(session, meeting, action);
    }
  }

  /**
   *
   * @param {Object} session
   * @param {Object} action
   * @param {Meeting} meeting
   * @param {String} correlationId
   * @returns {Boolean}
   */
  handleAction(session: object, action: any, meeting: Meeting, correlationId: string) {
    let signal;

    switch (action.type) {
      case ROAP.RECEIVE_ROAP_MSG:
        LoggerProxy.logger.log(
          `Roap:handler#handleAction --> RECEIVE_ROAP_MSG event captured, reciving a roap message : ${JSON.stringify(
            action
          )}`
        );
        if (compareWithLastRoapMessage(this.lastRoapMessage, action)) {
          LoggerProxy.logger.warn(
            `Roap:handler#handleAction --> duplicate roap offer from server: ${action.msg.seq}`
          );
        } else {
          this.lastRoapMessage = action;
          action.remote = true;
          this.execute(signal, session, action, meeting, ROAP.RX_);
        }
        break;
      case ROAP.SEND_ROAP_MSG:
        LoggerProxy.logger.log(
          `Roap:handler#handleAction --> SEND_ROAP_MSG event captured, sending roap message ${JSON.stringify(
            action
          )}`
        );

        action.local = true;
        this.execute(signal, session, action, meeting, ROAP.TX_);
        break;
      case ROAP.SEND_ROAP_MSG_SUCCESS:
        // NOTE: When server send back an answer via mercury the
        // remote SDP is already saved sent and ok message is sent back
        // We dont have to indicate the roapHandler about the RX_ANSWER via SEND_ROAP_MSG_SUCCESS
        break;
      case ROAP.RECEIVE_CALL_LEAVE:
        RoapCollection.deleteSession(correlationId);
        LoggerProxy.logger.log(
          `Roap:handler#handleAction --> RECEIVE_CALL_LEAVE event captured, cleaning up the RoapHandler for correlationId: ${correlationId}`
        );
        break;
      case ROAP.RESET_ROAP_STATE:
        RoapCollection.deleteSessionSequence(correlationId, action.msg.seq);
        LoggerProxy.logger.log(
          `Roap:handler#handleAction --> RESET_ROAP_STATE event captured, resetting the RoapHandler state based on sequenceId: ${action.msg.seq}`
        );
        break;
      default:
        return true;
    }

    return true;
  }

  /**
   *
   * @param {Object} action
   * @returns {Boolean}
   */
  submit(action: any) {
    const {correlationId} = action;
    let {seq} = action;

    if (!seq && action.msg) {
      seq = action.msg.seq;
    }
    const session = RoapCollection.getSessionSequence(correlationId, seq);
    // @ts-ignore
    const meeting = this.webex.meetings.meetingCollection.getByKey('correlationId', correlationId);

    if (checkForAndHandleErrors(action, meeting, correlationId)) {
      return true;
    }

    return this.handleAction(session, action, meeting, correlationId);
  }
}
