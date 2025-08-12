/* eslint-disable consistent-return */

import Mercury from '@webex/internal-plugin-mercury';

import {LLM} from './constants';
// eslint-disable-next-line no-unused-vars
import {ILLMChannel} from './llm.types';

export const config = {
  llm: {
    /**
     * Milliseconds between pings sent up the socket
     * @type {number}
     */
    pingInterval: process.env.MERCURY_PING_INTERVAL || 15000,
    /**
     * Milliseconds to wait for a pong before declaring the connection dead
     * @type {number}
     */
    pongTimeout: process.env.MERCURY_PONG_TIMEOUT || 14000,
    /**
     * Maximum milliseconds between connection attempts
     * @type {Number}
     */
    backoffTimeMax: process.env.MERCURY_BACKOFF_TIME_MAX || 32000,
    /**
     * Initial milliseconds between connection attempts
     * @type {Number}
     */
    backoffTimeReset: process.env.MERCURY_BACKOFF_TIME_RESET || 1000,
    /**
     * Milliseconds to wait for a close frame before declaring the socket dead and
     * discarding it
     * @type {[type]}
     */
    forceCloseDelay: process.env.MERCURY_FORCE_CLOSE_DELAY || 2000,
  },
};

/**
 * LLMChannel to provide socket connections
 */
export default class LLMChannel extends (Mercury as any) implements ILLMChannel {
  namespace = LLM;

  /**
   * Map to store connection-specific data for multiple LLM connections
   * @private
   * @type {Map<string, {webSocketUrl?: string; binding?: string; locusUrl?: string; datachannelUrl?: string}>}
   */
  private connections: Map<
    string,
    {
      webSocketUrl?: string;
      binding?: string;
      locusUrl?: string;
      datachannelUrl?: string;
    }
  > = new Map();

  /**
   * Register to the websocket
   * @param {string} llmSocketUrl
   * @param {string} connectionId - Connection identifier (defaults to 'default')
   * @returns {Promise<void>}
   */
  private register = (llmSocketUrl: string, connectionId = 'default'): Promise<void> =>
    this.request({
      method: 'POST',
      url: llmSocketUrl,
      body: {deviceUrl: this.webex.internal.device.url},
    })
      .then((res: {body: {webSocketUrl: string; binding: string}}) => {
        // Get or create connection data
        const connectionData = this.connections.get(connectionId) || {};
        connectionData.webSocketUrl = res.body.webSocketUrl;
        connectionData.binding = res.body.binding;
        this.connections.set(connectionId, connectionData);
      })
      .catch((error: any) => {
        this.logger.error(`Error connecting to websocket for ${connectionId}: ${error}`);
        throw error;
      });

  /**
   * Register and connect to the websocket
   * @param {string} locusUrl
   * @param {string} datachannelUrl
   * @param {string} connectionId - Connection identifier (defaults to 'default')
   * @returns {Promise<void>}
   */
  public registerAndConnect = (
    locusUrl: string,
    datachannelUrl: string,
    connectionId = 'default'
  ): Promise<void> =>
    this.register(datachannelUrl, connectionId).then(() => {
      if (!locusUrl || !datachannelUrl) return undefined;

      // Get or create connection data
      const connectionData = this.connections.get(connectionId) || {};
      connectionData.locusUrl = locusUrl;
      connectionData.datachannelUrl = datachannelUrl;
      this.connections.set(connectionId, connectionData);

      return this.connect(connectionData.webSocketUrl, connectionId);
    });

  /**
   * Tells if LLM socket is connected
   * @param {string} connectionId - Connection identifier (defaults to 'default')
   * @returns {boolean} connected
   */
  public isConnected = (connectionId = 'default'): boolean => {
    const socket = this.getSocket(connectionId);

    return socket ? socket.connected : false;
  };

  /**
   * Tells if LLM socket is binding
   * @param {string} connectionId - Connection identifier (defaults to 'default')
   * @returns {string} binding
   */
  public getBinding = (connectionId = 'default'): string => {
    const connectionData = this.connections.get(connectionId);

    return connectionData?.binding || '';
  };

  /**
   * Get Locus URL for the connection
   * @param {string} connectionId - Connection identifier (defaults to 'default')
   * @returns {string} locus Url
   */
  public getLocusUrl = (connectionId = 'default'): string => {
    const connectionData = this.connections.get(connectionId);

    return connectionData?.locusUrl || '';
  };

  /**
   * Get data channel URL for the connection
   * @param {string} connectionId - Connection identifier (defaults to 'default')
   * @returns {string} data channel Url
   */
  public getDatachannelUrl = (connectionId = 'default'): string => {
    const connectionData = this.connections.get(connectionId);

    return connectionData?.datachannelUrl || '';
  };

  /**
   * Disconnects websocket connection
   * @param {{code: number, reason: string}} options - The disconnect option object with code and reason
   * @param {string} connectionId - Connection identifier (defaults to 'default')
   * @returns {Promise<void>}
   */
  public disconnectLLM = (
    options: {code: number; reason: string},
    connectionId = 'default'
  ): Promise<void> =>
    this.disconnect(options, connectionId).then(() => {
      // Clean up connection data
      this.connections.delete(connectionId);
    });

  /**
   * Disconnects all LLM websocket connections
   * @param {{code: number, reason: string}} options - The disconnect option object with code and reason
   * @returns {Promise<void>}
   */
  public disconnectAllLLM = (options?: {code: number; reason: string}): Promise<void> =>
    this.disconnectAll(options).then(() => {
      // Clean up all connection data
      this.connections.clear();
    });

  /**
   * Get all active LLM connections
   * @returns {Map} Map of connectionId to connection data
   */
  public getAllConnections = (): Map<
    string,
    {
      webSocketUrl?: string;
      binding?: string;
      locusUrl?: string;
      datachannelUrl?: string;
    }
  > => new Map(this.connections);

  // Legacy properties for backward compatibility with single connection
  /**
   * @deprecated Use getBinding() instead
   */
  private get webSocketUrl(): string | undefined {
    return this.connections.get('default')?.webSocketUrl;
  }

  /**
   * @deprecated Use getBinding() instead
   */
  private get binding(): string | undefined {
    return this.connections.get('default')?.binding;
  }

  /**
   * @deprecated Use getLocusUrl() instead
   */
  private get locusUrl(): string | undefined {
    return this.connections.get('default')?.locusUrl;
  }

  /**
   * @deprecated Use getDatachannelUrl() instead
   */
  private get datachannelUrl(): string | undefined {
    return this.connections.get('default')?.datachannelUrl;
  }
}
