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
  private keepaliveWorker: Worker;

  constructor() {
    super();
    this.shouldReconnect = true;
    this.isSocketClosed = false;
    this.isWelcomeReceived = false;
    this.isConnectionLost = false;

    const workerScriptBlob = new Blob([workerScript], {type: 'application/javascript'});
    this.keepaliveWorker = new Worker(URL.createObjectURL(workerScriptBlob));
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
      throw new Error(
        'Rejected webSocketUrl from RoutingNotifs registration: scheme or host not allow-listed'
      );
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
    if (reason)
      LoggerProxy.log('WebSocket connection closed', {
        module: WEB_SOCKET_MANAGER_FILE,
        method: METHODS.CLOSE,
      });
  }

  handleConnectionLost(event: ConnectionLostDetails) {
    this.isConnectionLost = event.isConnectionLost;
  }

  private connect() {
    LoggerProxy.log('[WebSocketStatus] | event=webSocketConnecting | Connecting to WebSocket', {
      module: WEB_SOCKET_MANAGER_FILE,
      method: METHODS.CONNECT,
    });
    this.websocket = new WebSocket(this.url);
    const websocket = this.websocket;
    this.websocket.onopen = () => {
      if (this.websocket !== websocket) return;
      this.isSocketClosed = false;
      try {
        this.websocket.send(JSON.stringify({keepalive: 'true'}));
        this.keepaliveWorker.onmessage = (keepAliveEvent: MessageEvent) => {
          if (this.websocket !== websocket) return;
          if (keepAliveEvent?.data?.type === 'keepalive' && this.websocket.readyState === 1) {
            this.websocket.send(JSON.stringify({keepalive: 'true'}));
          }
          if (
            keepAliveEvent?.data?.type === 'closeSocket' &&
            this.isConnectionLost &&
            this.shouldReconnect
          ) {
            this.close(true, 'WebSocket did not auto close within 16 secs');
            LoggerProxy.error(
              '[webSocketTimeout] | event=webSocketTimeout | WebSocket connection closed forcefully',
              {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.CONNECT}
            );
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

    this.websocket.onerror = () => {
      LoggerProxy.error(
        '[WebSocketStatus] | event=socketConnectionFailed | WebSocket connection failed',
        {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.CONNECT}
      );
      this.webSocketOnCloseHandler(websocket, new Error('WebSocket connection failed'));
    };
    this.websocket.onclose = () => {
      this.webSocketOnCloseHandler(websocket, new Error('WebSocket closed'));
    };
    this.websocket.onmessage = (e: MessageEvent) => {
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
        LoggerProxy.error(
          '[WebSocketStatus] | event=agentMultiLogin | WebSocket connection closed by agent multiLogin',
          {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.CONNECT}
        );
      } else if (!this.isWelcomeReceived) {
        return;
      }
      this.emit('message', e.data);
    };
  }

  private webSocketOnCloseHandler(websocket: WebSocket, error: Error) {
    if (this.websocket !== websocket) return;
    const isWelcomeReceived = this.isWelcomeReceived;
    this.cleanupWebSocket(error, false);
    if (isWelcomeReceived) this.emit('socketClose', {shouldReconnect: this.shouldReconnect});
    if (this.shouldReconnect) {
      const onlineStatus = navigator.onLine;
      const issueReason = !onlineStatus
        ? 'network issue'
        : 'missing keepalive from either desktop or notif service';
      LoggerProxy.error(
        `[WebSocketStatus] | event=webSocketClose | WebSocket connection closed REASON: ${issueReason}`,
        {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.WEB_SOCKET_ON_CLOSE_HANDLER}
      );
    }
  }

  private cleanupWebSocket(error: unknown, closeSocket = true): void {
    const websocket = this.websocket;
    this.websocket = undefined;
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
      if (closeSocket) websocket.close();
    }
    this.keepaliveWorker.onmessage = null;
    this.keepaliveWorker.postMessage({type: 'terminate'});
  }
}

export default WebSocketManager;
