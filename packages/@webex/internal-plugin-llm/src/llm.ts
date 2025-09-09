/* eslint-disable consistent-return */

import Mercury from '@webex/internal-plugin-mercury';

import {LLM, DEFAULT_SESSION} from './constants';
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
   * @param {string} sessionId - Connection identifier (defaults to DEFAULT_SESSION)
   * @returns {Promise<void>}
   */
  private register = (llmSocketUrl: string, sessionId: string = DEFAULT_SESSION): Promise<void> =>
    this.request({
      method: 'POST',
      url: llmSocketUrl,
      body: {deviceUrl: this.webex.internal.device.url},
    })
      .then((res: {body: {webSocketUrl: string; binding: string}}) => {
        // Get or create connection data
        const sessionData = this.connections.get(sessionId) || {};
        sessionData.webSocketUrl = res.body.webSocketUrl;
        sessionData.binding = res.body.binding;
        this.connections.set(sessionId, sessionData);
      })
      .catch((error: any) => {
        this.logger.error(`Error connecting to websocket for ${sessionId}: ${error}`);
        throw error;
      });

  /**
   * Register and connect to the websocket
   * @param {string} locusUrl
   * @param {string} datachannelUrl
   * @param {string} sessionId - Connection identifier (defaults to DEFAULT_SESSION)
   * @returns {Promise<void>}
   */
  public registerAndConnect = (
    locusUrl: string,
    datachannelUrl: string,
    sessionId: string = DEFAULT_SESSION
  ): Promise<void> =>
    this.register(datachannelUrl, sessionId).then(() => {
      if (!locusUrl || !datachannelUrl) return undefined;

      // Get or create connection data
      const sessionData = this.connections.get(sessionId) || {};
      sessionData.locusUrl = locusUrl;
      sessionData.datachannelUrl = datachannelUrl;
      this.connections.set(sessionId, sessionData);
      console.error(`registerAndConnect(${sessionId}) -->  channel is ${datachannelUrl}!`);

      return this.connect(sessionData.webSocketUrl, sessionId);
    });

  /**
   * Tells if LLM socket is connected
   * @param {string} sessionId - Connection identifier (defaults to DEFAULT_SESSION)
   * @returns {boolean} connected
   */
  public isConnected = (sessionId = DEFAULT_SESSION): boolean => {
    const socket = this.getSocket(sessionId);

    return socket ? socket.connected : false;
  };

  /**
   * Tells if LLM socket is binding
   * @param {string} sessionId - Connection identifier (defaults to DEFAULT_SESSION)
   * @returns {string} binding
   */
  public getBinding = (sessionId = DEFAULT_SESSION): string => {
    const sessionData = this.connections.get(sessionId);

    return sessionData?.binding || '';
  };

  /**
   * Get Locus URL for the connection
   * @param {string} sessionId - Connection identifier (defaults to DEFAULT_SESSION)
   * @returns {string} locus Url
   */
  public getLocusUrl = (sessionId = DEFAULT_SESSION): string => {
    const sessionData = this.connections.get(sessionId);

    return sessionData?.locusUrl || '';
  };

  /**
   * Get data channel URL for the connection
   * @param {string} sessionId - Connection identifier (defaults to DEFAULT_SESSION)
   * @returns {string} data channel Url
   */
  public getDatachannelUrl = (sessionId = DEFAULT_SESSION): string => {
    const sessionData = this.connections.get(sessionId);

    return sessionData?.datachannelUrl || '';
  };

  /**
   * Disconnects websocket connection
   * @param {{code: number, reason: string}} options - The disconnect option object with code and reason
   * @param {string} sessionId - Connection identifier (defaults to DEFAULT_SESSION)
   * @returns {Promise<void>}
   */
  public disconnectLLM = (
    options: {code: number; reason: string},
    sessionId: string = DEFAULT_SESSION
  ): Promise<void> =>
    this.disconnect(options, sessionId).then(() => {
      // Clean up sessions data
      console.error(`disconnectLLM(${sessionId})`);
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
   * @returns {Map} Map of sessionId to session data
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

  /**
   * Set a specific socket as the default socket
   * @param {string} sessionId - The connection identifier
   * @returns {void}
   */
  setDefaultSocket(sessionId = DEFAULT_SESSION) {
    this.socket = this.sockets.get(sessionId) || this.socket.get(DEFAULT_SESSION);
  }
}
