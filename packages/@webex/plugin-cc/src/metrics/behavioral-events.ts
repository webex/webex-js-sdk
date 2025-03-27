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
    case METRIC_EVENT_NAMES.STATION_LOGIN:
      return {
        product,
        agent: 'user',
        target: 'station',
        verb: 'login',
      };
    case METRIC_EVENT_NAMES.CALL_COMPLETED:
      return {
        product,
        agent: 'user',
        target: 'call',
        verb: 'complete',
      };
    case METRIC_EVENT_NAMES.CALL_CONSULT_ACTIVATE:
      return {
        product,
        agent: 'user',
        target: 'call_consult',
        verb: 'activate',
      };
    case METRIC_EVENT_NAMES.CALL_TRANSFER_ACTIVATE:
      return {
        product,
        agent: 'user',
        target: 'call_transfer',
        verb: 'activate',
      };
    case METRIC_EVENT_NAMES.CALL_ANSWERED:
      return {
        product,
        agent: 'user',
        target: 'call',
        verb: 'answer',
      };
    case METRIC_EVENT_NAMES.AGENT_RONA:
      return {
        product,
        agent: 'service',
        target: 'agent_rona',
        verb: 'set',
      };
    case METRIC_EVENT_NAMES.TASK_END:
      return {
        product,
        agent: 'user',
        target: 'task',
        verb: 'complete',
      };
    default:
      break;
  }

  return undefined;
}
