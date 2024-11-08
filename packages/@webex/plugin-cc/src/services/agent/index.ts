import * as Err from '../core/Err';
import {Failure, Msg} from '../core/GlobalTypes';
import {createErrDetailsObject as err, getRoutingHost} from '../core/Utils';
import * as Agent from './types';
import {AqmReqs} from '../core/aqm-reqs';
import {HTTP_METHODS} from '../../types';

/*
 * routingAgent
 * @param reqs
 * @category Routing Service
 */

export default function routingAgent(routing: AqmReqs) {
  return {
    reload: routing.reqEmpty(() => ({
      host: getRoutingHost(),
      url: '/v1/agents/reload',
      data: {},
      err,
      notifSuccess: {
        bind: {
          type: 'AgentReloginSuccess',
          data: {type: 'AgentReloginSuccess'},
        },
        msg: {} as Agent.ReloginSuccess,
      },
      notifFail: {
        bind: {
          type: 'AgentReloginFailed',
          data: {type: 'AgentReloginFailed'},
        },
        errId: 'Service.aqm.agent.reload',
      },
    })),
    logout: routing.req((p: {data: Agent.Logout}) => ({
      url: '/v1/agents/logout',
      host: getRoutingHost(),
      data: p.data,
      err,
      notifSuccess: {
        bind: {
          type: 'Logout',
          data: {type: 'AgentLogoutSuccess'},
        },
        msg: {} as Agent.LogoutSuccess,
      },
      notifFail: {
        bind: {
          type: 'Logout',
          data: {type: 'AgentLogoutFailed'},
        },
        errId: 'Service.aqm.agent.logout',
      },
    })),
    stationLogin: routing.req((p: {data: Agent.UserStationLogin}) => ({
      url: '/v1/agents/login',
      host: getRoutingHost(),
      data: p.data,
      err: /* istanbul ignore next */ (e: any) =>
        new Err.Details('Service.aqm.agent.stationLogin', {
          status: e.response?.status ?? 0,
          type: e.response?.data?.errorType,
          trackingId: e.response?.headers?.trackingid?.split('_')[1],
        }),
      notifSuccess: {
        bind: {
          type: 'StationLogin',
          data: {type: 'AgentStationLoginSuccess'},
        },
        msg: {} as Agent.StationLoginSuccess,
      },
      notifFail: {
        bind: {
          type: 'StationLogin',
          data: {type: 'AgentStationLoginFailed'},
        },
        errId: 'Service.aqm.agent.stationLoginFailed',
      },
    })),
    stateChange: routing.req((p: {data: Agent.StateChange}) => ({
      url: '/v1/agents/session/state',
      host: getRoutingHost(),
      data: {...p.data, auxCodeId: p.data.auxCodeIdArray},
      err,
      method: HTTP_METHODS.PUT,
      notifSuccess: {
        bind: {
          type: 'AgentStateChange',
          data: {type: 'AgentStateChangeSuccess'},
        },
        msg: {} as Agent.StateChangeSuccess,
      },
      notifFail: {
        bind: {
          type: 'AgentStateChange',
          data: {type: 'AgentStateChangeFailed'},
        },
        errId: 'Service.aqm.agent.stateChange',
      },
    })),
    eMockOutdialAniList: routing.evt({
      bind: {
        type: 'mockOutdialAniList',
      },
      msg: {} as Agent.OutdialAniListSuccess,
    }),

    eAgentDNRegistered: routing.evt({
      bind: {
        type: 'RoutingMessage',
        data: {type: 'AgentDNRegistered'},
      },
      msg: {} as Agent.DNRegistered,
    }),

    eAgentDNRegisterFailure: routing.evt({
      bind: {
        type: 'RoutingMessage',
        data: {type: 'AgentDNRegisterFailure'},
      },
      msg: {} as Failure,
    }),

    eAgentMultiLogin: routing.evt({
      bind: {
        type: 'AGENT_MULTI_LOGIN',
        data: {type: 'AgentMultiLoginCloseSession'},
      },
      msg: {} as Msg<{
        agentId: string;
        reason: string;
        type: 'AgentMultiLoginCloseSession';
        agentSessionId: string;
      }>,
    }),

    // jsapi required events
    eAgentReloginSuccess: routing.evt({
      bind: {
        type: 'AgentReloginSuccess',
        data: {type: 'AgentReloginSuccess'},
      },
      msg: {} as Agent.ReloginSuccess,
    }),
    eAgentStationLoginSuccess: routing.evt({
      bind: {
        type: 'StationLogin',
        data: {type: 'AgentStationLoginSuccess'},
      },
      msg: {} as Agent.StationLoginSuccess,
    }),
    eAgentStateChangeSuccess: routing.evt({
      bind: {
        type: 'AgentStateChange',
        data: {type: 'AgentStateChangeSuccess'},
      },
      msg: {} as Agent.StateChangeSuccess,
    }),
    eAgentLogoutSuccess: routing.evt({
      bind: {
        type: 'Logout',
        data: {type: 'AgentLogoutSuccess'},
      },
      msg: {} as Agent.LogoutSuccess,
    }),
  };
}
