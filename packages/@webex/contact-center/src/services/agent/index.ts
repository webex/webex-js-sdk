import * as Err from '../core/Err';
import {createErrDetailsObject as err, normalizeRecoveryFailure} from '../core/Utils';
import * as Agent from './types';
import AqmReqs from '../core/aqm-reqs';
import {HTTP_METHODS, LoginOption} from '../../types';
import {EMPTY_STRING} from '../../constants';
import {AGENT, WCC_API_GATEWAY, WEB_RTC_PREFIX} from '../constants';
import {AGENT_STATE_AVAILABLE} from '../config/constants';
import {CC_EVENTS} from '../config/types';
import type {AgentLogin} from '../../types';
import type {RecoveryFailure} from '../core/types';

/** @internal */
export function buildStationLoginPayload(
  data: AgentLogin,
  agentId: string
): Agent.UserStationLogin {
  const {loginOption, dialNumber, teamId} = data;
  const deviceId =
    loginOption === LoginOption.EXTENSION || loginOption === LoginOption.AGENT_DN
      ? dialNumber
      : WEB_RTC_PREFIX + agentId;

  return {
    dialNumber: loginOption === LoginOption.BROWSER ? deviceId : dialNumber,
    teamId,
    deviceType: loginOption,
    isExtension: loginOption === LoginOption.EXTENSION,
    deviceId,
    roles: [AGENT],
    teamName: EMPTY_STRING,
    siteId: EMPTY_STRING,
    usesOtherDN: false,
    auxCodeId: EMPTY_STRING,
  };
}

/** @internal */
export function getStationRecoveryFailureCategory(
  failure: RecoveryFailure
): 'cancelled' | 'auth' | 'transient' | 'fallback' | 'exists' | 'other' {
  if (failure.reason === 'RECOVERY_INTERRUPTED' || failure.id === 'AbortError') return 'cancelled';
  if (failure.status === 401 || failure.status === 403) return 'auth';
  const codes = {1037: 'transient', 1038: 'fallback', 1041: 'fallback', 1035: 'exists'} as const;
  if (codes[failure.reasonCode]) return codes[failure.reasonCode];
  if (['AGENT_NOT_FOUND', 'AGENT_DN_NOT_REGISTERED'].includes(failure.reason)) return 'fallback';
  if (failure.reason === 'AGENT_SESSION_ALREADY_EXISTS') return 'exists';
  if (failure.reason === 'INTERNAL_ERROR') return 'transient';
  if (
    [
      'Timeout',
      'TimeoutEvent',
      'Service.aqm.reqs.Timeout',
      'Service.aqm.reqs.TimeoutEvent',
    ].includes(failure.id) ||
    [429, 502, 503].includes(failure.status)
  )
    return 'transient';

  return 'other';
}

/** @internal */
export type AgentStateVersion = {
  lastStateChangeTimestamp: number;
  lastIdleCodeChangeTimestamp?: number | null;
};

/** @internal */
export function hasAgentStateVersion<
  T extends {
    lastStateChangeTimestamp?: unknown;
    lastIdleCodeChangeTimestamp?: unknown;
    subStatus?: unknown;
  }
>(data: T): data is T & AgentStateVersion {
  return (
    Number.isFinite(data.lastStateChangeTimestamp) &&
    (Number.isFinite(data.lastIdleCodeChangeTimestamp) ||
      (data.subStatus === AGENT_STATE_AVAILABLE && data.lastIdleCodeChangeTimestamp == null))
  );
}

/** @internal */
export function compareAgentStateVersions(
  current: AgentStateVersion,
  previous: AgentStateVersion
): number {
  const stateDifference = current.lastStateChangeTimestamp - previous.lastStateChangeTimestamp;
  const currentIdle = current.lastIdleCodeChangeTimestamp;
  const previousIdle = previous.lastIdleCodeChangeTimestamp;
  if (stateDifference || currentIdle == null || previousIdle == null) return stateDifference;

  return currentIdle - previousIdle;
}

/**
 * Agent Service provides methods to manage agent states and operations
 * @param routing - AqmReqs instance for making API requests
 * @ignore
 */
export default function routingAgent(routing: AqmReqs) {
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
