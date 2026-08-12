import {CHANNEL_PATTERN, DEFAULT_CHANNEL} from '../core/constants';
import {BridgeError, fromWireError} from '../core/errors';
import type {JsonValue} from '../core/json';
import {readOwn} from '../core/json';
import {ListenerSet} from '../core/listeners';
import {createLogger} from '../core/logger';
import type {LogSink} from '../core/logger';
import {assertTopic} from '../core/serialize';
import {ClientCommand, asClientPushEvent} from './messages';
import type {ClientCommandMessage} from './messages';
import {resolveChrome} from './platform';
import type {ChromeLike, ChromeSender} from './platform';
import {isFromExtensionPage} from './senders';
import type {
  BufferedMessage,
  Connection,
  ExtensionBridge,
  PushListener,
  PushMeta,
  RequestOptions,
  TopicPushListener,
} from '../types';

export interface ExtensionClientOptions {
  channel?: string;
  debug?: boolean;
  logSink?: LogSink;
}

/**
 * Create the popup / options / side-panel proxy to the service-worker bridge.
 *
 * An MV3 extension page cannot own the bridge, because the bridge lives in the
 * service worker and the page is torn down whenever it closes. Rather than making
 * every consumer hand-write a `chrome.runtime.sendMessage` command protocol, this
 * mirrors the {@link ExtensionBridge} surface and proxies to the worker.
 *
 * @param options - Client options. The channel must match the worker's.
 * @returns A bridge-shaped client.
 */
export function createExtensionClient(options?: ExtensionClientOptions): ExtensionBridge {
  return createExtensionClientWith(resolveChrome(), options);
}

/**
 * @internal Test seam.
 *
 * @param chromeApi - Extension platform object.
 * @param options - Client options.
 * @returns A bridge-shaped client.
 */
export function createExtensionClientWith(
  chromeApi: ChromeLike,
  options: ExtensionClientOptions = {}
): ExtensionBridge {
  const channel = options.channel ?? DEFAULT_CHANNEL;

  if (typeof channel !== 'string' || !CHANNEL_PATTERN.test(channel)) {
    throw new BridgeError('INSECURE_CONFIG', 'channel must match ^[a-zA-Z0-9._:-]{1,128}$');
  }

  const logger = createLogger({
    debug: options.debug === true,
    prefix: '[web-extension-bridge:client]',
    ...(options.logSink ? {sink: options.logSink} : {}),
  });
  const pushListeners = new ListenerSet<PushListener>({
    onError: (error) =>
      logger.warn('push listener threw', {
        channel,
        reason: error instanceof Error ? error.name : typeof error,
      }),
  });

  let attached = false;

  const onRuntimeMessage = (message: unknown, sender: ChromeSender): void => {
    // Broadcasts must come from our own service worker, not from a content script.
    if (!isFromExtensionPage(chromeApi, sender)) {
      return;
    }

    const event = asClientPushEvent(message, channel);

    if (!event) {
      return;
    }

    pushListeners.emit(event.topic, event.payload as JsonValue, event.meta as PushMeta);
  };

  const attach = (): void => {
    if (attached) {
      return;
    }

    attached = true;
    chromeApi.runtime.onMessage.addListener(onRuntimeMessage);
  };

  const send = async (command: ClientCommandMessage): Promise<unknown> => {
    const response = await chromeApi.runtime.sendMessage(command);

    if (readOwn(response, 'ok') === true) {
      return readOwn(response, 'value');
    }

    throw fromWireError(readOwn(response, 'error'), command.topic);
  };

  const client: ExtensionBridge = {
    subscribe(listener: PushListener): () => void {
      attach();

      return pushListeners.add(listener);
    },

    subscribeTopic(topic: string, listener: TopicPushListener): () => void {
      assertTopic(topic);
      attach();

      return pushListeners.add((pushTopic, payload, meta) => {
        if (pushTopic === topic) {
          listener(payload, meta);
        }
      });
    },

    async request<T = JsonValue>(
      topic: string,
      payload?: JsonValue,
      opts: RequestOptions = {}
    ): Promise<T> {
      assertTopic(topic);

      const command: ClientCommandMessage = {
        __webexBridgeClient: true,
        channel,
        command: ClientCommand.REQUEST,
        topic,
        ...(payload === undefined ? {} : {payload}),
        ...(typeof opts.tabId === 'number' ? {tabId: opts.tabId} : {}),
        ...(typeof opts.timeoutMs === 'number' ? {timeoutMs: opts.timeoutMs} : {}),
      };

      // The worker owns the request timer. An abort here stops the caller waiting; it
      // cannot recall a request already in flight in the page.
      if (opts.signal) {
        return (await Promise.race([send(command), abortRejection(opts.signal, topic)])) as T;
      }

      return (await send(command)) as T;
    },

    async listConnections(): Promise<Connection[]> {
      const value = await send({
        __webexBridgeClient: true,
        channel,
        command: ClientCommand.LIST_CONNECTIONS,
      });

      return (Array.isArray(value) ? value : []) as Connection[];
    },

    async getBufferedMessages(
      opts: {topic?: string; limit?: number} = {}
    ): Promise<BufferedMessage[]> {
      const value = await send({
        __webexBridgeClient: true,
        channel,
        command: ClientCommand.GET_BUFFERED,
        ...(typeof opts.limit === 'number' ? {limit: opts.limit} : {}),
      });
      const messages = (Array.isArray(value) ? value : []) as BufferedMessage[];

      return opts.topic === undefined
        ? messages
        : messages.filter((entry) => entry.topic === opts.topic);
    },

    async getCounters(): Promise<Record<string, number>> {
      const value = await send({
        __webexBridgeClient: true,
        channel,
        command: ClientCommand.GET_COUNTERS,
      });

      return (value ?? {}) as Record<string, number>;
    },
  };

  return client;
}

/**
 * @param signal - Caller's abort signal.
 * @param topic - Topic, for the error.
 * @returns A promise that rejects with `ABORTED`, and never resolves.
 */
function abortRejection(signal: AbortSignal, topic: string): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    if (signal.aborted) {
      reject(new BridgeError('ABORTED', undefined, topic));

      return;
    }

    signal.addEventListener('abort', () => reject(new BridgeError('ABORTED', undefined, topic)), {
      once: true,
    });
  });
}
