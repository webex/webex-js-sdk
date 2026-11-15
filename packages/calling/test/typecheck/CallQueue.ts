import {ACD_STATE, CallQueueAgentStatus, COMMON_EVENT_KEYS, ICallQueue} from '../../src';

export function verifyCallQueueEventTypes(client: ICallQueue): void {
  const listener = (status: CallQueueAgentStatus & {lineOwnerId?: string}) => {
    const state: ACD_STATE = status.acdState;
    const lineOwnerId: string | undefined = status.lineOwnerId;
    return {state, lineOwnerId, queues: status.queues};
  };

  client
    .on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener)
    .off(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);

  // @ts-expect-error The client only accepts its documented queue event.
  client.on('not-a-queue-event', listener);
  // @ts-expect-error A queue listener must accept the queue status payload.
  client.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, (status: {unexpected: string}) => status);
}
