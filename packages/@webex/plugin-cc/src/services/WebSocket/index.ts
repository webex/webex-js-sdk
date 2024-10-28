import Mercury from '@webex/internal-plugin-mercury';
import {WebSocketEvent} from '../types';
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

  config = webSocketConfig; // overriding the config of Mercury with CC config

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
   * Subscribe and connect to the websocket
   * @param {object} params
   * @param {string} params.datachannelUrl
   * @param {SubscribeRequest} params.body
   * @returns {Promise<void>}
   */
  connectWebSocket(options: {webSocketUrl: string; subscriptionId: string}): void {
    const {webSocketUrl, subscriptionId} = options;
    this.webSocketUrl = webSocketUrl;
    this.subscriptionId = subscriptionId;
    this.connect(webSocketUrl);
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
