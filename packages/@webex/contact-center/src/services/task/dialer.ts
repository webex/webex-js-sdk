import {CC_EVENTS} from '../config/types';
import {WCC_API_GATEWAY} from '../constants';
import {HTTP_METHODS} from '../../types';
import {createErrDetailsObject as err} from '../core/Utils';
import {
  TASK_MESSAGE_TYPE,
  TASK_API,
  DIALER_API,
  CAMPAIGN_PREVIEW_ACCEPT,
  TIMEOUT_PREVIEW_ACCEPT,
} from './constants';
import * as Contact from './types';
import AqmReqs from '../core/aqm-reqs';

/**
 * Returns an object with AQM dialer functions used for outbound contact handling.
 *
 * @param {AqmReqs} aqm - An instance of AQM request handler.
 * @returns {{
 *   startOutdial: (params: {data: Contact.DialerPayload}) => Promise<any>
 * }} Object containing methods for outbound dialing.
 * @ignore
 */
export default function aqmDialer(aqm: AqmReqs) {
  return {
    /**
     * Initiates an outbound contact (outdial) request.
     *
     * @param {Object} p - Parameters object.
     * @param {Contact.DialerPayload} p.data - Payload for the outbound call.
     * @returns {Promise<any>} A promise that resolves or rejects based on the outbound call response.
     *
     * Emits:
     * - `CC_EVENTS.AGENT_OFFER_CONTACT` on success
     * - `CC_EVENTS.AGENT_OUTBOUND_FAILED` on failure
     * @ignore
     */
    startOutdial: aqm.req((p: {data: Contact.DialerPayload}) => ({
      url: `${TASK_API}`,
      host: WCC_API_GATEWAY,
      data: p.data,
      err,
      notifSuccess: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_OFFER_CONTACT},
        },
        msg: {} as Contact.AgentContact,
      },
      notifFail: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.AGENT_OUTBOUND_FAILED},
        },
        errId: 'Service.aqm.dialer.startOutdial',
      },
    })),

    /**
     * Accepts a campaign preview contact, initiating the outbound call.
     *
     * @param {Object} p - Parameters object.
     * @param {Contact.PreviewContactPayload} p.data - Payload containing interactionId and campaignId.
     * @returns {Promise<Contact.AgentContact>} A promise that resolves with agent contact on success.
     *
     * Emits:
     * - `CC_EVENTS.AGENT_CONTACT_ASSIGNED` on success
     * - `CC_EVENTS.CAMPAIGN_PREVIEW_ACCEPT_FAILED` on failure
     * @ignore
     */
    acceptPreviewContact: aqm.req((p: {data: Contact.PreviewContactPayload}) => ({
      url: `${DIALER_API}/campaign/${encodeURIComponent(p.data.campaignId)}/preview-task/${
        p.data.interactionId
      }${CAMPAIGN_PREVIEW_ACCEPT}`,
      host: WCC_API_GATEWAY,
      data: {},
      method: HTTP_METHODS.POST,
      timeout: TIMEOUT_PREVIEW_ACCEPT,
      err,
      notifSuccess: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {
            type: [CC_EVENTS.AGENT_CONTACT_ASSIGNED, CC_EVENTS.CONTACT_ENDED],
            __typeMap: {
              typeField: 'type',
              conditions: {
                [CC_EVENTS.AGENT_CONTACT_ASSIGNED]: {
                  reservationInteractionId: p.data.interactionId,
                },
                [CC_EVENTS.CONTACT_ENDED]: {interactionId: p.data.interactionId},
              },
            },
          },
        },
        msg: {} as Contact.AgentContact,
      },
      notifFail: {
        bind: {
          type: TASK_MESSAGE_TYPE,
          data: {type: CC_EVENTS.CAMPAIGN_PREVIEW_ACCEPT_FAILED, campaignId: p.data.campaignId},
        },
        errId: 'Service.aqm.dialer.acceptPreviewContact',
      },
    })),
  };
}
