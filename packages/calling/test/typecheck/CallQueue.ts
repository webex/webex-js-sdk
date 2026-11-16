import {
  ACD_STATE,
  CallQueueAgentStatus,
  COMMON_EVENT_KEYS,
  ICallQueue,
  createCallQueueClient,
} from '../../src';

export function verifyCallQueueFactoryTypes(
  webex: Parameters<typeof createCallQueueClient>[0],
  logger: Parameters<typeof createCallQueueClient>[1]
): void {
  createCallQueueClient(webex, logger, {webexApiBaseUrl: 'https://webexapis.com'});
  // @ts-expect-error The caller must provide a public API base URL.
  createCallQueueClient(webex, logger);
  // @ts-expect-error The API base URL must be a string.
  createCallQueueClient(webex, logger, {webexApiBaseUrl: 123});
}

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
