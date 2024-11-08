import Mercury from '@webex/internal-plugin-mercury';
import {WebSocketEvent} from '../config/types';
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
  connectWebSocket(options: {webSocketUrl: string}): void {
    const {webSocketUrl} = options;
    this.webSocketUrl = webSocketUrl;
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
   * Get data channel URL for the connection
   * @returns {string} data channel Url
   */
  getWebSocketUrl(): string | undefined {
    return this.webSocketUrl;
  }

  /**
   * Disconnects websocket connection
   * @returns {Promise<void>}
   */
  disconnectWebSocket(): Promise<void> {
    return this.disconnect().then(() => {
      this.webSocketUrl = undefined;
    });
  }
}

export default WebSocket;
