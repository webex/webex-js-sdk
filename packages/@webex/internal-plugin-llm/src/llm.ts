/* eslint-disable consistent-return */

import Mercury from '@webex/internal-plugin-mercury';

// eslint-disable-next-line no-unused-vars
import {
  LLM,
  DATA_CHANNEL_WITH_JWT_TOKEN,
  AWARE_DATA_CHANNEL,
  SUBSCRIPTION_AWARE_SUBCHANNELS_PARAM,
  LLM_DEFAULT_SESSION,
} from './constants';
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
      ownerMeetingId?: string;
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
    this.register(datachannelUrl, datachannelToken, sessionId).then(async () => {
      if (!locusUrl || !datachannelUrl) return undefined;

      // Get or create connection data
      const sessionData = this.connections.get(sessionId) || {};
      sessionData.locusUrl = locusUrl;
      sessionData.datachannelUrl = datachannelUrl;
      sessionData.datachannelToken = datachannelToken;
      this.connections.set(sessionId, sessionData);

      const isDataChannelTokenEnabled = await this.isDataChannelTokenEnabled();

      const connectUrl = isDataChannelTokenEnabled
        ? LLMChannel.buildUrlWithAwareSubchannels(sessionData.webSocketUrl, AWARE_DATA_CHANNEL)
        : sessionData.webSocketUrl;

      return this.connect(connectUrl, sessionId);
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
   * Set the owner meeting ID for a given LLM session. Used by the meetings
   * plugin to tag which Meeting instance currently owns the (default) LLM
   * connection so that other Meeting instances can avoid disconnecting or
   * re-initializing a connection they do not own.
   *
   * Does NOT create a connections entry if one does not already exist — this
   * method is a no-op when there is no active session data. Callers should
   * invoke it after a successful `registerAndConnect` or during an explicit
   * ownership handoff.
   *
   * @param {string | undefined} ownerMeetingId - Meeting ID (or undefined to clear)
   * @param {string} sessionId - Connection identifier (defaults to default session)
   * @returns {void}
   */
  public setOwnerMeetingId = (
    ownerMeetingId: string | undefined,
    sessionId: string = LLM_DEFAULT_SESSION
  ): void => {
    const sessionData = this.connections.get(sessionId);

    if (!sessionData) {
      return;
    }

    sessionData.ownerMeetingId = ownerMeetingId;
    this.connections.set(sessionId, sessionData);
  };

  /**
   * Get the owner meeting ID currently associated with an LLM session.
   * Returns undefined when no owner has been assigned (e.g. before the
   * first successful `registerAndConnect`, or after `disconnectLLM`).
   *
   * @param {string} sessionId - Connection identifier (defaults to default session)
   * @returns {string | undefined} ownerMeetingId
   */
  public getOwnerMeetingId = (sessionId: string = LLM_DEFAULT_SESSION): string | undefined => {
    const sessionData = this.connections.get(sessionId);

    return sessionData?.ownerMeetingId;
  };

  /**
   * Get data channel token for the connection
   * @param {DataChannelTokenType} dataChannelTokenType
   * @returns {string} data channel token
   */
  public getDatachannelToken = (
    dataChannelTokenType: DataChannelTokenType = DataChannelTokenType.Default
  ): string => {
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
    dataChannelTokenType: DataChannelTokenType = DataChannelTokenType.Default
  ): void => {
    this.datachannelTokens[dataChannelTokenType] = datachannelToken;
  };

  /**
   * Resets all data‑channel tokens to their initial undefined values.
   * Used when leaving or disconnecting from a meeting.
   * @returns {void}
   */
  public resetDatachannelTokens() {
    this.datachannelTokens = {
      [DataChannelTokenType.Default]: undefined,
      [DataChannelTokenType.PracticeSession]: undefined,
    };
  }

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
      this.logger.warn(
        'llm#refreshDataChannelToken --> LLM refreshHandler is not set, skipping token refresh'
      );

      return null;
    }

    try {
      const res = await this.refreshHandler();

      return res;
    } catch (error: any) {
      this.logger.warn(
        `llm#refreshDataChannelToken --> DataChannel token refresh failed (likely locus changed or participant left): ${
          error?.message || error
        }`
      );

      return null;
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
      ownerMeetingId?: string;
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

  /**
   * Builds a WebSocket URL with the `subscriptionAwareSubchannels` query parameter.
   *
   * @param {string} baseUrl - The original WebSocket URL.
   * @param {string[]} subchannels - List of subchannels to declare as subscription-aware.
   * @returns {string} The final URL with updated query parameters.
   */

  public static buildUrlWithAwareSubchannels = (baseUrl: string, subchannels: string[]) => {
    const urlObj = new URL(baseUrl);
    urlObj.searchParams.set(SUBSCRIPTION_AWARE_SUBCHANNELS_PARAM, subchannels.join(','));

    return urlObj.toString();
  };
}
