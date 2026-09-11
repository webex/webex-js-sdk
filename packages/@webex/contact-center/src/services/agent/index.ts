import * as Err from '../core/Err';
import {createErrDetailsObject as err} from '../core/Utils';
import * as Agent from './types';
import AqmReqs from '../core/aqm-reqs';
import {HTTP_METHODS} from '../../types';
import {WCC_API_GATEWAY} from '../constants';
import {CC_EVENTS, INTERNAL_AGENT_STATE_CONTROL_EVENTS} from '../config/types';
import type {Res, ResEmpty} from '../core/types';

interface PublicRoutingAgent {
  reload: ResEmpty<Agent.ReloginSuccess>;
  logout: Res<Agent.LogoutSuccess, {data: Agent.Logout}>;
  stationLogin: Res<Agent.StationLoginSuccess, {data: Agent.UserStationLogin}>;
  stateChange: Res<Agent.StateChangeSuccess, {data: Agent.StateChange}>;
  buddyAgents: Res<Agent.BuddyAgentsSuccess, {data: Agent.BuddyAgents}>;
}

/**
 * Agent Service provides methods to manage agent states and operations
 * @param routing - AqmReqs instance for making API requests
 * @ignore
 */
const createRoutingAgent = (routing: AqmReqs) => {
  return {
    /**
     * Reloads the agent session
     * @public
     */
    reload: routing.reqEmpty(() => ({
      host: WCC_API_GATEWAY,
      url: '/v1/agents/reload',
      data: {},
      err,
      notifSuccess: {
        bind: {
          type: [
            CC_EVENTS.AGENT_RELOGIN_SUCCESS,
            Agent.INTERNAL_AGENT_STATE_CONTROL_MESSAGE_TYPES.AGENT_REQUEST_EVENT,
          ],
          data: {
            type: [
              CC_EVENTS.AGENT_RELOGIN_SUCCESS,
              INTERNAL_AGENT_STATE_CONTROL_EVENTS.AGENT_CHANNEL_RELOGIN_SUCCESS,
            ],
          },
        },
        msg: {} as Agent.ReloginSuccess | Agent.AgentChannelReloginSuccess,
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
      url: '/v1/agents/login',
      host: WCC_API_GATEWAY,
      data: p.data,
      err: /* istanbul ignore next */ (e: any) => {
        return new Err.Details('Service.aqm.agent.stationLogin', {
          status: e.response?.status ?? 0,
          type: e.response?.data?.errorType,
          trackingId: e.response?.headers?.trackingid?.split('_')[1],
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
     * @public
     */
    stateChange: routing.req((p: {data: Agent.StateChange}) => ({
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
    })),
    /**
     * Changes state for one or more Agent State Control channels.
     * The promise settles from the matching WebSocket success/failure notification.
     * @param p.data - Normalized channel-state request payload
     * @internal
     */
    stateChangeV2: routing.req((p: {data: Agent.StateChangeV2}) => ({
      url: '/v2/agents/session/state',
      host: WCC_API_GATEWAY,
      data: p.data,
      err,
      method: HTTP_METHODS.PUT,
      notifSuccess: {
        bind: {
          type: [
            Agent.INTERNAL_AGENT_STATE_CONTROL_MESSAGE_TYPES.AGENT_REQUEST_EVENT,
            Agent.INTERNAL_AGENT_STATE_CONTROL_MESSAGE_TYPES.ROUTING_MESSAGE,
            Agent.INTERNAL_AGENT_STATE_CONTROL_MESSAGE_TYPES.AGENT_CHANNEL_STATE_CHANGE,
          ],
          data: {type: INTERNAL_AGENT_STATE_CONTROL_EVENTS.AGENT_CHANNEL_STATE_CHANGED},
        },
        msg: {} as Agent.AgentChannelStateChanged,
      },
      notifFail: {
        bind: {
          type: Agent.INTERNAL_AGENT_STATE_CONTROL_MESSAGE_TYPES.AGENT_CHANNEL_STATE_CHANGE,
          data: {
            type: Agent.INTERNAL_AGENT_STATE_CONTROL_MESSAGE_TYPES
              .AGENT_CHANNEL_STATE_CHANGE_FAILED,
          },
        },
        errId: 'Service.aqm.agent.stateChange',
      },
    })),
    /**
     * Retrieves list of buddy agents
     * @param p.data - Buddy agent query parameters
     * @public
     */
    buddyAgents: routing.req((p: {data: Agent.BuddyAgents}) => ({
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
};

/** Creates the complete agent routing surface used inside Contact Center. @internal */
export const createInternalRoutingAgent = (routing: AqmReqs) => createRoutingAgent(routing);

export default function routingAgent(routing: AqmReqs): PublicRoutingAgent {
  const {stateChangeV2: _stateChangeV2, ...publicAgent} = createRoutingAgent(routing);

  return publicAgent as PublicRoutingAgent;
}
