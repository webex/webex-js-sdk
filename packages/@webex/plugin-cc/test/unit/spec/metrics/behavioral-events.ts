import {PRODUCT_NAME as product} from '../../../../src/constants';
import {getEventTaxonomy} from '../../../../src/metrics/behavioral-events';
import {METRIC_EVENT_NAMES} from '../../../../src/metrics/constants';

describe('metrics/behavioral-events', () => {
  describe('getEventTaxonomy', () => {
    it('returns the correct taxonomy for the given event', () => {
      expect(getEventTaxonomy(METRIC_EVENT_NAMES.AGENT_RONA)).toEqual({
        product,
        agent: 'service',
        target: 'agent_rona',
        verb: 'set',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.STATION_LOGIN)).toEqual({
        product,
        agent: 'user',
        target: 'station',
        verb: 'login',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.CALL_COMPLETED)).toEqual({
        product,
        agent: 'user',
        target: 'call',
        verb: 'complete',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.CALL_CONSULT_ACTIVATE)).toEqual({
        product,
        agent: 'user',
        target: 'call_consult',
        verb: 'activate',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.CALL_TRANSFER_ACTIVATE)).toEqual({
        product,
        agent: 'user',
        target: 'call_transfer',
        verb: 'activate',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.CALL_ANSWERED)).toEqual({
        product,
        agent: 'user',
        target: 'call',
        verb: 'answer',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.TASK_END)).toEqual({
        product,
        agent: 'user',
        target: 'task',
        verb: 'complete',
      });

      expect(getEventTaxonomy('' as METRIC_EVENT_NAMES)).toEqual(undefined);

    });
  });
});
