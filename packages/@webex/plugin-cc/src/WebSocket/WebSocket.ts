import Mercury from '@webex/internal-plugin-mercury';
import {HTTP_METHODS, SubscribeRequest, WebSocketEvent} from '../types';
import webSocketConfig from './config';
import IWebSocket from './types';

class WebSocket extends (Mercury as any) implements IWebSocket {
  /**
   * @instance
   * @memberof WebSocket
   * @private
   * @type {string}
   */
  private webSocketUrl: string;

  /**
   * @instance
   * @memberof WebSocket
   * @private
   * @type {string}
   */
  private subscriptionId: string;

  /**
   * @instance
   * @memberof WebSocket
   * @private
   * @type {string}
   */
  private datachannelUrl: string;

  constructor(options = {}) {
    super(options);
    Mercury.prototype.initialize(this, options);
  }

  on(event: string, callback: (event: WebSocketEvent) => void): void {
    super.on(event, callback);
  }

  off(event: string, callback: (event: WebSocketEvent) => void): void {
    super.off(event, callback);
  }

  /**
   * Updates the Mercury config
   * @private
   * @type {string}
   */
  private updateConfig(config: Record<string, any>): void {
    Object.keys(config).forEach((key) => {
      this.config[key] = config[key];
    });
  }

  initialize(): void {
    this.updateConfig(webSocketConfig);
  }

  // TODO: this will be moved to a separate file in request module/file
  /**
   * Register to the websocket
   * @param {object} params
   * @param {string} params.datachannelUrl
   * @param {object} params.body
   * @returns {Promise<void>}
   */
  subscribeNotifications({
    datachannelUrl,
    body,
  }: {
    datachannelUrl: string;
    body: SubscribeRequest;
  }): Promise<void> {
    return this.request({
      method: HTTP_METHODS.POST,
      url: datachannelUrl,
      body,
    })
      .then((res) => {
        this.webSocketUrl = res.body.webSocketUrl;
        this.subscriptionId = res.body.subscriptionId;
      })
      .catch((error) => {
        throw error;
      });
  }

  /**
   * Subscribe and connect to the websocket
   * @param {object} params
   * @param {string} params.datachannelUrl
   * @param {SubscribeRequest} params.body
   * @returns {Promise<void>}
   */
  subscribeAndConnect({
    datachannelUrl,
    body,
  }: {
    datachannelUrl: string;
    body: SubscribeRequest;
  }): Promise<void> {
    return this.subscribeNotifications({datachannelUrl, body})
      .then(() => {
        this.datachannelUrl = datachannelUrl;

        this.connect(this.webSocketUrl);

        return Promise.resolve();
      })
      .catch((error) => {
        throw error;
      });
  }

  /**
   * Tells if WebSocket socket is connected
   * @returns {boolean} connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the subscriptionId for the connection
   * @returns {string} subscriptionId
   */
  getSubscriptionId(): string | undefined {
    return this.subscriptionId;
  }

  /**
   * Get data channel URL for the connection
   * @returns {string} data channel Url
   */
  getDatachannelUrl(): string | undefined {
    return this.datachannelUrl;
  }

  /**
   * Disconnects websocket connection
   * @returns {Promise<void>}
   */
  disconnectWebSocket(): Promise<void> {
    return this.disconnect().then(() => {
      this.datachannelUrl = undefined;
      this.subscriptionId = undefined;
      this.webSocketUrl = undefined;
    });
  }
}

export default WebSocket;
