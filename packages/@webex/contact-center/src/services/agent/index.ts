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
  // Shared configs for V1/V2 pairs that differ only in URL path and error IDs.
  const logoutConfig = (url: string, errId: Err.IdsDetails) =>
    routing.req((p: {data: Agent.Logout}) => ({
      url,
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
        errId,
      },
    }));

  const stationLoginConfig = (url: string, errId: Err.IdsDetails, errLabel: Err.IdsDetails) =>
    routing.req((p: {data: Agent.UserStationLogin}) => ({
      url,
      host: WCC_API_GATEWAY,
      data: p.data,
      err: /* istanbul ignore next */ (e: any) => {
        return new Err.Details(errLabel, {
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
        errId,
      },
    }));

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

    /** @public */
    logout: logoutConfig('/v1/agents/logout', 'Service.aqm.agent.logout'),

    /** @public */
    stationLogin: stationLoginConfig(
      '/v1/agents/login',
      'Service.aqm.agent.stationLoginFailed',
      'Service.aqm.agent.stationLogin'
    ),
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
     * V2 reload for granular sessions
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

    /** @public */
    stationLoginV2: stationLoginConfig(
      '/v2/agents/login',
      'Service.aqm.agent.stationLoginV2Failed',
      'Service.aqm.agent.stationLoginV2'
    ),

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
          data: {
            type: CC_EVENTS.AGENT_CHANNEL_STATE_CHANGED,
            channelType: p.data.channelType,
            // Correlate: only match the requested state to prevent a stale
            // notification from a prior request (e.g. Available) from settling
            // the current request (e.g. Idle).  Without this, a bulk Available
            // that resolves on the first channel leaves late Available
            // notifications that can match the next Idle request's bind.
            agentChannelStateDetail: {agentState: p.data.state},
            // Correlate: only match client-initiated notifications to prevent
            // supervisor/system pushes from resolving the pending request.
            isClientInitiated: true,
            // Correlate: only match this agent's notifications.
            ...(p.data.agentId ? {agentId: p.data.agentId} : {}),
            // Correlate: only match this session's notifications to prevent
            // a delayed notification from a prior session from resolving a
            // new-session request.
            ...(p.data.agentSessionId ? {agentSessionId: p.data.agentSessionId} : {}),
          },
        },
        msg: {} as Agent.AgentChannelStateChanged,
      },
      notifFail: {
        bind: {
          type: ['AgentRequestEvent', 'RoutingMessage', CC_EVENTS.AGENT_CHANNEL_STATE_CHANGE],
          data: {
            type: CC_EVENTS.AGENT_CHANNEL_STATE_CHANGE_FAILED,
            channelType: p.data.channelType,
            // Correlate: only match client-initiated failures to prevent a
            // supervisor-visible failure for another agent (same channelType)
            // from settling this request.  Failures that omit the field won't
            // match, falling through to the AQM timeout — safer than falsely
            // settling with another agent's error.
            isClientInitiated: true,
          },
        },
        errId: 'Service.aqm.agent.stateChangeV2',
      },
    })),

    /** @public */
    logoutV2: logoutConfig('/v2/agents/logout', 'Service.aqm.agent.logoutV2'),
  };
}
