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

      expect(
        getEventTaxonomy(METRIC_EVENT_NAMES.TASK_CONFERENCE_PARTICIPANT_DROP_SUCCESS)
      ).toEqual({
        product,
        agent: 'user',
        target: 'task_conference_participant_drop',
        verb: 'complete',
      });

      expect(
        getEventTaxonomy(METRIC_EVENT_NAMES.TASK_CONFERENCE_PARTICIPANT_DROP_FAILED)
      ).toEqual({
        product,
        agent: 'user',
        target: 'task_conference_participant_drop',
        verb: 'fail',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.TASK_AUTO_ANSWER_SUCCESS)).toEqual({
        product,
        agent: 'user',
        target: 'task_auto_answer',
        verb: 'complete',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.TASK_AUTO_ANSWER_FAILED)).toEqual({
        product,
        agent: 'user',
        target: 'task_auto_answer',
        verb: 'fail',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.WXAPP_TASK_ACCEPT_SUCCESS)).toEqual({
        product,
        agent: 'user',
        target: 'wxapp_task_accept',
        verb: 'complete',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.WXAPP_SESSION_SKIPPED)).toEqual({
        product,
        agent: 'user',
        target: 'wxapp_session_init',
        verb: 'ignore',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.WXAPP_USERSUB_PUBLISH_SUCCESS)).toEqual({
        product,
        agent: 'user',
        target: 'wxapp_usersub_publish',
        verb: 'complete',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.WXAPP_MERCURY_SUBSCRIBE_FAILED)).toEqual({
        product,
        agent: 'user',
        target: 'wxapp_mercury_subscribe',
        verb: 'fail',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.WXAPP_TASK_MUTE_SUCCESS)).toEqual({
        product,
        agent: 'user',
        target: 'wxapp_task_mute',
        verb: 'complete',
      });

      expect(getEventTaxonomy(METRIC_EVENT_NAMES.WXAPP_TASK_DTMF_FAILED)).toEqual({
        product,
        agent: 'user',
        target: 'wxapp_task_dtmf',
        verb: 'fail',
      });

      expect(getEventTaxonomy('' as METRIC_EVENT_NAMES)).toEqual(undefined);
    });
  });
});
