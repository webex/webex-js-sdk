import EventEmitter from 'events';
import {ConnectionLostDetails} from './types';
import {CC_EVENTS, WelcomeResponse} from '../../config/types';
import LoggerProxy from '../../../logger-proxy';
import workerScript from './keepalive.worker';
import {
  KEEPALIVE_WORKER_INTERVAL,
  CLOSE_SOCKET_TIMEOUT,
  WELCOME_TIMEOUT,
  METHODS,
  ALLOWED_ROUTING_NOTIFS_DOMAINS,
} from '../constants';
import {WEB_SOCKET_MANAGER_FILE} from '../../../constants';
import {isAllowedUrlHost, isRecord} from '../Utils';

const interrupted = (): Error =>
  Object.assign(new Error('WebSocket connection interrupted'), {name: 'AbortError'});

/**
 * WebSocketManager handles the WebSocket connection for Contact Center operations.
 * It connects the supplied URL and handles socket lifecycle and message delivery.
 * It also utilizes a Web Worker to manage keepalive messages and socket closure.
 * @ignore
 */
export class WebSocketManager extends EventEmitter {
  private websocket?: WebSocket;
  shouldReconnect: boolean;
  isSocketClosed: boolean;
  private isWelcomeReceived: boolean;
  private url: string | null = null;
  private isConnectionLost: boolean;
  private welcomePromiseResolve:
    | ((value: WelcomeResponse | PromiseLike<WelcomeResponse>) => void)
    | null = null;

  private welcomePromiseReject: ((error: unknown) => void) | null = null;
  private welcomeTimer?: ReturnType<typeof setTimeout>;
  private connectionSignal?: AbortSignal;
  private onConnectionAbort?: () => void;
  private keepaliveWorker?: Worker;
  private workerUrl?: string;

  constructor() {
    super();
    this.shouldReconnect = true;
    this.isSocketClosed = false;
    this.isWelcomeReceived = false;
    this.isConnectionLost = false;
  }

  async initWebSocket(options: {url: string; signal?: AbortSignal}): Promise<WelcomeResponse> {
    if (options.signal?.aborted) throw interrupted();
    const {url: webSocketUrl, signal} = options;
    let isWssUrl = false;
    try {
      isWssUrl = new URL(webSocketUrl).protocol === 'wss:';
    } catch {
      isWssUrl = false;
    }
    if (!isWssUrl || !isAllowedUrlHost(webSocketUrl, ALLOWED_ROUTING_NOTIFS_DOMAINS)) {
      throw new Error('Rejected WebSocket URL: scheme or host not allow-listed');
    }

    this.cleanupWebSocket(interrupted());
    this.url = webSocketUrl;
    this.shouldReconnect = true;

    return new Promise((resolve, reject) => {
      this.welcomePromiseResolve = resolve;
      this.welcomePromiseReject = reject;
      this.connectionSignal = signal;
      this.onConnectionAbort = () => this.cleanupWebSocket(interrupted());
      signal?.addEventListener('abort', this.onConnectionAbort, {once: true});
      this.welcomeTimer = setTimeout(
        () => this.cleanupWebSocket(new Error('Welcome deadline exceeded')),
        WELCOME_TIMEOUT
      );
      try {
        this.connect();
      } catch (error) {
        this.cleanupWebSocket(error);
      }
    });
  }

  public hasUsableSocket(): boolean {
    return !this.isSocketClosed && this.isWelcomeReceived && this.websocket?.readyState === 1;
  }

  close(shouldReconnect: boolean, reason = 'Unknown') {
    this.shouldReconnect = shouldReconnect;
    if (!this.websocket) return;
    this.cleanupWebSocket(interrupted());
    this.emit('socketClose', {shouldReconnect});
    if (reason) WebSocketManager.diagnose('WebSocket connection closed', METHODS.CLOSE);
  }

  handleConnectionLost(event: ConnectionLostDetails) {
    this.isConnectionLost = event.isConnectionLost;
  }

