import {LOGGER} from '../Logger/types';
import {COMMON_EVENT_KEYS} from '../Events/types';

export interface LoggerInterface {
  level: LOGGER;
}

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
  getCallQueueSettings(lineOwnerId?: string): Promise<CallQueueResponse>;
  updateCallQueueSettings(
    request: UpdateCallQueueSettingsRequest,
    lineOwnerId?: string
  ): Promise<CallQueueResponse>;
  syncTelephonyCalls(): Promise<CallQueueResponse>;
  /** Remove this client's Mercury listeners. */
  dispose(): void;
}

export type CallQueueEventKind = 'sync' | 'state' | 'join';

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
