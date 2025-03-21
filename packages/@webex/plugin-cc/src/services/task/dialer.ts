import {CC_EVENTS} from '../config/types';
import {WCC_API_GATEWAY} from '../constants';
import {createErrDetailsObject as err} from '../core/Utils';
import {TASK_MESSAGE_TYPE, TASK_API} from './constants';
import * as Contact from './types';
import AqmReqs from '../core/aqm-reqs';

export default function aqmDialer(aqm: AqmReqs) {
  return {
    /*
     * Make outbound request.
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
  };
}
