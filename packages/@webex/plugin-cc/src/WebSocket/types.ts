import {SubscribeRequest, WebSocketEvent} from '../types';

// ts doc
/**
 * Interface for WebSocket
 */
interface IWebSocket {
  /**
   * Subscribe to the WebSocket events
   * @param {string} event
   * @param {function} callback
   * @returns {void}
   */
  on(event: string, callback: (event: WebSocketEvent) => void): void;
  /**
   * Unsubscribe from the WebSocket events
   * @param {string} event
   * @param {function} callback
   * @returns {void}
   */
  off(event: string, callback: (event: WebSocketEvent) => void): void;
  /**
   * Subscribe and connect to the WebSocket
   * @param {object} params
   * @param {string} params.datachannelUrl
   * @param {object} params.body
   * @returns {Promise<void>}
   */
  subscribeAndConnect(params: {datachannelUrl: string; body: SubscribeRequest}): Promise<void>;
  /**
   * Check if the WebSocket connection is connected
   * @returns {boolean}
   */
  isConnected(): boolean;
  /**
   * Disconnect the WebSocket connection
   * @returns {Promise<void>}
   */
  disconnectWebSocket(): Promise<void>;
  /**
   * Get the subscriptionId for the connection
   * @returns {string} subscriptionId
   */
  getSubscriptionId(): string | undefined;
  /**
   * Get data channel URL for the connection
   * @returns {string} data channel Url
   */
  getDatachannelUrl(): string | undefined;
}

export default IWebSocket;
