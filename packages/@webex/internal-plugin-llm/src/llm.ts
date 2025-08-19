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
   * @param {string} sessionId - Connection identifier (defaults to 'main-session')
   * @returns {Promise<void>}
   */
  private register = (llmSocketUrl: string, sessionId = 'main-session'): Promise<void> =>
    this.request({
      method: 'POST',
      url: llmSocketUrl,
      body: {deviceUrl: this.webex.internal.device.url},
    })
      .then((res: {body: {webSocketUrl: string; binding: string}}) => {
        // Get or create connection data
        const connectionData = this.connections.get(sessionId) || {};
        connectionData.webSocketUrl = res.body.webSocketUrl;
        connectionData.binding = res.body.binding;
        this.connections.set(sessionId, connectionData);
      })
      .catch((error: any) => {
        this.logger.error(`Error connecting to websocket for ${sessionId}: ${error}`);
        throw error;
      });

  /**
   * Register and connect to the websocket
   * @param {string} locusUrl
   * @param {string} datachannelUrl
   * @param {string} sessionId - Connection identifier (defaults to 'main-session')
   * @returns {Promise<void>}
   */
  public registerAndConnect = (
    locusUrl: string,
    datachannelUrl: string,
    sessionId = 'main-session'
  ): Promise<void> =>
    this.register(datachannelUrl, sessionId).then(() => {
      if (!locusUrl || !datachannelUrl) return undefined;

      // Get or create connection data
      const connectionData = this.connections.get(sessionId) || {};
      connectionData.locusUrl = locusUrl;
      connectionData.datachannelUrl = datachannelUrl;
      this.connections.set(sessionId, connectionData);

      return this.connect(connectionData.webSocketUrl, sessionId);
    });

  /**
   * Tells if LLM socket is connected
   * @param {string} sessionId - Connection identifier (defaults to 'main-session')
   * @returns {boolean} connected
   */
  public isConnected = (sessionId = 'main-session'): boolean => {
    const socket = this.getSocket(sessionId);

    return socket ? socket.connected : false;
  };

  /**
   * Tells if LLM socket is binding
   * @param {string} sessionId - Connection identifier (defaults to 'main-session')
   * @returns {string} binding
   */
  public getBinding = (sessionId = 'main-session'): string => {
    const connectionData = this.connections.get(sessionId);

    return connectionData?.binding || '';
  };

  /**
   * Get Locus URL for the connection
   * @param {string} sessionId - Connection identifier (defaults to 'main-session')
   * @returns {string} locus Url
   */
  public getLocusUrl = (sessionId = 'main-session'): string => {
    const connectionData = this.connections.get(sessionId);

    return connectionData?.locusUrl || '';
  };

  /**
   * Get data channel URL for the connection
   * @param {string} sessionId - Connection identifier (defaults to 'main-session')
   * @returns {string} data channel Url
   */
  public getDatachannelUrl = (sessionId = 'main-session'): string => {
    const connectionData = this.connections.get(sessionId);

    return connectionData?.datachannelUrl || '';
  };

  /**
   * Disconnects websocket connection
   * @param {{code: number, reason: string}} options - The disconnect option object with code and reason
   * @param {string} sessionId - Connection identifier (defaults to 'main-session')
   * @returns {Promise<void>}
   */
  public disconnectLLM = (
    options: {code: number; reason: string},
    sessionId = 'main-session'
  ): Promise<void> =>
    this.disconnect(options, sessionId).then(() => {
      // Clean up connection data
      this.connections.delete(sessionId);
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
   * @returns {Map} Map of sessionId to connection data
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
    return this.connections.get('main-session')?.webSocketUrl;
  }

  /**
   * @deprecated Use getBinding() instead
   */
  private get binding(): string | undefined {
    return this.connections.get('main-session')?.binding;
  }

  /**
   * @deprecated Use getLocusUrl() instead
   */
  private get locusUrl(): string | undefined {
    return this.connections.get('main-session')?.locusUrl;
  }

  /**
   * @deprecated Use getDatachannelUrl() instead
   */
  private get datachannelUrl(): string | undefined {
    return this.connections.get('main-session')?.datachannelUrl;
  }
}