  private connect() {
    const websocket = new WebSocket(this.url);
    this.websocket = websocket;
    websocket.onopen = () => {
      if (this.websocket !== websocket || this.keepaliveWorker) return;
      this.isSocketClosed = false;
      try {
        websocket.send(JSON.stringify({keepalive: 'true'}));
        const workerScriptBlob = new Blob([workerScript], {type: 'application/javascript'});
        this.workerUrl = URL.createObjectURL(workerScriptBlob);
        this.keepaliveWorker = new Worker(this.workerUrl);
        this.keepaliveWorker.onmessage = (keepAliveEvent: MessageEvent) => {
          if (this.websocket !== websocket) return;
          if (keepAliveEvent?.data?.type === 'keepalive' && websocket.readyState === 1) {
            websocket.send(JSON.stringify({keepalive: 'true'}));
          }
          if (
            keepAliveEvent?.data?.type === 'closeSocket' &&
            this.isConnectionLost &&
            this.shouldReconnect
          ) {
            this.close(true, 'WebSocket did not auto close within 16 secs');
          }
        };
        this.keepaliveWorker.postMessage({
          type: 'start',
          intervalDuration: KEEPALIVE_WORKER_INTERVAL, // Keepalive interval
          isSocketClosed: this.isSocketClosed,
          closeSocketTimeout: CLOSE_SOCKET_TIMEOUT, // Close socket timeout
        });
      } catch (error) {
        this.cleanupWebSocket(error);
      }
    };

    websocket.onerror = () =>
      this.webSocketOnCloseHandler(websocket, new Error('WebSocket connection failed'));
    websocket.onclose = () =>
      this.webSocketOnCloseHandler(websocket, new Error('WebSocket closed'));
    websocket.onmessage = (e: MessageEvent) => {
      if (this.websocket !== websocket) return;
      let eventData;
      try {
        eventData = JSON.parse(e.data);
      } catch {
        if (this.isWelcomeReceived) this.emit('message', e.data);

        return;
      }
      if (
        eventData?.type === CC_EVENTS.WELCOME &&
        !this.isWelcomeReceived &&
        isRecord(eventData.data) &&
        !Array.isArray(eventData.data)
      ) {
        this.isWelcomeReceived = true;
        clearTimeout(this.welcomeTimer);
        this.welcomePromiseResolve?.(eventData.data as WelcomeResponse);
        this.welcomePromiseResolve = null;
        this.welcomePromiseReject = null;
      }
      if (eventData?.type === 'AGENT_MULTI_LOGIN') {
        this.close(false, 'multiLogin');
      } else if (!this.isWelcomeReceived) {
        return;
      }
      this.emit('message', e.data);
    };
  }

  private webSocketOnCloseHandler(websocket: WebSocket, error: Error) {
    if (this.websocket !== websocket) return;
    const shouldReconnect = this.shouldReconnect;
    const isWelcomeReceived = this.isWelcomeReceived;
    this.cleanupWebSocket(error, false);
    if (isWelcomeReceived) this.emit('socketClose', {shouldReconnect});
  }

  private cleanupWebSocket(error: unknown, closeSocket = true): void {
    const websocket = this.websocket;
    const keepaliveWorker = this.keepaliveWorker;
    const workerUrl = this.workerUrl;
    this.websocket = undefined;
    this.keepaliveWorker = undefined;
    this.workerUrl = undefined;
    this.isSocketClosed = true;
    this.isWelcomeReceived = false;
    clearTimeout(this.welcomeTimer);
    this.connectionSignal?.removeEventListener('abort', this.onConnectionAbort);
    this.connectionSignal = undefined;
    this.onConnectionAbort = undefined;
    this.welcomePromiseReject?.(error);
    this.welcomePromiseResolve = null;
    this.welcomePromiseReject = null;
    if (websocket) {
      websocket.onopen = null;
      websocket.onmessage = null;
      websocket.onerror = null;
      websocket.onclose = null;
      if (closeSocket) {
        try {
          websocket.close();
        } catch {
          WebSocketManager.diagnose('Socket disposal failed', METHODS.DISPOSE_ATTEMPT);
        }
      }
    }
    if (keepaliveWorker) {
      keepaliveWorker.onmessage = null;
      try {
        keepaliveWorker.terminate();
      } catch {
        WebSocketManager.diagnose('Worker disposal failed', METHODS.DISPOSE_ATTEMPT);
      }
    }
    if (workerUrl) {
      try {
        URL.revokeObjectURL(workerUrl);
      } catch {
        WebSocketManager.diagnose('Worker URL disposal failed', METHODS.DISPOSE_ATTEMPT);
      }
    }
  }

  private static diagnose(message: string, method: string): void {
    try {
      LoggerProxy.log(message, {module: WEB_SOCKET_MANAGER_FILE, method});
    } catch {
      // Diagnostics cannot interrupt socket cleanup.
    }
  }
}

export default WebSocketManager;
