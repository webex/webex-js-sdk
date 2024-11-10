import {SUBSCRIBE_API, WCC_API_GATEWAY, WEBSOCKET_EVENT_TIMEOUT} from '../constants';
import {
  WebexSDK,
  HTTP_METHODS,
  SubscribeRequest,
  IHttpResponse,
  WelcomeResponse,
  WelcomeEvent,
} from '../../types';
import IWebSocket from '../WebSocket/types';
import WebSocket from '../WebSocket';
import {CC_EVENTS, SubscribeResponse} from '../config/types';
import {EVENT} from '../../constants';

export type EventHandler = {(data: any): void};

class HttpRequest {
  private webSocket: IWebSocket;
  private webex: WebexSDK;
  private eventHandlers: Map<string, EventHandler>;
  private static instance: HttpRequest;

  public static getInstance(options?: {webex: WebexSDK}): HttpRequest {
    if (!HttpRequest.instance && options && options.webex) {
      HttpRequest.instance = new HttpRequest(options);
    }

    return HttpRequest.instance;
  }

  private constructor(options: {webex: WebexSDK}) {
    const {webex} = options;
    this.webex = webex;
    this.webSocket = new WebSocket({
      parent: this.webex,
    });
    this.eventHandlers = new Map();

    // Centralized WebSocket event listener
    this.webSocket.on(EVENT, (eventData) => {
      this.webex.logger.log(`Received event: ${eventData.type}`);
      const handler = this.eventHandlers.get(eventData.type);
      if (handler) {
        handler(eventData.data);
      }
    });
  }

  public getWebSocket(): IWebSocket {
    return this.webSocket;
  }

  /* This calls subscribeNotifications and establishes a websocket connection
   * It sends the request and then listens for the Welcome event
   * If the Welcome event is received, it resolves the promise
   * If the Welcome event is not received, it rejects the promise
   */
  public async subscribeNotifications(options: {body: SubscribeRequest}): Promise<WelcomeResponse> {
    const {body} = options;
    const eventType = CC_EVENTS.WELCOME;
    const subscribeResponse: SubscribeResponse = await this.webex.request({
      service: WCC_API_GATEWAY,
      resource: SUBSCRIBE_API,
      method: HTTP_METHODS.POST,
      body,
    });

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.webex.logger.error('Timeout waiting for event');
        this.eventHandlers.delete(eventType);
        reject(new Error('Timeout waiting for event'));
      }, WEBSOCKET_EVENT_TIMEOUT);

      // Store the event handler
      this.eventHandlers.set(eventType, (data: WelcomeEvent) => {
        clearTimeout(timeoutId);
        this.eventHandlers.delete(eventType);
        resolve(data);
      });

      this.webSocket.connectWebSocket({
        webSocketUrl: subscribeResponse.body.webSocketUrl,
      });
    });
  }

  public async request(options: {
    service: string;
    resource: string;
    method: HTTP_METHODS;
    body?: object;
  }): Promise<IHttpResponse> {
    const {service, resource, method, body} = options;

    return this.webex.request({
      service,
      resource,
      method,
      body,
    });
  }
}

export default HttpRequest;
