/* eslint-disable consistent-return */

import Mercury from '@webex/internal-plugin-mercury';

import {LLM, DATA_CHANNEL_WITH_JWT_TOKEN, LLM_DEFAULT_SESSION} from './constants';
// eslint-disable-next-line no-unused-vars
import {ILLMChannel, DataChannelTokenType} from './llm.types';

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
  defaultSessionId = LLM_DEFAULT_SESSION;
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
      datachannelToken?: string;
    }
  > = new Map();

  private datachannelTokens: Record<DataChannelTokenType, string> = {
    [DataChannelTokenType.Default]: undefined,
    [DataChannelTokenType.PracticeSession]: undefined,
  };

  private refreshHandler?: () => Promise<{
    body: {datachannelToken: string; datachannelTokenType: DataChannelTokenType};
  }>;

  /**
   * Register to the websocket
   * @param {string} llmSocketUrl
   * @param {string} datachannelToken
   * @param {string} sessionId - Connection identifier
   * @returns {Promise<void>}
   */
  private register = async (
    llmSocketUrl: string,
    datachannelToken?: string,
    sessionId: string = LLM_DEFAULT_SESSION
  ): Promise<void> => {
    const isDataChannelTokenEnabled = await this.isDataChannelTokenEnabled();

    return this.request({
      method: 'POST',
      url: llmSocketUrl,
      body: {deviceUrl: this.webex.internal.device.url},
      headers:
        isDataChannelTokenEnabled && datachannelToken
          ? {'Data-Channel-Auth-Token': datachannelToken}
          : {},
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
  };

  /**
   * Register and connect to the websocket
   * @param {string} locusUrl
   * @param {string} datachannelUrl
   * @param {string} datachannelToken
   * @param {string} sessionId - Connection identifier
   * @returns {Promise<void>}
   */
  public registerAndConnect = (
    locusUrl: string,
    datachannelUrl: string,
    datachannelToken?: string,
    sessionId: string = LLM_DEFAULT_SESSION
  ): Promise<void> =>
    this.register(datachannelUrl, datachannelToken, sessionId).then(() => {
      if (!locusUrl || !datachannelUrl) return undefined;

      // Get or create connection data
      const sessionData = this.connections.get(sessionId) || {};
      sessionData.locusUrl = locusUrl;
      sessionData.datachannelUrl = datachannelUrl;
      sessionData.datachannelToken = datachannelToken;
      this.connections.set(sessionId, sessionData);

      return this.connect(sessionData.webSocketUrl, sessionId);
    });

  /**
   * Tells if LLM socket is connected
   * @param {string} sessionId - Connection identifier
   * @returns {boolean} connected
   */
  public isConnected = (sessionId = LLM_DEFAULT_SESSION): boolean => {
    const socket = this.getSocket(sessionId);

    return socket ? socket.connected : false;
  };

  /**
   * Tells if LLM socket is binding
   * @param {string} sessionId - Connection identifier
   * @returns {string} binding
   */
  public getBinding = (sessionId = LLM_DEFAULT_SESSION): string => {
    const sessionData = this.connections.get(sessionId);

    return sessionData?.binding;
  };

  /**
   * Get Locus URL for the connection
   * @param {string} sessionId - Connection identifier
   * @returns {string} locus Url
   */
  public getLocusUrl = (sessionId = LLM_DEFAULT_SESSION): string => {
    const sessionData = this.connections.get(sessionId);

    return sessionData?.locusUrl;
  };

  /**
   * Get data channel URL for the connection
   * @param {string} sessionId - Connection identifier
   * @returns {string} data channel Url
   */
  public getDatachannelUrl = (sessionId = LLM_DEFAULT_SESSION): string => {
    const sessionData = this.connections.get(sessionId);

    return sessionData?.datachannelUrl;
  };

  /**
   * Get data channel token for the connection
   * @param {DataChannelTokenType} dataChannelTokenType
   * @returns {string} data channel token
   */
  public getDatachannelToken = (dataChannelTokenType: DataChannelTokenType): string => {
    return this.datachannelTokens[dataChannelTokenType];
  };

  /**
   * Set data channel token for the connection
   * @param {string} datachannelToken - data channel token
   * @param {DataChannelTokenType} dataChannelTokenType
   * @returns {void}
   */
  public setDatachannelToken = (
    datachannelToken: string,
    dataChannelTokenType: DataChannelTokenType
  ): void => {
    this.datachannelTokens[dataChannelTokenType] = datachannelToken;
  };

  /**
   * Set the handler used to refresh the DataChannel token
   *
   * @param {function} handler - Function that returns a refreshed token
   * @returns {void}
   */
  public setRefreshHandler(
    handler: () => Promise<{
      body: {datachannelToken: string; datachannelTokenType: DataChannelTokenType};
    }>
  ) {
    this.refreshHandler = handler;
  }

  /**
   * Refresh the data channel token using the injected handler.
   * Logs a descriptive error if the handler is missing or fails.
   *
   * @returns {Promise<string>} The refreshed token.
   */
  public async refreshDataChannelToken() {
    if (!this.refreshHandler) {
      const error = new Error('LLM refreshHandler is not set');
      this.logger.error(`Error refreshing DataChannel token: ${error.message}`);
      throw error;
    }

    try {
      const res = await this.refreshHandler();

      return res;
    } catch (error: any) {
      this.logger.error(`Error refreshing DataChannel token: ${error}`);
      throw error;
    }
  }

  /**
   * Disconnects websocket connection
   * @param {{code: number, reason: string}} options - The disconnect option object with code and reason
   * @param {string} sessionId - Connection identifier
   * @returns {Promise<void>}
   */
  public disconnectLLM = (
    options: {code: number; reason: string},
    sessionId: string = LLM_DEFAULT_SESSION
  ): Promise<void> =>
    this.disconnect(options, sessionId).then(() => {
      // Clean up sessions data
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
      datachannelToken?: string;
    }
  > => new Map(this.connections);

  /**
   * Returns true if  data channel token is enabled, false otherwise
   * @returns {Promise<boolean>} resolves with true if data channel token  is enabled
   */
  public isDataChannelTokenEnabled(): Promise<boolean> {
    // @ts-ignore
    return this.webex.internal.feature.getFeature('developer', DATA_CHANNEL_WITH_JWT_TOKEN);
  }
}
