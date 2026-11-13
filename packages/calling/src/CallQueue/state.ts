import {
  ACD_STATE,
  CallQueue,
  CallQueueAgentStatus,
  CallQueueEventKind,
  TelephonyAgentPayload,
} from './types';

const INITIAL_STATUS: CallQueueAgentStatus = {
  acdState: ACD_STATE.SIGN_OUT,
  queues: [],
};

/**
 * Maps REST and Mercury ACD values onto one enum.
 * Unknown values are dropped so a bad event cannot invent a state.
 */
export function normalizeAcdState(value: string | undefined): ACD_STATE | undefined {
  switch (value) {
    case ACD_STATE.SIGN_IN:
    case 'signIn':
      return ACD_STATE.SIGN_IN;
    case ACD_STATE.SIGN_OUT:
    case 'signOut':
      return ACD_STATE.SIGN_OUT;
    case ACD_STATE.AVAILABLE:
    case 'available':
      return ACD_STATE.AVAILABLE;
    case ACD_STATE.UNAVAILABLE:
    case 'unavailable':
      return ACD_STATE.UNAVAILABLE;
    case ACD_STATE.WRAP_UP:
    case 'wrapUp':
      return ACD_STATE.WRAP_UP;
    default:
      return undefined;
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readQueue(value: unknown): CallQueue | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const id = readString(record.id);
  const available = readBoolean(record.available);
  if (!id) {
    return undefined;
  }
  const queue: CallQueue = {id};
  if (available !== undefined) {
    queue.available = available;
  }
  const name = readString(record.name);
  const phoneNumber = readString(record.phoneNumber);
  const extension = readString(record.extension);
  const allowLogOffEnabled = readBoolean(record.allowLogOffEnabled);
  const hasCxEssentials = readBoolean(record.hasCxEssentials);
  if (name) {
    queue.name = name;
  }
  if (phoneNumber) {
    queue.phoneNumber = phoneNumber;
  }
  if (extension) {
    queue.extension = extension;
  }
  if (typeof record.skillLevel === 'number') {
    queue.skillLevel = record.skillLevel;
  }
  if (allowLogOffEnabled !== undefined) {
    queue.allowLogOffEnabled = allowLogOffEnabled;
  }
  if (hasCxEssentials !== undefined) {
    queue.hasCxEssentials = hasCxEssentials;
  }

  return queue;
}

export type CallQueueCatalogPage = {
  entries: Array<{id: string; name?: string}>;
  next?: string;
};

/** Match CSG UUIDs with catalog IDs encoded as ciscospark queue URIs. */
export function queueIdKey(id: string): string {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(id)) {
    return id.toLowerCase();
  }
  try {
    const decoded = atob(id.replace(/-/g, '+').replace(/_/g, '/'));
    const match = /^ciscospark:\/\/[^/]+\/CALL_QUEUE\/([^/]+)$/i.exec(decoded);
    if (match && uuidPattern.test(match[1])) {
      return match[1].toLowerCase();
    }
  } catch {
    // IDs outside the encoded catalog format are compared unchanged.
  }

  return id;
}

/** Encode a raw UUID for public Webex APIs; leave already encoded IDs unchanged. */
export function publicApiId(id: string, type: 'CALL_QUEUE' | 'VIRTUAL_LINE'): string {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return uuidPattern.test(id)
    ? btoa(`ciscospark://us/${type}/${id}`)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    : id;
}

/**
 * Reads the org queue list. That list carries the display name the agent settings call omits.
 */
export function parseCallQueueCatalog(body: unknown): CallQueueCatalogPage {
  if (!body || typeof body !== 'object') {
    return {entries: []};
  }
  const record = body as Record<string, unknown>;
  let list: unknown[] = [];
  if (Array.isArray(record.queues)) {
    list = record.queues;
  } else if (Array.isArray(record.items)) {
    list = record.items;
  }
  const entries = list.flatMap((value) => {
    if (!value || typeof value !== 'object') {
      return [];
    }
    const item = value as Record<string, unknown>;
    const id = readString(item.id);
    if (!id) {
      return [];
    }
    const name = readString(item.name);

    return [name ? {id, name} : {id}];
  });
  const paging = record.paging;
  const next =
    paging && typeof paging === 'object'
      ? readString((paging as Record<string, unknown>).next)
      : undefined;

  return next ? {entries, next} : {entries};
}

/**
 * Fills a missing queue name from the catalog. A name already on the queue is kept.
 */
