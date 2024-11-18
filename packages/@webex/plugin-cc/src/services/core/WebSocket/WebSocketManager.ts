import {WebexSDK, SubscribeRequest, HTTP_METHODS} from '../../../types';
import {SUBSCRIBE_API, WCC_API_GATEWAY} from '../../constants';
import {SubscribeResponse, WelcomeResponse} from '../../config/types';
import LoggerProxy from '../../../logger-proxy';
import workerScript from './keepalive.worker';
import {KEEPALIVE_WORKER_INTERVAL, CLOSE_SOCKET_TIMEOUT} from '../constants';

export class WebSocketManager extends EventTarget {
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
        LoggerProxy.logger.error(`[WebSocketStatus] | Error in connecting Websocket ${error}`);
        reject(error);
      });
    });
  }

  close(shouldReconnect: boolean, reason = 'Unknown') {
    if (!this.isSocketClosed && this.shouldReconnect) {
      this.shouldReconnect = shouldReconnect;
      this.websocket.close();
      this.keepaliveWorker.postMessage({type: 'terminate'});
      LoggerProxy.logger.error(
        `[WebSocketStatus] | event=webSocketClose | WebSocket connection closed manually REASON: ${reason}`
      );
    }
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
      LoggerProxy.logger.error(
        `Register API Failed, Request to RoutingNotifs websocket registration API failed ${e}`
      );
    }
  }

  private async connect() {
    if (!this.url) {
      return undefined;
    }
    LoggerProxy.logger.log(
      `[WebSocketStatus] | event=webSocketConnecting | Connecting to WebSocket: ${this.url}`
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
            LoggerProxy.logger.error(
              '[webSocketTimeout] | event=webSocketTimeout | WebSocket connection closed forcefully'
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
        LoggerProxy.logger.error(
          `[WebSocketStatus] | event=socketConnectionFailed | WebSocket connection failed ${event}`
        );
        reject();
      };

      this.websocket.onclose = async (event: any) => {
        this.webSocketOnCloseHandler(event);
      };

      this.websocket.onmessage = (e: MessageEvent) => {
        this.dispatchEvent(new CustomEvent('message', {detail: e.data}));
        const eventData = JSON.parse(e.data);

        if (eventData.type === 'Welcome') {
          this.isWelcomeReceived = true;
          if (this.welcomePromiseResolve) {
            this.welcomePromiseResolve(eventData.data as WelcomeResponse);
            this.welcomePromiseResolve = null;
          }
        }

        if (eventData.type === 'AGENT_MULTI_LOGIN') {
          this.close(false, 'multiLogin');
          LoggerProxy.logger.error(
            '[WebSocketStatus] | event=agentMultiLogin | WebSocket connection closed by agent multiLogin'
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
      this.dispatchEvent(new Event('socketClose'));
      let issueReason;
      if (this.forceCloseWebSocketOnTimeout) {
        issueReason = 'WebSocket auto close timed out. Forcefully closed websocket.';
      } else {
        const onlineStatus = navigator.onLine;
        LoggerProxy.logger.info(`[WebSocketStatus] | desktop online status is ${onlineStatus}`);
        issueReason = !onlineStatus
          ? 'network issue'
          : 'missing keepalive from either desktop or notif service';
      }
      LoggerProxy.logger.error(
        `[WebSocketStatus] | event=webSocketClose | WebSocket connection closed REASON: ${issueReason}`
      );
      this.forceCloseWebSocketOnTimeout = false;
    }
  }
}
