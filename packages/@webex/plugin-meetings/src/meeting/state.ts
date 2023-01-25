import StateMachine from 'javascript-state-machine';
import StateMachineHistory from 'javascript-state-machine/lib/history';

import LoggerProxy from '../common/logs/logger-proxy';
import Trigger from '../common/events/trigger-proxy';
import {MEETING_STATE_MACHINE, EVENT_TRIGGERS} from '../constants';
import ParameterError from '../common/errors/parameter';

// TODO: ensure that meeting can be destroyed when in an error state
const MeetingStateMachine = {
  /**
   * Initializes the StateMachine for the meeting
   * @param {Meeting} meetingRef A reference to a meeting instance
   * @returns {StateMachine}
   */
  create(meetingRef: any) {
    if (!meetingRef) {
      throw new ParameterError(
        'You must initialize the meeting state machine with a meeting reference.'
      );
    }

    return new StateMachine({
      init: MEETING_STATE_MACHINE.STATES.IDLE,
      transitions: [
        // when ringing a meeting, it must be first IDLE, because all other states are invalid, it transitions to the RINGING state
        {
          name: MEETING_STATE_MACHINE.TRANSITIONS.RING,
          from: [
            MEETING_STATE_MACHINE.STATES.IDLE,
            MEETING_STATE_MACHINE.STATES.ERROR,
            MEETING_STATE_MACHINE.STATES.JOINED,
          ],
          to: MEETING_STATE_MACHINE.STATES.RINGING,
        },
        // when joining a meeting, it must be from the RINGING or IDLE state, transitions to JOINED state, 1:1 will go to RINGING,
        // others will go straight to JOINED with this transition
        {
          name: MEETING_STATE_MACHINE.TRANSITIONS.JOIN,
          from: [
            MEETING_STATE_MACHINE.STATES.JOINED,
            MEETING_STATE_MACHINE.STATES.IDLE,
            MEETING_STATE_MACHINE.STATES.RINGING,
            MEETING_STATE_MACHINE.STATES.ERROR,
          ],
          to: MEETING_STATE_MACHINE.STATES.JOINED,
        },
        // signify that ringing has stopped and somebody else answered, move state to DECLINED, ANSWERED
        {
          name: MEETING_STATE_MACHINE.TRANSITIONS.REMOTE,
          from: [MEETING_STATE_MACHINE.STATES.JOINED, MEETING_STATE_MACHINE.STATES.ERROR],
          /**
           * @param {Object} remote
           * @param {Boolean} remote.remoteAnswered
           * @param {Boolean} remote.remoteDeclined
           * @returns {String}
           */
          to(remote: {remoteAnswered: boolean; remoteDeclined: boolean}) {
            // other user answered the call
            if (remote.remoteAnswered) {
              return MEETING_STATE_MACHINE.STATES.ANSWERED;
            }
            // other user declined the call
            if (remote.remoteDeclined) {
              return MEETING_STATE_MACHINE.STATES.DECLINED;
            }

            // default
            return MEETING_STATE_MACHINE.STATES.ERROR;
          },
        },
        // when leaving a meeting it must be from either the RINGING, JOINED, or ERROR states, and transitions it to the ENDED state
        {
          name: MEETING_STATE_MACHINE.TRANSITIONS.LEAVE,
          from: [
            MEETING_STATE_MACHINE.STATES.IDLE,
            MEETING_STATE_MACHINE.STATES.RINGING,
            MEETING_STATE_MACHINE.STATES.JOINED,
            MEETING_STATE_MACHINE.STATES.ANSWERED,
            MEETING_STATE_MACHINE.STATES.DECLINED,
            MEETING_STATE_MACHINE.STATES.ERROR,
          ],
          to: MEETING_STATE_MACHINE.STATES.ENDED,
        },
        {
          name: MEETING_STATE_MACHINE.TRANSITIONS.END,
          from: [
            MEETING_STATE_MACHINE.STATES.IDLE,
            MEETING_STATE_MACHINE.STATES.RINGING,
            MEETING_STATE_MACHINE.STATES.JOINED,
            MEETING_STATE_MACHINE.STATES.ANSWERED,
            MEETING_STATE_MACHINE.STATES.DECLINED,
            MEETING_STATE_MACHINE.STATES.ERROR,
          ],
          to: MEETING_STATE_MACHINE.STATES.ENDED,
        },
        {
          name: MEETING_STATE_MACHINE.TRANSITIONS.DECLINE,
          from: [MEETING_STATE_MACHINE.STATES.RINGING, MEETING_STATE_MACHINE.STATES.ERROR],
          to: MEETING_STATE_MACHINE.STATES.ENDED,
        },
        // transition from ANY state to ERROR state
        {
          name: MEETING_STATE_MACHINE.TRANSITIONS.FAIL,
          from: '*',
          to: MEETING_STATE_MACHINE.STATES.ERROR,
        },
        // fail safe, transition from ANY state to IDLE state
        {
          name: MEETING_STATE_MACHINE.TRANSITIONS.RESET,
          from: '*',
          to: MEETING_STATE_MACHINE.STATES.IDLE,
        },
      ],
      data: {
        /**
         * The meeting instance to execute all state changes on
         */
        meeting: meetingRef,
      },
      methods: {
        /**
         * Ring stop transition, to end the ring event for the meeting, and transition the state to ANSWERED OR DECLINED, only for outgoing meetings
         * @param {Object} transition -- FiniteStateMachine automatically passed, not used
         * @param {Object} stop -- {remoteAnswered: {Boolean}, remoteDeclined: {Boolean}}
         * @returns {Boolean}
         */
        onRemote(transition: object, stop: object) {
          if (this.meeting) {
            Trigger.trigger(
              this.meeting,
              {
                file: 'meeting/state',
                function: 'onRemote',
              },
              EVENT_TRIGGERS.MEETING_RINGING_STOP,
              {
                id: this.meeting.id,
                type: stop,
              }
            );
          }
        },
        /**
         * Ring transition, to cause the ring event for the meeting, and transition the state to RINGING, for both incoming, and outgoing meetings
         * @param {Object} transition -- FiniteStateMachine automatically passed, not used
         * @param {String} type -- incoming call === INCOMING / or other meetings have a ring type of JOIN
         * @returns {Boolean}
         */
        onRing(transition: object, type: string) {
          if (this.meeting) {
            Trigger.trigger(
              this.meeting,
              {
                file: 'meeting/state',
                function: 'onRing',
              },
              EVENT_TRIGGERS.MEETING_RINGING,
              {
                type,
                id: this.meeting.id,
              }
            );
          }
        },
        /**
         * handle the entry to error state
         * @param {Object} transition
         * @param {Error} error
         * @returns {Boolean}
         */
        onEnterError(transition: any, error: Error) {
          LoggerProxy.logger.error(
            `Meeting:state#onEnterError --> state->onEnterError#meeting.id: ${this.meeting.id} | Transition '${transition?.transition}' : ${transition?.from} -> ${transition?.to}, with error ${error}. Last states: ${this.history}`
          );
        },
        /**
         * After ANY transition occurs, we want to know what state the meeting moved to for debugging
         * @param {Object} transition
         * @returns {Boolean}
         */
        onAfterTransition(transition: any) {
          LoggerProxy.logger.log(
            `Meeting:state#onAfterTransition --> state->onAfterTransition#meeting.id: ${this.meeting.id} | Transition '${transition.transition}' : ${transition.from} -> ${transition.to} executed. Last states: ${this.history}`
          );
        },
      },
      // track the last 25 states entered
      plugins: [new StateMachineHistory({max: 25})],
    });
  },
};

export default MeetingStateMachine;
