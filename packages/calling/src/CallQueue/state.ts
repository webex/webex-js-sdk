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
  if (!id || available === undefined) {
    return undefined;
  }
  const queue: CallQueue = {id, available};
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

/**
 * Reads the org queue list. That list carries the display name the agent settings call omits.
 */
export function parseCallQueueCatalog(body: unknown): CallQueueCatalogPage {
  if (!body || typeof body !== 'object') {
    return {entries: []};
  }
  const record = body as Record<string, unknown>;
  const list = Array.isArray(record.queues)
    ? record.queues
    : Array.isArray(record.items)
    ? record.items
    : [];
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
    const name = names.get(queue.id);
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
export function parseCallQueueSettings(body: unknown): CallQueueAgentStatus | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  const acdState = normalizeAcdState(readString(record.agentACDState));
  if (!Array.isArray(record.queues) && !acdState) {
    return undefined;
  }
  const queues = Array.isArray(record.queues)
    ? record.queues.map(readQueue).filter((queue): queue is CallQueue => Boolean(queue))
    : [];

  return {
    acdState: acdState ?? ACD_STATE.SIGN_OUT,
    queues,
  };
}

function unwrapPayload(event: unknown): TelephonyAgentPayload | undefined {
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
  const byId = new Map(current.map((queue) => [queue.id, queue]));
  incoming.forEach((queue) => {
    const previous = byId.get(queue.id);
    byId.set(queue.id, previous ? {...previous, ...queue} : queue);
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
  const payload = unwrapPayload(event);
  if (!payload) {
    return current;
  }
  const acdState = normalizeAcdState(payload.agentACDState ?? payload.acdStateInfo?.state);
  const incomingQueues = Array.isArray(payload.queues)
    ? payload.queues.map(readQueue).filter((queue): queue is CallQueue => Boolean(queue))
    : undefined;
  if (!acdState && !incomingQueues) {
    return current;
  }
  const base = current ?? INITIAL_STATUS;
  const queues = incomingQueues
    ? kind === 'sync'
      ? incomingQueues
      : mergeQueues(base.queues, incomingQueues)
    : base.queues;

  return {
    acdState: acdState ?? base.acdState,
    queues,
  };
}
