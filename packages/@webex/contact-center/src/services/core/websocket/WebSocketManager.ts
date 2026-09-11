import EventEmitter from 'events';
import {WebexSDK, SubscribeRequest, HTTP_METHODS} from '../../../types';
import {WCC_API_GATEWAY} from '../../constants';
import {ConnectionLostDetails} from './types';
import {CC_EVENTS, SubscribeResponse, WelcomeResponse} from '../../config/types';
import LoggerProxy from '../../../logger-proxy';
import workerScript from './keepalive.worker';
import {KEEPALIVE_WORKER_INTERVAL, CLOSE_SOCKET_TIMEOUT, METHODS} from '../constants';
import {WEB_SOCKET_MANAGER_FILE} from '../../../constants';

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

  private initializationGeneration = 0;
  private url: string | null = null;
  private forceCloseWebSocketOnTimeout: boolean;
  private isConnectionLost: boolean;
  private webex: WebexSDK;
  private welcomePromiseResolve:
    | ((value: WelcomeResponse | PromiseLike<WelcomeResponse>) => void)
    | null = null;

  private welcomePromiseReject: ((reason?: unknown) => void) | null = null;

  private keepaliveWorker: Worker;

  constructor(options: {webex: WebexSDK}) {
    super();
    const {webex} = options;
    this.webex = webex;
    this.shouldReconnect = true;
    this.isSocketClosed = true;
    this.isWelcomeReceived = false;
    this.forceCloseWebSocketOnTimeout = false;
    this.isConnectionLost = false;

    const workerScriptBlob = new Blob([workerScript], {type: 'application/javascript'});
    this.keepaliveWorker = new Worker(URL.createObjectURL(workerScriptBlob));
  }

  async initWebSocket(options: {
    body: SubscribeRequest;
    resource: string;
  }): Promise<WelcomeResponse> {
    const {body: connectionConfig, resource} = options;
    const initializationGeneration = this.initializationGeneration + 1;
    this.initializationGeneration = initializationGeneration;
    this.shouldReconnect = true;
    this.isSocketClosed = false;
    this.isWelcomeReceived = false;
    try {
      await this.register(connectionConfig, resource);
    } catch (error) {
      this.isSocketClosed = true;
      LoggerProxy.error(`[WebSocketStatus] | Error in registering Websocket ${error}`, {
        module: WEB_SOCKET_MANAGER_FILE,
        method: METHODS.INIT_WEB_SOCKET,
      });
      throw error;
    }

    if (initializationGeneration !== this.initializationGeneration) {
      throw new Error('WebSocket initialization cancelled before connect');
    }

    return new Promise((resolve, reject) => {
      this.welcomePromiseResolve = resolve;
      this.welcomePromiseReject = reject;
      this.connect().catch((error) => {
        LoggerProxy.error(`[WebSocketStatus] | Error in connecting Websocket ${error}`, {
          module: WEB_SOCKET_MANAGER_FILE,
          method: METHODS.INIT_WEB_SOCKET,
        });
        this.rejectPendingWelcome(
          error instanceof Error ? error : new Error('WebSocket connection failed')
        );
      });
    });
  }

  close(shouldReconnect: boolean, reason = 'Unknown') {
    this.initializationGeneration += 1;
    this.shouldReconnect = shouldReconnect;
    if (!this.isSocketClosed && this.websocket) {
      this.websocket.close();
    }
    this.isSocketClosed = true;
    this.keepaliveWorker.postMessage({type: 'terminate'});
    this.rejectPendingWelcome(new Error(`WebSocket closed before Welcome: ${reason}`));
    LoggerProxy.log(
      `[WebSocketStatus] | event=webSocketClose | WebSocket connection closed manually REASON: ${reason}`,
      {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.CLOSE}
    );
  }

  private rejectPendingWelcome(error: Error): void {
    const reject = this.welcomePromiseReject;
    this.welcomePromiseResolve = null;
    this.welcomePromiseReject = null;
    reject?.(error);
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
      });
      this.url = subscribeResponse.body.webSocketUrl;
    } catch (e) {
      LoggerProxy.error(
        `Register API Failed, Request to RoutingNotifs websocket registration API failed ${e}`,
        {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.REGISTER}
      );
      throw e;
    }
  }

  private async connect() {
    if (!this.url) {
      return undefined;
    }
    LoggerProxy.log(
      `[WebSocketStatus] | event=webSocketConnecting | Connecting to WebSocket: ${this.url}`,
      {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.CONNECT}
    );
    this.websocket = new WebSocket(this.url);

    return new Promise((resolve, reject) => {
      this.websocket.onopen = () => {
        this.isSocketClosed = false;
        this.shouldReconnect = true;

        this.websocket?.send(JSON.stringify({keepalive: 'true'}));
        this.keepaliveWorker.onmessage = (keepAliveEvent: {data: any}) => {
          if (keepAliveEvent?.data?.type === 'keepalive') {
            this.websocket?.send(JSON.stringify({keepalive: 'true'}));
          }

          if (keepAliveEvent?.data?.type === 'closeSocket' && this.isConnectionLost) {
            this.forceCloseWebSocketOnTimeout = true;
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

      this.websocket.onerror = (event: any) => {
        LoggerProxy.error(
          `[WebSocketStatus] | event=socketConnectionFailed | WebSocket connection failed ${event}`,
          {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.CONNECT}
        );
        reject();
      };

      this.websocket.onclose = async (event: any) => {
        this.webSocketOnCloseHandler(event);
      };

      this.websocket.onmessage = (e: MessageEvent) => {
        this.emit('message', e.data);
        const eventData = JSON.parse(e.data);

        if (eventData.type === CC_EVENTS.WELCOME) {
          this.isWelcomeReceived = true;
          if (this.welcomePromiseResolve) {
            const welcomeResolve = this.welcomePromiseResolve;
            this.welcomePromiseResolve = null;
            this.welcomePromiseReject = null;
            welcomeResolve(eventData.data as WelcomeResponse);
          }
        }

        if (eventData.type === 'AGENT_MULTI_LOGIN') {
          this.close(false, 'multiLogin');
          LoggerProxy.error(
            '[WebSocketStatus] | event=agentMultiLogin | WebSocket connection closed by agent multiLogin',
            {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.CONNECT}
          );
        }
      };
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async webSocketOnCloseHandler(event: any) {
    this.initializationGeneration += 1;
    this.isSocketClosed = true;
    this.keepaliveWorker.postMessage({type: 'terminate'});
    this.rejectPendingWelcome(new Error('WebSocket closed before Welcome'));
    if (this.shouldReconnect) {
      this.emit('socketClose');
      let issueReason;
      if (this.forceCloseWebSocketOnTimeout) {
        issueReason = 'WebSocket auto close timed out. Forcefully closed websocket.';
      } else {
        const onlineStatus = navigator.onLine;
        issueReason = !onlineStatus
          ? 'network issue'
          : 'missing keepalive from either desktop or notif service';
      }
      LoggerProxy.error(
        `[WebSocketStatus] | event=webSocketClose | WebSocket connection closed REASON: ${issueReason}`,
        {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.WEB_SOCKET_ON_CLOSE_HANDLER}
      );
      this.forceCloseWebSocketOnTimeout = false;
    }
  }
}

export default WebSocketManager;
