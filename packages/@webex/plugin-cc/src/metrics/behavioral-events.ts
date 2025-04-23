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

export function getEventTaxonomy(name: METRIC_EVENT_NAMES): BehavioralEventTaxonomy | undefined {
  // Adding new metrics? Please add them to the Cypher CC metrics wiki
  // Also need to get them allowed in the metrics service by requesting in Ask metrics-A

  const product: MetricEventProduct = PRODUCT_NAME;

  switch (name) {
    case METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS:
      return {
        product,
        agent: 'user',
        target: 'station_login',
        verb: 'complete',
      };
    case METRIC_EVENT_NAMES.STATION_LOGIN_FAILED:
      return {
        product,
        agent: 'user',
        target: 'station_login',
        verb: 'fail',
      };
    case METRIC_EVENT_NAMES.STATION_LOGOUT_SUCCESS:
      return {
        product,
        agent: 'user',
        target: 'station_logout',
        verb: 'complete',
      };
    case METRIC_EVENT_NAMES.STATION_LOGOUT_FAILED:
      return {
        product,
        agent: 'user',
        target: 'station_logout',
        verb: 'fail',
      };
    case METRIC_EVENT_NAMES.STATION_RELOGIN_SUCCESS:
      return {
        product,
        agent: 'user',
        target: 'station_relogin',
        verb: 'complete',
      };
    case METRIC_EVENT_NAMES.STATION_RELOGIN_FAILED:
      return {
        product,
        agent: 'user',
        target: 'station_relogin',
        verb: 'fail',
      };
    case METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_SUCCESS:
      return {
        product,
        agent: 'user',
        target: 'state_change',
        verb: 'complete',
      };
    case METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED:
      return {
        product,
        agent: 'user',
        target: 'state_change',
        verb: 'fail',
      };
    case METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_SUCCESS:
      return {
        product,
        agent: 'user',
        target: 'buddy_agents_fetch',
        verb: 'complete',
      };
    case METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_FAILED:
      return {
        product,
        agent: 'user',
        target: 'buddy_agents_fetch',
        verb: 'fail',
      };
    case METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_SUCCESS:
      return {
        product,
        agent: 'user',
        target: 'websocket_register',
        verb: 'complete',
      };
    case METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED:
      return {
        product,
        agent: 'user',
        target: 'websocket_register',
        verb: 'fail',
      };
    case METRIC_EVENT_NAMES.AGENT_RONA:
      return {
        product,
        agent: 'service',
        target: 'agent_rona',
        verb: 'set',
      };
    case METRIC_EVENT_NAMES.UPLOAD_LOGS_SUCCESS:
      return {
        product,
        agent: 'user',
        target: 'upload_logs',
        verb: 'complete',
      };
    case METRIC_EVENT_NAMES.UPLOAD_LOGS_FAILED:
      return {
        product,
        agent: 'user',
        target: 'upload_logs',
        verb: 'fail',
      };
    default:
      break;
  }

  return undefined;
}
