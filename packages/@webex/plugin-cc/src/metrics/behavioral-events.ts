import {
  MetricEventAgent,
  MetricEventProduct,
  MetricEventVerb,
} from '@webex/internal-plugin-metrics/src/metrics.types';

import {METRIC_EVENT_NAMES} from './constants';
import {PRODUCT_NAME} from '../constants';

export type BehavioralEventTaxonomy = {
  product: MetricEventProduct;
  agent: MetricEventAgent;
  target: string;
  verb: MetricEventVerb;
};

const product: MetricEventProduct = PRODUCT_NAME;

// Adding new metrics? Please add them to the Cypher CC metrics wiki

const eventTaxonomyMap: Record<string, BehavioralEventTaxonomy> = {
  [METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS]: {
    product,
    agent: 'user',
    target: 'station_login',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.STATION_LOGIN_FAILED]: {
    product,
    agent: 'user',
    target: 'station_login',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.STATION_LOGOUT_SUCCESS]: {
    product,
    agent: 'user',
    target: 'station_logout',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.STATION_LOGOUT_FAILED]: {
    product,
    agent: 'user',
    target: 'station_logout',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.STATION_RELOGIN_SUCCESS]: {
    product,
    agent: 'user',
    target: 'station_relogin',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.STATION_RELOGIN_FAILED]: {
    product,
    agent: 'user',
    target: 'station_relogin',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_SUCCESS]: {
    product,
    agent: 'user',
    target: 'state_change',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED]: {
    product,
    agent: 'user',
    target: 'state_change',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_SUCCESS]: {
    product,
    agent: 'user',
    target: 'buddy_agents_fetch',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_FAILED]: {
    product,
    agent: 'user',
    target: 'buddy_agents_fetch',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_SUCCESS]: {
    product,
    agent: 'user',
    target: 'websocket_register',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED]: {
    product,
    agent: 'user',
    target: 'websocket_register',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.AGENT_RONA]: {
    product,
    agent: 'service',
    target: 'agent_rona',
    verb: 'set',
  },

  // Added Task events
  [METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS]: {
    product,
    agent: 'user',
    target: 'task_accept',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED]: {
    product,
    agent: 'user',
    target: 'task_accept',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.TASK_DECLINE_SUCCESS]: {
    product,
    agent: 'user',
    target: 'task_decline',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.TASK_DECLINE_FAILED]: {
    product,
    agent: 'user',
    target: 'task_decline',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.TASK_END_SUCCESS]: {
    product,
    agent: 'user',
    target: 'task_end',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.TASK_END_FAILED]: {
    product,
    agent: 'user',
    target: 'task_end',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.TASK_WRAPUP_SUCCESS]: {
    product,
    agent: 'user',
    target: 'task_wrapup',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.TASK_WRAPUP_FAILED]: {
    product,
    agent: 'user',
    target: 'task_wrapup',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.TASK_HOLD_SUCCESS]: {
    product,
    agent: 'user',
    target: 'task_hold',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.TASK_HOLD_FAILED]: {
    product,
    agent: 'user',
    target: 'task_hold',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.TASK_RESUME_SUCCESS]: {
    product,
    agent: 'user',
    target: 'task_resume',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.TASK_RESUME_FAILED]: {
    product,
    agent: 'user',
    target: 'task_resume',
    verb: 'fail',
  },

  // Advanced Tasks handling
  [METRIC_EVENT_NAMES.TASK_CONSULT_START_SUCCESS]: {
    product,
    agent: 'user',
    target: 'task_consult_start',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.TASK_CONSULT_START_FAILED]: {
    product,
    agent: 'user',
    target: 'task_consult_start',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.TASK_CONSULT_END_SUCCESS]: {
    product,
    agent: 'user',
    target: 'task_consult_end',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.TASK_CONSULT_END_FAILED]: {
    product,
    agent: 'user',
    target: 'task_consult_end',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.TASK_TRANSFER_SUCCESS]: {
    product,
    agent: 'user',
    target: 'task_transfer',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.TASK_TRANSFER_FAILED]: {
    product,
    agent: 'user',
    target: 'task_transfer',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.TASK_RESUME_RECORDING_SUCCESS]: {
    product,
    agent: 'user',
    target: 'task_resume_recording',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.TASK_RESUME_RECORDING_FAILED]: {
    product,
    agent: 'user',
    target: 'task_resume_recording',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.TASK_PAUSE_RECORDING_SUCCESS]: {
    product,
    agent: 'user',
    target: 'task_pause_recording',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.TASK_PAUSE_RECORDING_FAILED]: {
    product,
    agent: 'user',
    target: 'task_pause_recording',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.TASK_ACCEPT_CONSULT_SUCCESS]: {
    product,
    agent: 'user',
    target: 'task_accept_consult',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.TASK_ACCEPT_CONSULT_FAILED]: {
    product,
    agent: 'user',
    target: 'task_accept_consult',
    verb: 'fail',
  },
  [METRIC_EVENT_NAMES.TASK_OUTDIAL_SUCCESS]: {
    product,
    agent: 'user',
    target: 'task_outdial',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.TASK_OUTDIAL_FAILED]: {
    product,
    agent: 'user',
    target: 'task_outdial',
    verb: 'fail',
  },

  // upload logs
  [METRIC_EVENT_NAMES.UPLOAD_LOGS_SUCCESS]: {
    product,
    agent: 'user',
    target: 'upload_logs',
    verb: 'complete',
  },
  [METRIC_EVENT_NAMES.UPLOAD_LOGS_FAILED]: {
    product,
    agent: 'user',
    target: 'upload_logs',
    verb: 'fail',
  },
};

export function getEventTaxonomy(name: METRIC_EVENT_NAMES): BehavioralEventTaxonomy | undefined {
  return eventTaxonomyMap[name];
}
