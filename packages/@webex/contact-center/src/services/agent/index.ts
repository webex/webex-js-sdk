import * as Err from '../core/Err';
import {createErrDetailsObject as err} from '../core/Utils';
import * as Agent from './types';
import AqmReqs from '../core/aqm-reqs';
import {HTTP_METHODS} from '../../types';
import {WCC_API_GATEWAY} from '../constants';
import {AGENT_REQUEST_EVENT_TYPE, ROUTING_MESSAGE_TYPE} from '../core/constants';
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
     * V2 per-channel state change.
     *
     * Uses a `__typeMap` conditional bind in `notifSuccess` to match the
     * WebSocket confirmation correctly for Idle requests. `__typeMap` tells
     * `aqm-reqs.bindCheck` to route by the value of a discriminator field
     * (`typeField`) instead of doing a flat equality check. When the
     * discriminator value matches a condition key, bindCheck applies the
     * sub-conditions for that key. This handles the case where an Idle
     * request's confirmation may arrive as `agentState: 'Available'` with
     * `pendingIdle: true` (queued Idle while still handling a task), rather
     * than as a direct `agentState: 'Idle'`.
     *
     * For non-Idle requests, plain array filters are used instead:
     * `agentState: [targetState, 'Engaged', ...]` accepts any of those
     * states, and `pendingIdle: [false]` uses the array path in bindCheck
     * to correctly match boolean false (the primitive path would treat
     * false as absent/missing).
     *
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
          type: [
            AGENT_REQUEST_EVENT_TYPE,
            ROUTING_MESSAGE_TYPE,
            CC_EVENTS.AGENT_CHANNEL_STATE_CHANGE,
          ],
          data: {
            type: CC_EVENTS.AGENT_CHANNEL_STATE_CHANGED,
            channelType: p.data.channelType,
            // Idle bind: __typeMap on agentState accepts immediate Idle + queued (pendingIdle: true).
            //   auxCodeId prevents cross-resolution between different idle codes.
            // Non-Idle bind: array filters reject completed Idle and queued-Idle-pending
            //   notifications from a prior request. pendingIdle: [false] uses the array
            //   path in bindCheck (line ~247), which correctly handles boolean false —
            //   the primitive path (!msgValue) would treat false as absent.
            agentChannelStateDetail:
              p.data.state === 'Idle'
                ? {
                    __typeMap: {
                      typeField: 'agentState',
                      conditions: {
                        Idle: {},
                        Available: {pendingIdle: true},
                        Engaged: {pendingIdle: true},
                        EngagedOther: {pendingIdle: true},
                        WrapUp: {pendingIdle: true},
                        Reserved: {pendingIdle: true},
                        RONA: {pendingIdle: true},
                      },
                    },
                    auxCodeId: p.data.auxCodeId,
                  }
                : {
                    agentState: [
                      p.data.state,
                      'Engaged',
                      'EngagedOther',
                      'WrapUp',
                      'Reserved',
                      'RONA',
                    ],
                    pendingIdle: [false],
                  },
            isClientInitiated: true, // Skip supervisor/system pushes
            ...(p.data.agentId ? {agentId: p.data.agentId} : {}), // Match this agent only
            ...(p.data.agentSessionId ? {agentSessionId: p.data.agentSessionId} : {}), // Match this session only
          },
        },
        msg: {} as Agent.AgentChannelStateChanged,
      },
      notifFail: {
        bind: {
          type: [
            AGENT_REQUEST_EVENT_TYPE,
            ROUTING_MESSAGE_TYPE,
            CC_EVENTS.AGENT_CHANNEL_STATE_CHANGE,
          ],
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
