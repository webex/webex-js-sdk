import {ACD_STATE} from './types';
import {
  applyCallQueueEvent,
  applyQueueNames,
  normalizeAcdState,
  parseCallQueueCatalog,
  parseCallQueueSettings,
  publicApiId,
  queueIdKey,
} from './state';

describe('call queue state', () => {
  it.each(['CALL_QUEUE', 'VIRTUAL_LINE'] as const)('encodes %s UUIDs for public APIs', (type) => {
    const id = '4ab6bdda-c684-48f3-9217-60fdbb8049b3';
    const encoded = publicApiId(id, type);
    expect(atob(encoded)).toBe(`ciscospark://us/${type}/${id}`);
    expect(publicApiId(encoded, type)).toBe(encoded);
  });
  it('matches CSG UUIDs to encoded queue catalog IDs without changing other IDs', () => {
    const id = '4ab6bdda-c684-48f3-9217-60fdbb8049b3';
    const encodedQueue =
      'Y2lzY29zcGFyazovL3VzL0NBTExfUVVFVUUvNGFiNmJkZGEtYzY4NC00OGYzLTkyMTctNjBmZGJiODA0OWIz';
    const encodedPerson = btoa(`ciscospark://us/PEOPLE/${id}`);

    expect(queueIdKey(encodedQueue)).toBe(id);
    expect(queueIdKey(id.toUpperCase())).toBe(id);
    expect(queueIdKey(encodedPerson)).toBe(encodedPerson);
    expect(queueIdKey('not-an-id')).toBe('not-an-id');
  });

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

    it('does not invent an agent state when it is absent', () => {
      const body = {queues: [{id: 'queue-1', available: true}]};
      expect(parseCallQueueSettings(body)).toBeUndefined();
      expect(parseCallQueueSettings(body, {acdState: ACD_STATE.UNAVAILABLE, queues: []})).toEqual({
        acdState: ACD_STATE.UNAVAILABLE,
        queues: body.queues,
      });
      expect(
        parseCallQueueSettings(
          {agentACDState: 'bad', queues: []},
          {
            acdState: ACD_STATE.AVAILABLE,
            queues: [],
          }
        )
      ).toBeUndefined();
    });

    it('retains a queue when the optional availability field is absent', () => {
      const parsed = parseCallQueueSettings({
        agentACDState: 'AVAILABLE',
        queues: [{id: 'queue-1', extension: '4000'}],
      });
      expect(parsed?.queues).toEqual([{id: 'queue-1', extension: '4000'}]);
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
    it('merges an event UUID into the corresponding encoded queue ID', () => {
      const id = '4ab6bdda-c684-48f3-9217-60fdbb8049b3';
      const encoded = publicApiId(id, 'CALL_QUEUE');
      const current = {acdState: ACD_STATE.AVAILABLE, queues: [{id: encoded, available: false}]};
      const result = applyCallQueueEvent(current, 'join', {queues: [{id, available: true}]});

      expect(result?.queues).toEqual([{id: encoded, available: true}]);
    });
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

    it('applies a documented agent sync with joinInfo while preserving known metadata', () => {
      const next = applyCallQueueEvent(current, 'sync', {
        data: {
          acdStateInfo: {state: 'unavailable'},
          joinInfo: [{queueId: 'queue-2', status: 'joined'}],
        },
      });
      expect(next).toEqual({
        acdState: ACD_STATE.UNAVAILABLE,
        queues: [{id: 'queue-2', name: 'Support', available: true, allowLogOffEnabled: true}],
      });
    });

    it.each([
      ['joined', true],
      ['unjoined', false],
    ])('maps a %s join event to queue availability', (status, available) => {
      const next = applyCallQueueEvent(current, 'join', {
        data: {joinInfo: [{queueId: 'queue-2', status}]},
      });
      expect(next?.queues).toEqual([current.queues[0], {...current.queues[1], available}]);
    });

    it('removes unassigned queues and ignores unrecognized join statuses', () => {
      const removed = applyCallQueueEvent(current, 'join', {
        data: {joinInfo: [{queueId: 'queue-1', status: 'unassigned'}]},
      });
      expect(removed?.queues).toEqual([current.queues[1]]);
      expect(
        applyCallQueueEvent(current, 'join', {
          data: {joinInfo: [{queueId: 'queue-1', status: 'other'}]},
        })
      ).toBe(current);
    });

    it('accepts top-level state in a Mercury data envelope', () => {
      expect(applyCallQueueEvent(current, 'state', {data: {state: 'unavailable'}})?.acdState).toBe(
        ACD_STATE.UNAVAILABLE
      );
    });
  });
});
