import EventEmitter from 'events';
import {WebexSDK, SubscribeRequest, HTTP_METHODS} from '../../../types';
import {WCC_API_GATEWAY} from '../../constants';
import {ConnectionLostDetails} from './types';
import {CC_EVENTS, SubscribeResponse, WelcomeResponse} from '../../config/types';
import LoggerProxy from '../../../logger-proxy';
import workerScript from './keepalive.worker';
import {
  KEEPALIVE_WORKER_INTERVAL,
  CLOSE_SOCKET_TIMEOUT,
  WELCOME_TIMEOUT,
  TIMEOUT_REQ,
  METHODS,
  ALLOWED_ROUTING_NOTIFS_DOMAINS,
} from '../constants';
import {WEB_SOCKET_MANAGER_FILE} from '../../../constants';
import {isAllowedUrlHost, isRecord} from '../Utils';

const interrupted = (): Error =>
  Object.assign(new Error('WebSocket connection interrupted'), {name: 'AbortError'});

/**
 * WebSocketManager handles the WebSocket connection for Contact Center operations.
 * It manages the connection lifecycle, including registration, reconnection, and message handling.
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
  private webex: WebexSDK;
  private welcomePromiseResolve:
    | ((value: WelcomeResponse | PromiseLike<WelcomeResponse>) => void)
    | null = null;

  private welcomePromiseReject: ((error: unknown) => void) | null = null;
  private welcomeTimer?: ReturnType<typeof setTimeout>;
  private keepaliveWorker: Worker;

  constructor(options: {webex: WebexSDK}) {
    super();
    const {webex} = options;
    this.webex = webex;
    this.shouldReconnect = true;
    this.isSocketClosed = false;
    this.isWelcomeReceived = false;
    this.isConnectionLost = false;

    const workerScriptBlob = new Blob([workerScript], {type: 'application/javascript'});
    this.keepaliveWorker = new Worker(URL.createObjectURL(workerScriptBlob));
  }

  async initWebSocket(options: {
    body: SubscribeRequest;
    resource: string;
  }): Promise<WelcomeResponse> {
    const {body: connectionConfig, resource} = options;
    this.cleanupWebSocket(interrupted());
    this.shouldReconnect = true;

    return new Promise((resolve, reject) => {
      this.welcomePromiseResolve = resolve;
      this.welcomePromiseReject = reject;
      this.register(connectionConfig, resource)
        .then((webSocketUrl) => {
          if (this.welcomePromiseResolve !== resolve) return undefined;
          this.url = webSocketUrl;
          this.welcomeTimer = setTimeout(
            () => this.cleanupWebSocket(new Error('Welcome deadline exceeded')),
            WELCOME_TIMEOUT
          );

          return this.connect();
        })
        .catch((error) => {
          if (this.welcomePromiseResolve === resolve) this.cleanupWebSocket(error);
        });
    });
  }

  public getUrl(): string | null {
    return this.url;
  }

  public hasUsableSocket(): boolean {
    return this.isWelcomeReceived && this.websocket?.readyState === 1;
  }

  close(shouldReconnect: boolean, reason = 'Unknown') {
    this.shouldReconnect = shouldReconnect;
    const hadSocket = Boolean(this.websocket);
    if (!hadSocket && !this.welcomePromiseReject) return;
    this.cleanupWebSocket(interrupted());
    if (hadSocket) this.emit('socketClose', {shouldReconnect});
    if (reason)
      LoggerProxy.log('WebSocket connection closed', {
        module: WEB_SOCKET_MANAGER_FILE,
        method: METHODS.CLOSE,
      });
  }

  handleConnectionLost(event: ConnectionLostDetails) {
    this.isConnectionLost = event.isConnectionLost;
  }

  private async register(connectionConfig: SubscribeRequest, resource: string) {
    try {
      // X-ORGANIZATION-ID header is only required for INT environments
      const isIntEnv = this.webex.internal?.services?.isIntegrationEnvironment() || false;
      const orgId = this.webex.credentials.getOrgId();

      if (isIntEnv && orgId) {
        LoggerProxy.log(`[WebSocketManager] Adding X-ORGANIZATION-ID header for INT environment`, {
          module: WEB_SOCKET_MANAGER_FILE,
          method: METHODS.REGISTER,
        });
      }

      const subscribeResponse: SubscribeResponse = await this.webex.request({
        service: WCC_API_GATEWAY,
        resource,
        method: HTTP_METHODS.POST,
        body: connectionConfig,
        headers: isIntEnv && orgId ? {'X-ORGANIZATION-ID': orgId} : undefined,
        timeout: TIMEOUT_REQ,
      });
      if (
        subscribeResponse.statusCode !== undefined &&
        (subscribeResponse.statusCode < 200 || subscribeResponse.statusCode >= 300)
      )
        throw subscribeResponse;
      const {webSocketUrl} = subscribeResponse.body;

      // Only a `wss` URL whose hostname is, or is a subdomain of, one of the allow-listed
      // RoutingNotifs domains is considered trusted.
      let isWssUrl = false;

      try {
        isWssUrl = !!webSocketUrl && new URL(webSocketUrl).protocol === 'wss:';
      } catch (error) {
        isWssUrl = false;
      }

      if (!isWssUrl || !isAllowedUrlHost(webSocketUrl, ALLOWED_ROUTING_NOTIFS_DOMAINS)) {
        throw new Error(
          'Rejected webSocketUrl from RoutingNotifs registration: scheme or host not allow-listed'
        );
      }

      return webSocketUrl;
    } catch (e) {
      LoggerProxy.error(
        'Register API Failed, Request to RoutingNotifs websocket registration API failed',
        {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.REGISTER}
      );
      throw e;
    }
  }

  private connect(): void {
    LoggerProxy.log('[WebSocketStatus] | event=webSocketConnecting | Connecting to WebSocket', {
      module: WEB_SOCKET_MANAGER_FILE,
      method: METHODS.CONNECT,
    });
    this.websocket = new WebSocket(this.url);
    const websocket = this.websocket;

    this.websocket.onopen = () => {
      if (this.websocket !== websocket) return;
      this.isSocketClosed = false;

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
    };

    this.websocket.onerror = () => {
      LoggerProxy.error(
        '[WebSocketStatus] | event=socketConnectionFailed | WebSocket connection failed',
        {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.CONNECT}
      );
      const error = new Error('WebSocket connection failed');
      this.webSocketOnCloseHandler(websocket, error);
    };

    this.websocket.onclose = () => {
      const error = new Error('WebSocket closed');
      this.webSocketOnCloseHandler(websocket, error);
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
