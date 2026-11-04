import {ACD_STATE} from './types';
import {
  applyCallQueueEvent,
  applyQueueNames,
  normalizeAcdState,
  parseCallQueueCatalog,
  parseCallQueueSettings,
} from './state';

describe('call queue state', () => {
  describe('normalizeAcdState', () => {
    it.each([
      ['SIGN_IN', ACD_STATE.SIGN_IN],
      ['signIn', ACD_STATE.SIGN_IN],
      ['SIGN_OUT', ACD_STATE.SIGN_OUT],
      ['signOut', ACD_STATE.SIGN_OUT],
      ['AVAILABLE', ACD_STATE.AVAILABLE],
      ['available', ACD_STATE.AVAILABLE],
      ['UNAVAILABLE', ACD_STATE.UNAVAILABLE],
      ['unavailable', ACD_STATE.UNAVAILABLE],
      ['WRAP_UP', ACD_STATE.WRAP_UP],
      ['wrapUp', ACD_STATE.WRAP_UP],
    ])('maps %s to %s', (value, expected) => {
      expect(normalizeAcdState(value)).toBe(expected);
    });

    it('drops unknown values', () => {
      expect(normalizeAcdState('busy')).toBeUndefined();
      expect(normalizeAcdState(undefined)).toBeUndefined();
    });
  });

  describe('parseCallQueueSettings', () => {
    it('keeps known queue fields and drops a queue with no id', () => {
      const parsed = parseCallQueueSettings({
        agentACDState: 'AVAILABLE',
        queues: [
          {
            id: 'queue-1',
            name: 'Sales',
            phoneNumber: '+14085550100',
            available: true,
            allowLogOffEnabled: false,
            extra: 'ignore',
          },
          {available: true},
        ],
      });

      expect(parsed).toEqual({
        acdState: ACD_STATE.AVAILABLE,
        queues: [
          {
            id: 'queue-1',
            name: 'Sales',
            phoneNumber: '+14085550100',
            available: true,
            allowLogOffEnabled: false,
          },
        ],
      });
    });

    it('returns undefined for a body that is not queue settings', () => {
      expect(parseCallQueueSettings({status: 'ok'})).toBeUndefined();
      expect(parseCallQueueSettings(null)).toBeUndefined();
    });
  });

  describe('queue catalog names', () => {
    it('reads display names and the next page link', () => {
      const page = parseCallQueueCatalog({
        queues: [{id: 'queue-1', name: 'TestQueue', extension: '4000'}, {enabled: true}],
        paging: {next: 'https://integration.webexapis.com/v1/telephony/config/queues?offset=1'},
      });

      expect(page.entries).toEqual([{id: 'queue-1', name: 'TestQueue'}]);
      expect(page.next).toContain('offset=1');
    });

    it('fills only a missing name', () => {
      const names = new Map([
        ['queue-1', 'TestQueue'],
        ['queue-2', 'Catalog name'],
      ]);
      const status = {
        acdState: ACD_STATE.SIGN_OUT,
        queues: [
          {id: 'queue-1', available: true},
          {id: 'queue-2', name: 'Already named', available: true},
        ],
      };

      expect(applyQueueNames(status, names).queues).toEqual([
        {id: 'queue-1', name: 'TestQueue', available: true},
        {id: 'queue-2', name: 'Already named', available: true},
      ]);
    });
  });

  describe('applyCallQueueEvent', () => {
    const current = {
      acdState: ACD_STATE.AVAILABLE,
      queues: [
        {id: 'queue-1', name: 'Sales', available: true, allowLogOffEnabled: true},
        {id: 'queue-2', name: 'Support', available: false, allowLogOffEnabled: true},
      ],
    };

    it('replaces the queue list on a sync event', () => {
      const next = applyCallQueueEvent(current, 'sync', {
        data: {
          agentACDState: 'SIGN_IN',
          queues: [{id: 'queue-3', name: 'Billing', available: true}],
        },
      });

      expect(next).toEqual({
        acdState: ACD_STATE.SIGN_IN,
        queues: [{id: 'queue-3', name: 'Billing', available: true}],
      });
    });

    it('merges a join event by queue id and keeps the other queues', () => {
      const next = applyCallQueueEvent(current, 'join', {
        data: {
          queues: [{id: 'queue-2', available: true}],
        },
      });

      expect(next?.acdState).toBe(ACD_STATE.AVAILABLE);
      expect(next?.queues).toEqual([
        current.queues[0],
        {id: 'queue-2', name: 'Support', available: true, allowLogOffEnabled: true},
      ]);
    });

    it('reads camelCase Mercury state without clearing queues', () => {
      const next = applyCallQueueEvent(current, 'state', {
        acdStateInfo: {state: 'wrapUp'},
      });

      expect(next?.acdState).toBe(ACD_STATE.WRAP_UP);
      expect(next?.queues).toBe(current.queues);
    });

    it('ignores an event with no state and no queues', () => {
      expect(applyCallQueueEvent(current, 'state', {data: {eventType: 'heartbeat'}})).toBe(current);
      expect(applyCallQueueEvent(current, 'state', null)).toBe(current);
    });
  });
});
