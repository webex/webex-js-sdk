import {v4 as uuidv4} from 'uuid';
import * as Err from '../core/Err';
import {createErrDetailsObject as err, normalizeRecoveryFailure} from '../core/Utils';
import * as Agent from './types';
import AqmReqs from '../core/aqm-reqs';
import {HTTP_METHODS} from '../../types';
import {WCC_API_GATEWAY} from '../constants';
import {CC_EVENTS} from '../config/types';

const hasNonblankStateRequestId = (p: {
  data: Agent.StateChange;
  requestId?: string;
}): p is {data: Agent.StateChange; requestId: string} =>
  typeof p?.requestId === 'string' && !!p.requestId.trim();

/**
 * Agent Service provides methods to manage agent states and operations
 * @param routing - AqmReqs instance for making API requests
 * @ignore
 */
export default function routingAgent(routing: AqmReqs) {
  const dispatchState = routing.req((p: {data: Agent.StateChange; requestId: string}) => ({
    correlationId: p.requestId,
    kind: 'command',
    url: '/v1/agents/session/state',
    host: WCC_API_GATEWAY,
    data: p.data,
    err,
    method: HTTP_METHODS.PUT,
    notifSuccess: {
      bind: {
        type: CC_EVENTS.AGENT_STATE_CHANGE,
        data: {type: CC_EVENTS.AGENT_STATE_CHANGE_SUCCESS},
      },
      msg: {} as Agent.StateChangeSuccess,
    },
    notifFail: {
      bind: {
        type: CC_EVENTS.AGENT_STATE_CHANGE,
        data: {type: CC_EVENTS.AGENT_STATE_CHANGE_FAILED},
      },
      errId: 'Service.aqm.agent.stateChange',
    },
  }));

  return {
    /**
     * Reloads the agent session
     * @public
     */
    reload: routing.reqEmpty(() => ({
      kind: 'session',
      host: WCC_API_GATEWAY,
      url: '/v1/agents/reload',
      data: {},
      err,
      notifSuccess: {
        bind: {
          type: CC_EVENTS.AGENT_RELOGIN_SUCCESS,
          data: {type: CC_EVENTS.AGENT_RELOGIN_SUCCESS},
        },
        msg: {} as Agent.ReloginSuccess,
      },
      notifFail: {
        bind: {
          type: CC_EVENTS.AGENT_RELOGIN_FAILED,
          data: {type: CC_EVENTS.AGENT_RELOGIN_FAILED},
        },
        errId: 'Service.aqm.agent.reload',
      },
    })),
    /**
     * Logs out the agent
     * @param p.data - Logout parameters
     * @public
     */
    logout: routing.req((p: {data: Agent.Logout}) => ({
      kind: 'teardown',
      url: '/v1/agents/logout',
      host: WCC_API_GATEWAY,
      data: p.data,
      err,
      notifSuccess: {
        bind: {
          type: CC_EVENTS.AGENT_LOGOUT,
          data: {type: CC_EVENTS.AGENT_LOGOUT_SUCCESS},
        },
        msg: {} as Agent.LogoutSuccess,
      },
      notifFail: {
        bind: {
          type: CC_EVENTS.AGENT_LOGOUT,
          data: {type: CC_EVENTS.AGENT_LOGOUT_FAILED},
        },
        errId: 'Service.aqm.agent.logout',
      },
    })),
    /**
     * Logs in the agent to a station
     * @param p.data - Station login parameters
     * @public
     */
    stationLogin: routing.req((p: {data: Agent.UserStationLogin}) => ({
      kind: 'session',
      url: '/v1/agents/login',
      host: WCC_API_GATEWAY,
      data: p.data,
      err: (e: any) => {
        const failure = normalizeRecoveryFailure(e);

        return new Err.Details('Service.aqm.agent.stationLogin', {
          status: failure.status ?? 0,
          type: e.response?.data?.errorType,
          trackingId: failure.trackingId ?? '',
          ...(failure.reason ? {reason: failure.reason} : {}),
          ...(failure.reasonCode !== undefined ? {reasonCode: failure.reasonCode} : {}),
        });
      },
      notifSuccess: {
        bind: {
          type: CC_EVENTS.AGENT_STATION_LOGIN,
          data: {type: CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS},
        },
        msg: {} as Agent.StationLoginSuccess,
      },
      notifFail: {
        bind: {
          type: CC_EVENTS.AGENT_STATION_LOGIN,
          data: {type: CC_EVENTS.AGENT_STATION_LOGIN_FAILED},
        },
        errId: 'Service.aqm.agent.stationLoginFailed',
      },
    })),
    /**
     * Changes the agent's state
     * @param p.data - State change parameters
     * @param p.requestId - Optional correlation ID; generated when omitted
     * @public
     */
    stateChange: (
      p: {data: Agent.StateChange; requestId?: string},
      cbRes?: Parameters<typeof dispatchState>[1],
      context?: Parameters<typeof dispatchState>[2]
    ): Promise<Agent.StateChangeSuccess> => {
      const request =
        p && p.requestId === undefined ? {...p, requestId: `WX_CC_SDK_${uuidv4()}`} : p;
      if (!hasNonblankStateRequestId(request))
        return Promise.reject(new Error('A nonblank state requestId is required'));

      return dispatchState(request, cbRes, context);
    },
    /**
     * Retrieves list of buddy agents
     * @param p.data - Buddy agent query parameters
     * @public
     */
    buddyAgents: routing.req((p: {data: Agent.BuddyAgents}) => ({
      kind: 'query',
      url: `/v1/agents/buddyList`,
      host: WCC_API_GATEWAY,
      data: {...p.data},
      err,
      method: HTTP_METHODS.POST,
      notifSuccess: {
        bind: {
          type: CC_EVENTS.AGENT_BUDDY_AGENTS,
          data: {type: CC_EVENTS.AGENT_BUDDY_AGENTS_SUCCESS},
        },
        msg: {} as Agent.BuddyAgentsSuccess,
      },
      notifFail: {
        bind: {
          type: CC_EVENTS.AGENT_BUDDY_AGENTS,
          data: {type: CC_EVENTS.AGENT_BUDDY_AGENTS_RETRIEVE_FAILED},
        },
        errId: 'Service.aqm.agent.BuddyAgentsRetrieveFailed',
      },
    })),
  };
}
