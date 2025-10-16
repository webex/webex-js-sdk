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

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.AGENT_CONTACT_ASSIGN_FAILED)).toEqual({
        product,
        agent: 'service',
        target: 'agent_contact_assign',
        verb: 'fail',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.AGENT_INVITE_FAILED)).toEqual({
        product,
        agent: 'service',
        target: 'agent_invite',
        verb: 'fail',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS)).toEqual({
        product,
        agent: 'user',
        target: 'station_login',
        verb: 'complete',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.STATION_LOGIN_FAILED)).toEqual({
        product,
        agent: 'user',
        target: 'station_login',
        verb: 'fail',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.STATION_LOGOUT_SUCCESS)).toEqual({
        product,
        agent: 'user',
        target: 'station_logout',
        verb: 'complete',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.STATION_LOGOUT_FAILED)).toEqual({
        product,
        agent: 'user',
        target: 'station_logout',
        verb: 'fail',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.STATION_RELOGIN_SUCCESS)).toEqual({
        product,
        agent: 'user',
        target: 'station_relogin',
        verb: 'complete',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.STATION_RELOGIN_FAILED)).toEqual({
        product,
        agent: 'user',
        target: 'station_relogin',
        verb: 'fail',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_SUCCESS)).toEqual({
        product,
        agent: 'user',
        target: 'state_change',
        verb: 'complete',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.AGENT_STATE_CHANGE_FAILED)).toEqual({
        product,
        agent: 'user',
        target: 'state_change',
        verb: 'fail',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_SUCCESS)).toEqual({
        product,
        agent: 'user',
        target: 'buddy_agents_fetch',
        verb: 'complete',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.FETCH_BUDDY_AGENTS_FAILED)).toEqual({
        product,
        agent: 'user',
        target: 'buddy_agents_fetch',
        verb: 'fail',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_SUCCESS)).toEqual({
        product,
        agent: 'user',
        target: 'websocket_register',
        verb: 'complete',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.WEBSOCKET_REGISTER_FAILED)).toEqual({
        product,
        agent: 'user',
        target: 'websocket_register',
        verb: 'fail',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.TASK_CONFERENCE_START_SUCCESS)).toEqual({
        product,
        agent: 'user',
        target: 'task_conference_start',
        verb: 'complete',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.TASK_CONFERENCE_START_FAILED)).toEqual({
        product,
        agent: 'user',
        target: 'task_conference_start',
        verb: 'fail',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.TASK_CONFERENCE_END_SUCCESS)).toEqual({
        product,
        agent: 'user',
        target: 'task_conference_end',
        verb: 'complete',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.TASK_CONFERENCE_END_FAILED)).toEqual({
        product,
        agent: 'user',
        target: 'task_conference_end',
        verb: 'fail',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.TASK_CONFERENCE_TRANSFER_SUCCESS)).toEqual({
        product,
        agent: 'user',
        target: 'task_conference_transfer',
        verb: 'complete',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.TASK_CONFERENCE_TRANSFER_FAILED)).toEqual({
        product,
        agent: 'user',
        target: 'task_conference_transfer',
        verb: 'fail',
      });

      expect(getEventTaxonomy('' as METRIC_EVENT_NAMES)).toEqual(undefined);
    });
  });
});
