import {CC_EVENTS} from '../config/types';
import {createErrDetailsObject as err} from '../core/Utils';
import {WCC_API_GATEWAY} from '../constants';
import AqmReqs from '../core/aqm-reqs';
import {TIMEOUT_REQ} from '../core/constants';
import {
  CONSULT,
  CONSULT_ACCEPT,
  CONSULT_END,
  CONSULT_TRANSFER,
  END,
  HOLD,
  PAUSE,
  RESUME,
  TASK_API,
  TASK_MESSAGE_TYPE,
  TRANSFER,
  UNHOLD,
  WRAPUP,
} from './constants';
import * as Contact from './types';
import {DESTINATION_TYPE} from './types';

export default function routingContact(aqm: AqmReqs) {
  return {
    /*
     * Accept incoming task
     */
    accept: aqm.req((p: {interactionId: string}) => ({
      url: `${TASK_API}${p.interactionId}/accept`,
      data: {},
      err,
      notifSuccess: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_CONTACT_ASSIGNED, interactionId: p.interactionId},
        },
        msg: {} as Contact.AgentContact,
      },
      notifFail: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_CONTACT_ASSIGN_FAILED, interactionId: p.interactionId},
        },
        errId: 'Service.aqm.task.accept',
      },
    })),

    /*
     * Hold task
     */
    hold: aqm.req((p: {interactionId: string; data: Contact.HoldResumePayload}) => ({
      url: `${TASK_API}${p.interactionId}${HOLD}`,
      data: p.data,
      host: WCC_API_GATEWAY,
      err,
      notifSuccess: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_CONTACT_HELD, interactionId: p.interactionId},
        },
        msg: {} as Contact.AgentContact,
      },
      notifFail: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_CONTACT_HOLD_FAILED},
        },
        errId: 'Service.aqm.task.hold',
      },
    })),

    /*
     * Unhold task
     */
    unHold: aqm.req((p: {interactionId: string; data: Contact.HoldResumePayload}) => ({
      url: `${TASK_API}${p.interactionId}${UNHOLD}`,
      data: p.data,
      host: WCC_API_GATEWAY,
      err,
      notifSuccess: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_CONTACT_UNHELD, interactionId: p.interactionId},
        },
        msg: {} as Contact.AgentContact,
      },
      notifFail: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_CONTACT_UNHOLD_FAILED},
        },
        errId: 'Service.aqm.task.unHold',
      },
    })),

    /*
     * Pause Recording
     */
    pauseRecording: aqm.req((p: {interactionId: string}) => ({
      url: `${TASK_API}${p.interactionId}${PAUSE}`,
      data: {},
      host: WCC_API_GATEWAY,
      err,
      notifSuccess: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.CONTACT_RECORDING_PAUSED, interactionId: p.interactionId},
        },
        msg: {} as Contact.AgentContact,
      },
      notifFail: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.CONTACT_RECORDING_PAUSE_FAILED},
        },
        errId: 'Service.aqm.task.pauseRecording',
      },
    })),

    /*
     * Resume Recording
     */
    resumeRecording: aqm.req(
      (p: {interactionId: string; data: Contact.ResumeRecordingPayload}) => ({
        url: `${TASK_API}${p.interactionId}${RESUME}`,
        data: p.data,
        host: WCC_API_GATEWAY,
        err,
        notifSuccess: {
          bind: {
            type: TASK_MESSAGE_TYPE,
            data: {type: CC_EVENTS.CONTACT_RECORDING_RESUMED, interactionId: p.interactionId},
          },
          msg: {} as Contact.AgentContact,
        },
        notifFail: {
          bind: {
            type: TASK_MESSAGE_TYPE,
            data: {type: CC_EVENTS.CONTACT_RECORDING_RESUME_FAILED},
          },
          errId: 'Service.aqm.task.resumeRecording',
        },
      })
    ),

    /*
     * Consult contact
     */
    consult: aqm.req((p: {interactionId: string; data: Contact.ConsultPayload}) => ({
      url: `${TASK_API}${p.interactionId}${CONSULT}`,
      data: p.data,
      timeout:
        p.data && p.data.destinationType === DESTINATION_TYPE.QUEUE ? 'disabled' : TIMEOUT_REQ,
      host: WCC_API_GATEWAY,
      err,
      notifSuccess: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_CONSULT_CREATED, interactionId: p.interactionId},
        },
        msg: {} as Contact.AgentContact,
      },
      notifFail: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {
            type:
              p.data && p.data.destinationType === DESTINATION_TYPE.QUEUE
                ? CC_EVENTS.AGENT_CTQ_FAILED
                : CC_EVENTS.AGENT_CONSULT_FAILED,
          },
        },
        errId: 'Service.aqm.task.consult',
      },
      notifCancel: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: 'AgentCtqCancelled', interactionId: p.interactionId},
        },
        msg: {} as Contact.AgentContact,
      },
    })),

    /*
     * Consult End
     */
    consultEnd: aqm.req((p: {interactionId: string; data: Contact.ConsultEndPayload}) => {
      // Setting false value for optional attribute
      const {isConsult, isSecondaryEpDnAgent = false, queueId} = p.data;

      return {
        url: `${TASK_API}${p.interactionId}${CONSULT_END}`,
        host: WCC_API_GATEWAY,
        data: queueId
          ? {
              queueId,
            }
          : {},
        err,
        notifSuccess: {
          bind: {
            type: 'RoutingMessage',
            data: {
              type: (() => {
                if (queueId) return CC_EVENTS.AGENT_CTQ_CANCELLED;
                if (isSecondaryEpDnAgent) return CC_EVENTS.CONTACT_ENDED;
                if (isConsult) return CC_EVENTS.AGENT_CONSULT_ENDED;

                return CC_EVENTS.AGENT_CONSULT_CONFERENCE_ENDED;
              })(),
              interactionId: p.interactionId,
            },
          },
          msg: {} as Contact.AgentContact,
        },
        notifFail: {
          bind: {
            type: 'RoutingMessage',
            data: {
              type: p.data.queueId
                ? CC_EVENTS.AGENT_CTQ_CANCEL_FAILED
                : CC_EVENTS.AGENT_CONSULT_END_FAILED,
            },
          },
          errId: p.data.queueId ? 'Service.aqm.task.cancelCtq' : 'Service.aqm.task.consultEnd',
        },
      };
    }),

    /*
     * Consult Accept contact
     */
    consultAccept: aqm.req((p: {interactionId: string}) => ({
      url: `${TASK_API}${p.interactionId}${CONSULT_ACCEPT}`,
      data: {},
      host: WCC_API_GATEWAY,
      err,
      notifSuccess: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_CONSULTING, interactionId: p.interactionId},
        },
        msg: {} as Contact.AgentContact,
      },
      notifFail: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_CONTACT_ASSIGN_FAILED},
        },
        errId: 'Service.aqm.task.consultAccept',
      },
    })),

    /*
     * BlindTransfer contact
     */
    blindTransfer: aqm.req((p: {interactionId: string; data: Contact.TransferPayLoad}) => ({
      url: `${TASK_API}${p.interactionId}${TRANSFER}`,
      data: p.data,
      host: WCC_API_GATEWAY,
      err,
      notifSuccess: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_BLIND_TRANSFERRED, interactionId: p.interactionId},
        },
        msg: {} as Contact.AgentContact,
      },
      notifFail: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_BLIND_TRANSFER_FAILED},
        },
        errId: 'Service.aqm.task.AgentBlindTransferFailedEvent',
      },
    })),

    /*
     * VteamTransfer contact
     */
    vteamTransfer: aqm.req((p: {interactionId: string; data: Contact.TransferPayLoad}) => ({
      url: `${TASK_API}${p.interactionId}${TRANSFER}`,
      data: p.data,
      host: WCC_API_GATEWAY,
      err,
      notifSuccess: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_VTEAM_TRANSFERRED, interactionId: p.interactionId},
        },
        msg: {} as Contact.AgentContact,
      },
      notifFail: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_VTEAM_TRANSFER_FAILED},
        },
        errId: 'Service.aqm.task.AgentVteamTransferFailed',
      },
    })),

    /*
     * Consult Transfer contact
     */
    consultTransfer: aqm.req(
      (p: {interactionId: string; data: Contact.ConsultTransferPayLoad}) => ({
        url: `${TASK_API}${p.interactionId}${CONSULT_TRANSFER}`,
        data: p.data,
        host: WCC_API_GATEWAY,
        err,
        notifSuccess: {
          bind: {
            type: TASK_MESSAGE_TYPE,
            data: {
              type: [CC_EVENTS.AGENT_CONSULT_TRANSFERRED, CC_EVENTS.AGENT_CONSULT_TRANSFERRING],
              interactionId: p.interactionId,
            },
          },
          msg: {} as Contact.AgentContact,
        },
        notifFail: {
          bind: {
            type: TASK_MESSAGE_TYPE,
            data: {type: CC_EVENTS.AGENT_CONSULT_TRANSFER_FAILED},
          },
          errId: 'Service.aqm.task.AgentConsultTransferFailed',
        },
      })
    ),

    /*
     * End contact
     */
    end: aqm.req((p: {interactionId: string}) => ({
      url: `${TASK_API}${p.interactionId}${END}`,
      data: {},
      host: WCC_API_GATEWAY,
      err,
      notifSuccess: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_WRAPUP, interactionId: p.interactionId},
        },
        msg: {} as Contact.AgentContact,
      },
      notifFail: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_CONTACT_END_FAILED},
        },
        errId: 'Service.aqm.task.end',
      },
    })),

    /*
     * Wrapup contact
     */
    wrapup: aqm.req((p: {interactionId: string; data: Contact.WrapupPayLoad}) => ({
      url: `${TASK_API}${p.interactionId}${WRAPUP}`,
      data: p.data,
      host: WCC_API_GATEWAY,
      err,
      notifSuccess: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_WRAPPEDUP, interactionId: p.interactionId},
        },
        msg: {} as Contact.AgentContact,
      },
      notifFail: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_WRAPUP_FAILED},
        },
        errId: 'Service.aqm.task.wrapup',
      },
    })),

    /*
     * Cancel popover
     */
    cancelTask: aqm.req((p: {interactionId: string}) => ({
      url: `${TASK_API}${p.interactionId}${END}`,
      data: {},
      host: WCC_API_GATEWAY,
      err,
      notifSuccess: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.CONTACT_ENDED, interactionId: p.interactionId},
        },
        msg: {} as Contact.AgentContact,
      },
      notifFail: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_CONTACT_END_FAILED},
        },
        errId: 'Service.aqm.task.end',
      },
    })),

    /*
     * Cancel Ctq request
     */
    cancelCtq: aqm.req((p: {interactionId: string; data: Contact.cancelCtq}) => ({
      url: `${TASK_API}${p.interactionId}/cancelCtq`,
      data: p.data,
      host: WCC_API_GATEWAY,
      err,
      notifSuccess: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: 'AgentCtqCancelled', interactionId: p.interactionId},
        },
        msg: {} as Contact.AgentContact,
      },
      notifFail: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: 'AgentCtqCancelFailed'},
        },
        errId: 'Service.aqm.task.cancelCtq',
      },
    })),
  };
}
