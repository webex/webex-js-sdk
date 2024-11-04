import {SUBSCRIBE_API, WCC_API_GATEWAY, WEBSOCKET_EVENT_TIMEOUT} from './constants';
import {WebexSDK, HTTP_METHODS, SubscribeRequest, WelcomeEvent, IHttpResponse} from '../types';
import IWebSocket from './WebSocket/types';
import WebSocket from './WebSocket';
import {CC_EVENTS, SubscribeResponse} from './types';
import {EVENT} from '../constants';

export type EventHandler = {(data: any): void};

class HttpRequest {
  private webSocket: IWebSocket;
  private webex: WebexSDK;
  private eventHandlers: Map<string, EventHandler>;

  constructor(options: {webex: WebexSDK}) {
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

  /* This calls subscribeNotifications and establishes a websocket connection
   * It sends the request and then listens for the Welcome event
   * If the Welcome event is received, it resolves the promise
   * If the Welcome event is not received, it rejects the promise
   */
  public async subscribeNotifications(options: {body: SubscribeRequest}): Promise<WelcomeEvent> {
    try {
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
        this.eventHandlers.set(eventType, (data: any) => {
          clearTimeout(timeoutId);
          this.eventHandlers.delete(eventType);
          resolve(data);
        });

        this.webSocket.connectWebSocket({
          webSocketUrl: subscribeResponse.body.webSocketUrl,
          subscriptionId: subscribeResponse.body.subscriptionId,
        });
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /* This sends a request and waits for a websocket event
   * It sends the request and then listens for the event type specified in the options
   * If the event type is received, it resolves the promise
   * If the event type is not received, it rejects the promise
   */
  public async sendRequestWithEvent(options: {
    service: string;
    resource: string;
    method: HTTP_METHODS;
    payload: object;
    eventType: string;
    success: string[];
    failure: string[];
  }): Promise<any> {
    try {
      const {service, resource, method, payload, eventType, success, failure} = options;

      // Send the service request
      const response = await this.webex.request({
        service,
        resource,
        method,
        body: payload,
      });
      this.webex.logger.log(`Service request sent successfully: ${response}`);

      // Listen for the event
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.webex.logger.error('Timeout waiting for event');
          this.eventHandlers.delete(eventType);
          reject(new Error('Timeout waiting for event'));
        }, WEBSOCKET_EVENT_TIMEOUT);

        // Store the event handler
        this.eventHandlers.set(eventType, (data: any) => {
          clearTimeout(timeoutId);
          this.eventHandlers.delete(eventType);
          if (success.includes(data.type)) {
            resolve(data);
          } else if (failure.includes(data.type)) {
            const error = new Error();
            error.name = data.type;
            error.message = data.reason;
            reject(error);
          } else {
            // If event type is neither in success nor failure, handle it accordingly
            reject(new Error(`Unexpected event type received: ${data.type}`));
          }
        });
      });
    } catch (error) {
      this.webex.logger.error(`Error sending service request: ${error}`);
      throw error;
    }
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
