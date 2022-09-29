import StateMachine from 'javascript-state-machine';

import LoggerProxy from '../common/logs/logger-proxy';
import {ROAP, _OFFER_, _ANSWER_, _REQUESTED_} from '../constants';

const shouldStep = (roap, meeting) => {
  const {messageType} = roap.msg;

  if (meeting) {
    if (messageType === _OFFER_ && roap.remote && meeting.shareStatus === _REQUESTED_) {
      // The peer-connection is waiting for answer but got an offer Reset. Try to
      // send the offer later after you accept the answer
      return false;
    }
    // Assuming the mercury event has come first before the response for the event
    // we have to wait for the response and trigger the ROAP request later on
    if (!meeting.mediaProperties.peerConnection && messageType === _ANSWER_) {
      return false;
    }
  }
  LoggerProxy.logger.log('Roap:state#shouldStep --> RoapStateMachine: PeerConnectionState, ', meeting.mediaProperties.peerConnection.signalingState);
  LoggerProxy.logger.log('Roap:state#shouldStep --> RoapStateMachine: success save proceeding with transition, ', roap.msg);

  return true;
};

const handleTransition = (value, signal, meeting) => {
  LoggerProxy.logger.log(`Roap:state#handleTransition --> current ${value} to ${signal}`);

  switch (value) {
    case ROAP.ROAP_STATE.INIT:
      if (signal === ROAP.ROAP_SIGNAL.RX_OFFER) {
        return ROAP.ROAP_STATE.WAIT_TX_ANSWER;
      }
      if (signal === ROAP.ROAP_SIGNAL.TX_OFFER) {
        return ROAP.ROAP_STATE.WAIT_RX_ANSWER;
      }

      return value;

    case ROAP.ROAP_STATE.WAIT_RX_OFFER:
      return value;

    case ROAP.ROAP_STATE.WAIT_RX_ANSWER:
      if (signal === ROAP.ROAP_SIGNAL.RX_ANSWER) {
        // There is a race condition where the /call response comes after mercury event from the server
        // As mercury sends roap event if it didnt get back a response. We can send the roap ok after that
        if (meeting.mediaId) {
          return ROAP.ROAP_STATE.WAIT_TX_OK;
        }
        LoggerProxy.logger.error('Roap:state#handleTransition --> Race Condition no mediaId, continuing.');

        return value;
      }

      if (signal === ROAP.ROAP_SIGNAL.RX_OFFER) {
        return ROAP.ROAP_STATE.GLARE;
      }

      return value;

    case ROAP.ROAP_STATE.WAIT_TX_OFFER:
      return value;

    case ROAP.ROAP_STATE.WAIT_TX_ANSWER:
      if (signal === ROAP.ROAP_SIGNAL.TX_ANSWER) {
        return ROAP.ROAP_STATE.WAIT_RX_OK;
      }

      return value;

    case ROAP.ROAP_STATE.WAIT_TX_OK:
      if (signal === ROAP.ROAP_SIGNAL.TX_OK) {
        return ROAP.ROAP_STATE.INIT;
      }

      return value;

    case ROAP.ROAP_STATE.WAIT_RX_OK:
      if (signal === ROAP.ROAP_SIGNAL.RX_OK) {
        return ROAP.ROAP_STATE.INIT;
      }

      return value;

    case ROAP.ROAP_STATE.ERROR:
      // eslint-disable-next-line no-warning-comments
      // TODO: resolve error state. Add a signal constant and handle the cleanup
      return ROAP.ROAP_STATE.INIT;

    case ROAP.ROAP_STATE.GLARE:
      return ROAP.ROAP_STATE.WAIT_RX_ANSWER;
    default:
      return value;
  }
};

const RoapStateMachine = {
  /**
   * @param {Roap} roapRef
   * initializes the state machine
   * @returns {StateMachine} an instance of a state machine
   */
  createState() {
    const RoapState = StateMachine.factory({
      init: ROAP.ROAP_STATE.INIT,
      transitions: [
        {
          name: ROAP.ROAP_TRANSITIONS.STEP,
          from: '*',
          /**
           * Method to handle the transitions between states
           * @param {String} signal
           * @param {Meeting} meeting instance of a Meeting
           * @param {Object} roap
           * @returns {String} new state value
           */
          to(signal, meeting, roap) {
            const value = this.state;

            if (!shouldStep(roap, meeting)) {
              return value;
            }

            return handleTransition(value, signal, meeting);
          }
        }
      ],
      methods: {
        /**
         * Event that fires after we've transitioned to a new state
         * @param {Object} transition
         * @returns {null}
         */
        onAfterStep(transition) {
          LoggerProxy.logger.log(
            `Roap:state#onAfterStep --> RoapStateMachine->onAfterStep#fired! State changed from '${transition.from}' to '${
              transition.to
            }' with transition '${transition.transition}''.`
          );
        }
      }
    });

    return new RoapState();
  }
};

export default RoapStateMachine;
