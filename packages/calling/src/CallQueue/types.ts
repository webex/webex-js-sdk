import {LOGGER} from '../Logger/types';
import {COMMON_EVENT_KEYS} from '../Events/types';

export interface LoggerInterface {
  level: LOGGER;
}

/** Public Webex API gateway used for call queue requests. */
export type CallQueueClientOptions = {
  webexApiBaseUrl: string;
};

/**
 * Agent ACD state. REST uses these names. Mercury may send the camelCase form.
 */
export enum ACD_STATE {
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
  WRAP_UP = 'WRAP_UP',
}

export type CallQueue = {
  id: string;
  name?: string;
  phoneNumber?: string;
  extension?: string;
  available?: boolean;
  skillLevel?: number;
  allowLogOffEnabled?: boolean;
  hasCxEssentials?: boolean;
};

export type CallQueueAgentStatus = {
  acdState: ACD_STATE;
  queues: CallQueue[];
};

export type CallQueueCatalogPage = {
  entries: Array<{id: string; name?: string}>;
  next?: string;
};

export type CallQueueJoinUpdate = {
  id: string;
  available: boolean;
};

export type UpdateCallQueueSettingsRequest = {
  agentACDState?: ACD_STATE;
  queues?: CallQueueJoinUpdate[];
};

export type CallQueueResponse = {
  statusCode: number;
  data: {
    callQueue?: CallQueueAgentStatus;
    error?: string;
  };
  message: string | null;
};

export type CallQueueEventTypes = {
  [COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED]: (
    status: CallQueueAgentStatus & {lineOwnerId?: string}
  ) => void;
};

export interface ICallQueue {
  /**
   * Subscribe to a call-queue update event.
   *
   * @param event - The call-queue event name.
   * @param listener - The callback invoked with the updated status.
   * @returns This client, for chaining.
   * @example
   * ```js
   * callQueue.on('callQueue:updated', listener);
   * ```
   * @public
   */
  on<Event extends keyof CallQueueEventTypes>(
    event: Event,
    listener: CallQueueEventTypes[Event]
  ): this;
  /**
   * Remove a previously registered call-queue update listener.
   *
   * @param event - The call-queue event name.
   * @param listener - The callback to remove.
   * @returns This client, for chaining.
   * @example
   * ```js
   * callQueue.off('callQueue:updated', listener);
   * ```
   * @public
   */
  off<Event extends keyof CallQueueEventTypes>(
    event: Event,
    listener: CallQueueEventTypes[Event]
  ): this;
  /**
   * Read the agent state and queue memberships for a line.
   *
   * @param lineOwnerId - Optional secondary line owner ID; omit for the primary line.
   * @returns The queue settings or an error response.
   * @example
   * ```js
   * const result = await callQueue.getCallQueueSettings();
   * ```
   * @public
   */
  getCallQueueSettings(lineOwnerId?: string): Promise<CallQueueResponse>;
  /**
   * Update the agent state or queue membership for a line.
   *
   * @param request - The agent state and/or queue membership updates.
   * @param lineOwnerId - Optional secondary line owner ID; omit for the primary line.
   * @returns The updated settings or an error response.
   * @example
   * ```js
   * await callQueue.updateCallQueueSettings({agentACDState: 'AVAILABLE'});
   * ```
   * @public
   */
  updateCallQueueSettings(
    request: UpdateCallQueueSettingsRequest,
    lineOwnerId?: string
  ): Promise<CallQueueResponse>;
  /**
   * Request that the calling service publish the current agent state on Mercury.
   *
   * @returns The sync request result or an error response.
   * @example
   * ```js
   * await callQueue.syncTelephonyCalls();
   * ```
   * @public
   */
  syncTelephonyCalls(): Promise<CallQueueResponse>;
  /**
   * Refresh backend readiness and invalidate cached state and pending requests before reuse.
   *
   * @returns Whether this client can be reused.
   * @example
   * ```js
   * const reusable = callQueue.prepareForReuse?.();
   * ```
   * @public
   */
  prepareForReuse?(): boolean;
  /**
   * Remove this client's Mercury listeners for the queue event names.
   *
   * @returns Nothing.
   * @example
   * ```js
   * callQueue.dispose();
   * ```
   * @public
   */
  dispose(): void;
}

export type CallQueueEventKind = 'sync' | 'state' | 'join';

export type EventLine =
  | {kind: 'primary'}
  | {kind: 'secondary'; lineOwnerId: string}
  | {kind: 'ignore'};

export type TelephonyAgentQueue = {
  id?: string;
  name?: string;
  phoneNumber?: string;
  extension?: string;
  available?: boolean;
  skillLevel?: number;
  allowLogOffEnabled?: boolean;
  hasCxEssentials?: boolean;
};

export type TelephonyAgentPayload = {
  eventType?: string;
  actorId?: string;
  actorPersonId?: string;
  actorType?: string;
  state?: string;
  agentACDState?: string;
  acdStateInfo?: {
    state?: string;
  };
  queues?: TelephonyAgentQueue[];
  joinInfo?: Array<{queueId?: string; status?: string; skillLevel?: string | number}>;
};
