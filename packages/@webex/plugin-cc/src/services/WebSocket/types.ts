import {WebSocketEvent} from '../config/types';

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
   * @param {object} options
   * @returns {void}
   */
  connectWebSocket(options: {webSocketUrl: string}): void;
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
   * Get data channel URL for the connection
   * @returns {string} data channel Url
   */
  getWebSocketUrl(): string | undefined;
}

export default IWebSocket;
