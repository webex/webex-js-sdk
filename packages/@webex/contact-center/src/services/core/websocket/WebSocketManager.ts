import EventEmitter from 'events';
import {WebexSDK, SubscribeRequest, HTTP_METHODS} from '../../../types';
import {SUBSCRIBE_API, WCC_API_GATEWAY} from '../../constants';
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
  private websocket: WebSocket;
  shouldReconnect: boolean;
  isSocketClosed: boolean;
  private isWelcomeReceived: boolean;
  private url: string | null = null;
  private forceCloseWebSocketOnTimeout: boolean;
  private isConnectionLost: boolean;
  private webex: WebexSDK;
  private welcomePromiseResolve:
    | ((value: WelcomeResponse | PromiseLike<WelcomeResponse>) => void)
    | null = null;

  private keepaliveWorker: Worker;

  constructor(options: {webex: WebexSDK}) {
    super();
    const {webex} = options;
    this.webex = webex;
    this.shouldReconnect = true;
    this.websocket = {} as WebSocket;
    this.isSocketClosed = false;
    this.isWelcomeReceived = false;
    this.forceCloseWebSocketOnTimeout = false;
    this.isConnectionLost = false;

    const workerScriptBlob = new Blob([workerScript], {type: 'application/javascript'});
    this.keepaliveWorker = new Worker(URL.createObjectURL(workerScriptBlob));
  }

  async initWebSocket(options: {body: SubscribeRequest}): Promise<WelcomeResponse> {
    const connectionConfig = options.body;
    try {
      await this.register(connectionConfig);
    } catch (error) {
      LoggerProxy.error(`[WebSocketStatus] | Error in registering Websocket ${error}`, {
        module: WEB_SOCKET_MANAGER_FILE,
        method: METHODS.INIT_WEB_SOCKET,
      });
      throw error;
    }

    return new Promise((resolve, reject) => {
      this.welcomePromiseResolve = resolve;
      this.connect().catch((error) => {
        LoggerProxy.error(`[WebSocketStatus] | Error in connecting Websocket ${error}`, {
          module: WEB_SOCKET_MANAGER_FILE,
          method: METHODS.INIT_WEB_SOCKET,
        });
        reject(error);
      });
    });
  }

  close(shouldReconnect: boolean, reason = 'Unknown') {
    if (!this.isSocketClosed && this.shouldReconnect) {
      this.shouldReconnect = shouldReconnect;
      this.websocket.close();
      this.keepaliveWorker.postMessage({type: 'terminate'});
      LoggerProxy.log(
        `[WebSocketStatus] | event=webSocketClose | WebSocket connection closed manually REASON: ${reason}`,
        {module: WEB_SOCKET_MANAGER_FILE, method: METHODS.CLOSE}
      );
    }
  }

  handleConnectionLost(event: ConnectionLostDetails) {
    this.isConnectionLost = event.isConnectionLost;
  }

  /**
   * Checks if the current environment is an integration (INT) environment
   * by examining the service URL for known INT patterns.
   * INT environments include: intgus1, qaus1, loadus1, etc.
   * @returns {boolean} True if INT environment, false otherwise
   * @private
   */
  private isIntegrationEnvironment(): boolean {
    try {
      const serviceUrl = this.webex.internal?.services?.get?.(WCC_API_GATEWAY) || '';
      // INT environments have patterns like: intgus1, qaus1, loadus1
      // Production environments have patterns like: produs1, prodeu1, wxcc-us1, wxcc-eu1
      const intPatterns = /(intg|qaus|loadus)\d*/i;
      const isInt = intPatterns.test(serviceUrl);

      LoggerProxy.log(
        `[WebSocketManager] Environment check - URL: ${serviceUrl}, isINT: ${isInt}`,
        {
          module: WEB_SOCKET_MANAGER_FILE,
          method: 'isIntegrationEnvironment',
        }
      );

      return isInt;
    } catch (error) {
      LoggerProxy.error(`Failed to determine environment: ${error}`, {
        module: WEB_SOCKET_MANAGER_FILE,
        method: 'isIntegrationEnvironment',
      });

      return false;
    }
  }

  private async register(connectionConfig: SubscribeRequest) {
    try {
      // X-ORGANIZATION-ID header is only required for INT environments
      const isIntEnv = this.isIntegrationEnvironment();
      const orgId = isIntEnv ? this.webex.credentials?.getOrgId?.() : undefined;

      if (isIntEnv && orgId) {
        LoggerProxy.log(`[WebSocketManager] Adding X-ORGANIZATION-ID header for INT environment`, {
          module: WEB_SOCKET_MANAGER_FILE,
          method: METHODS.REGISTER,
        });
      }

      const subscribeResponse: SubscribeResponse = await this.webex.request({
        service: WCC_API_GATEWAY,
        resource: SUBSCRIBE_API,
        method: HTTP_METHODS.POST,
        body: connectionConfig,
        headers: orgId ? {'X-ORGANIZATION-ID': orgId} : undefined,
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

        this.websocket.send(JSON.stringify({keepalive: 'true'}));
        this.keepaliveWorker.onmessage = (keepAliveEvent: {data: any}) => {
          if (keepAliveEvent?.data?.type === 'keepalive') {
            this.websocket.send(JSON.stringify({keepalive: 'true'}));
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
            this.welcomePromiseResolve(eventData.data as WelcomeResponse);
            this.welcomePromiseResolve = null;
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
    this.isSocketClosed = true;
    this.keepaliveWorker.postMessage({type: 'terminate'});
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
