import EventEmitter from 'events';
import {WebexSDK, SubscribeRequest, HTTP_METHODS} from '../../../types';
import {SUBSCRIBE_API, WCC_API_GATEWAY} from '../../constants';
import {ConnectionLostDetails} from './types';
import {CC_EVENTS, SubscribeResponse, WelcomeResponse} from '../../config/types';
import LoggerProxy from '../../../logger-proxy';
import workerScript from './keepalive.worker';
import {KEEPALIVE_WORKER_INTERVAL, CLOSE_SOCKET_TIMEOUT} from '../constants';
import {WEB_SOCKET_MANAGER_FILE} from '../../../constants';

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
    await this.register(connectionConfig);

    return new Promise((resolve, reject) => {
      this.welcomePromiseResolve = resolve;
      this.connect().catch((error) => {
        LoggerProxy.error(`[WebSocketStatus] | Error in connecting Websocket ${error}`, {
          module: WEB_SOCKET_MANAGER_FILE,
          method: this.initWebSocket.name,
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
        {module: WEB_SOCKET_MANAGER_FILE, method: this.close.name}
      );
    }
  }

  handleConnectionLost(event: ConnectionLostDetails) {
    this.isConnectionLost = event.isConnectionLost;
  }

  private async register(connectionConfig: SubscribeRequest) {
    try {
      const subscribeResponse: SubscribeResponse = await this.webex.request({
        service: WCC_API_GATEWAY,
        resource: SUBSCRIBE_API,
        method: HTTP_METHODS.POST,
        body: connectionConfig,
      });
      this.url = subscribeResponse.body.webSocketUrl;
    } catch (e) {
      LoggerProxy.error(
        `Register API Failed, Request to RoutingNotifs websocket registration API failed ${e}`,
        {module: WEB_SOCKET_MANAGER_FILE, method: this.register.name}
      );
    }
  }

  private async connect() {
    if (!this.url) {
      return undefined;
    }
    LoggerProxy.log(
      `[WebSocketStatus] | event=webSocketConnecting | Connecting to WebSocket: ${this.url}`,
      {module: WEB_SOCKET_MANAGER_FILE, method: this.connect.name}
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
              {module: WEB_SOCKET_MANAGER_FILE, method: this.connect.name}
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
          {module: WEB_SOCKET_MANAGER_FILE, method: this.connect.name}
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
            {module: WEB_SOCKET_MANAGER_FILE, method: this.connect.name}
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
        LoggerProxy.info(`[WebSocketStatus] | desktop online status is ${onlineStatus}`, {
          module: WEB_SOCKET_MANAGER_FILE,
          method: this.webSocketOnCloseHandler.name,
        });
        issueReason = !onlineStatus
          ? 'network issue'
          : 'missing keepalive from either desktop or notif service';
      }
      LoggerProxy.error(
        `[WebSocketStatus] | event=webSocketClose | WebSocket connection closed REASON: ${issueReason}`,
        {module: WEB_SOCKET_MANAGER_FILE, method: this.webSocketOnCloseHandler.name}
      );
      this.forceCloseWebSocketOnTimeout = false;
    }
  }
}
