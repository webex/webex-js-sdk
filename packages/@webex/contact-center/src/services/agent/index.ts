import * as Err from '../core/Err';
import {createErrDetailsObject as err} from '../core/Utils';
import * as Agent from './types';
import AqmReqs from '../core/aqm-reqs';
import {HTTP_METHODS} from '../../types';
import {WCC_API_GATEWAY} from '../constants';
import {CC_EVENTS} from '../config/types';

/**
 * Agent Service provides methods to manage agent states and operations
 * @param routing - AqmReqs instance for making API requests
 * @ignore
 */
export default function routingAgent(routing: AqmReqs) {
  return {
    /**
     * Reloads the agent session. Uses the V1 endpoint but accepts both V1
     * (AgentReloginSuccess) and V2 (AgentChannelReloginSuccess) responses —
     * the server determines the response type from the persisted session
     * version, NOT from the reload endpoint version.
     * @public
     */
    reload: routing.reqEmpty(() => ({
      host: WCC_API_GATEWAY,
      url: '/v1/agents/reload',
      data: {},
      err,
      notifSuccess: {
        bind: {
          type: [CC_EVENTS.AGENT_RELOGIN_SUCCESS, CC_EVENTS.AGENT_CHANNEL_RELOGIN_SUCCESS],
          data: {type: [CC_EVENTS.AGENT_RELOGIN_SUCCESS, CC_EVENTS.AGENT_CHANNEL_RELOGIN_SUCCESS]},
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

    // ─── V2 Granular Agent State Control Operations ─────────────────────

    /**
     * V2 reload for granular sessions. Binds both relogin response types; the
     * server answers with the persisted session version.
     * @public
     */
    reloadV2: routing.reqEmpty(() => ({
      host: WCC_API_GATEWAY,
      url: '/v2/agents/reload',
      data: {},
      err,
      notifSuccess: {
        bind: {
          type: [CC_EVENTS.AGENT_RELOGIN_SUCCESS, CC_EVENTS.AGENT_CHANNEL_RELOGIN_SUCCESS],
          data: {type: [CC_EVENTS.AGENT_RELOGIN_SUCCESS, CC_EVENTS.AGENT_CHANNEL_RELOGIN_SUCCESS]},
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
     * V2 station login with per-channel routing
     * @param p.data - Station login parameters
     * @public
     */
    stationLoginV2: routing.req((p: {data: Agent.UserStationLogin}) => ({
      url: '/v2/agents/login',
      host: WCC_API_GATEWAY,
      data: p.data,
      err: (e: any) => {
        return new Err.Details('Service.aqm.agent.stationLoginV2', {
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
        errId: 'Service.aqm.agent.stationLoginV2Failed',
      },
    })),

    /**
     * V2 per-channel state change
     * @param p.data - V2 state change parameters with channelType array
     * @public
     */
    stateChangeV2: routing.req((p: {data: Agent.ChannelStateChangeRequest}) => ({
      url: '/v2/agents/session/state',
      host: WCC_API_GATEWAY,
      data: p.data,
      err,
      method: HTTP_METHODS.PUT,
      notifSuccess: {
        bind: {
          type: ['AgentRequestEvent', 'RoutingMessage', CC_EVENTS.AGENT_CHANNEL_STATE_CHANGE],
          data: {type: CC_EVENTS.AGENT_CHANNEL_STATE_CHANGED},
        },
        msg: {} as Agent.AgentChannelStateChanged,
      },
      notifFail: {
        bind: {
          type: ['AgentRequestEvent', 'RoutingMessage', CC_EVENTS.AGENT_CHANNEL_STATE_CHANGE],
          data: {type: CC_EVENTS.AGENT_CHANNEL_STATE_CHANGE_FAILED},
        },
        errId: 'Service.aqm.agent.stateChangeV2',
      },
    })),

    /**
     * V2 logout
     * @param p.data - Logout parameters
     * @public
     */
    logoutV2: routing.req((p: {data: Agent.Logout}) => ({
      url: '/v2/agents/logout',
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
        errId: 'Service.aqm.agent.logoutV2',
      },
    })),
  };
}