export function applyQueueNames(
  status: CallQueueAgentStatus,
  names: ReadonlyMap<string, string>
): CallQueueAgentStatus {
  let changed = false;
  const queues = status.queues.map((queue) => {
    const name = names.get(queueIdKey(queue.id));
    if (!name || queue.name) {
      return queue;
    }
    changed = true;

    return {...queue, name};
  });

  return changed ? {...status, queues} : status;
}

/**
 * Reads a GET/PATCH body. Returns undefined when the body is not a queue settings document.
 */
export function parseCallQueueSettings(
  body: unknown,
  previous?: CallQueueAgentStatus
): CallQueueAgentStatus | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  const rawState = readString(record.agentACDState);
  const acdState = record.agentACDState == null ? previous?.acdState : normalizeAcdState(rawState);
  if ((!Array.isArray(record.queues) && !rawState) || !acdState) {
    return undefined;
  }
  const queues = Array.isArray(record.queues)
    ? record.queues.map(readQueue).filter((queue): queue is CallQueue => Boolean(queue))
    : previous?.queues ?? [];

  return {acdState, queues};
}

export function unwrapAgentPayload(event: unknown): TelephonyAgentPayload | undefined {
  if (!event || typeof event !== 'object') {
    return undefined;
  }
  const record = event as Record<string, unknown>;
  const nested = record.data;
  if (nested && typeof nested === 'object') {
    return nested as TelephonyAgentPayload;
  }

  return record as TelephonyAgentPayload;
}

function mergeQueues(current: CallQueue[], incoming: CallQueue[]): CallQueue[] {
  const byId = new Map(current.map((queue) => [queueIdKey(queue.id), queue]));
  incoming.forEach((queue) => {
    const key = queueIdKey(queue.id);
    const previous = byId.get(key);
    byId.set(key, previous ? {...previous, ...queue, id: previous.id} : queue);
  });

  return Array.from(byId.values());
}

/**
 * Applies one Mercury telephony_agent event onto the last known status.
 * A sync event replaces the queue list. State and join events merge by queue id.
 */
export function applyCallQueueEvent(
  current: CallQueueAgentStatus | undefined,
  kind: CallQueueEventKind,
  event: unknown
): CallQueueAgentStatus | undefined {
  const payload = unwrapAgentPayload(event);
  if (!payload) {
    return current;
  }
  const acdState = normalizeAcdState(
    payload.agentACDState ?? payload.acdStateInfo?.state ?? payload.state
  );
  const incomingQueues = Array.isArray(payload.queues)
    ? payload.queues.map(readQueue).filter((queue): queue is CallQueue => Boolean(queue))
    : undefined;
  const joinUpdates = Array.isArray(payload.joinInfo)
    ? payload.joinInfo.flatMap((entry) => {
        const id = readString(entry?.queueId);
        const status = readString(entry?.status)?.toLowerCase().trim();
        if (!id || !status || !['joined', 'unjoined', 'unassigned'].includes(status)) {
          return [];
        }

        return [{id, status}];
      })
    : undefined;
  const hasJoinUpdates =
    joinUpdates !== undefined && (payload.joinInfo?.length === 0 || joinUpdates.length > 0);
  if (!acdState && !incomingQueues && !hasJoinUpdates) {
    return current;
  }
  const base = current ?? INITIAL_STATUS;
  let queues = base.queues;
  if (incomingQueues) {
    if (kind === 'sync') {
      const previous = new Map(base.queues.map((queue) => [queueIdKey(queue.id), queue]));
      queues = incomingQueues.map((queue) => {
        const existing = previous.get(queueIdKey(queue.id));

        return existing ? {...existing, ...queue, id: existing.id} : queue;
      });
    } else {
      queues = mergeQueues(base.queues, incomingQueues);
    }
  }
  if (hasJoinUpdates && joinUpdates) {
    const currentById = new Map(base.queues.map((queue) => [queueIdKey(queue.id), queue]));
    const joined = joinUpdates.flatMap(({id, status}) => {
      if (status === 'unassigned') return [];
      const previous = currentById.get(queueIdKey(id));

      return [{...previous, id: previous?.id ?? id, available: status === 'joined'}];
    });
    if (kind === 'sync') {
      queues = joined;
    } else {
      const removed = new Set(
        joinUpdates.filter(({status}) => status === 'unassigned').map(({id}) => queueIdKey(id))
      );
      queues = mergeQueues(
        queues.filter((queue) => !removed.has(queueIdKey(queue.id))),
        joined
      );
    }
  }

  return {
    acdState: acdState ?? base.acdState,
    queues,
  };
}
