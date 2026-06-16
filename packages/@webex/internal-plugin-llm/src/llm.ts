/* eslint-disable consistent-return */
import Mercury from '@webex/internal-plugin-mercury';

import {
  LLM,
  DATA_CHANNEL_WITH_JWT_TOKEN,
  AWARE_DATA_CHANNEL,
  SUBSCRIPTION_AWARE_SUBCHANNELS_PARAM,
} from './constants';
import {DataChannelTokenType} from './llm.types';

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
 * LLMChannel — a single WebSocket connection to the LLM data channel.
 * Session-level routing (multiple connections keyed by sessionId) is handled
 * by LLMPlugin, which owns a Map<sessionId, LLMChannel>.
 */
export default class LLMChannel extends (Mercury as any) {
  namespace = LLM;

  private webSocketUrl?: string;
  private binding?: string;
  private locusUrl?: string;
  private datachannelUrl?: string;
  private datachannelToken?: string;
  private refreshHandler?: () => Promise<{
    body: {datachannelToken: string; datachannelTokenType: DataChannelTokenType};
  }>;

  /** Owning meeting ID — set by LLMPlugin to prevent cross-meeting teardown. */
  public ownerMeetingId?: string;

  /**
   * Register to the websocket
   * @param {string} llmSocketUrl
   * @param {string} datachannelToken
   * @returns {Promise<void>}
   */
  private register = async (llmSocketUrl: string, datachannelToken?: string): Promise<void> => {
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
        this.webSocketUrl = res.body.webSocketUrl;
        this.binding = res.body.binding;
      })
      .catch((error: any) => {
        this.logger.error(`Error connecting to websocket for : ${error}`);
        throw error;
      });
  };

  /**
   * Register and connect to the websocket
   * @param {string} locusUrl
   * @param {string} datachannelUrl
   * @param {string} datachannelToken
   * @returns {Promise<void>}
   */
  public registerAndConnect = (
    locusUrl: string,
    datachannelUrl: string,
    datachannelToken?: string
  ): Promise<void> => {
    // Store directly on the instance — no session map needed
    this.locusUrl = locusUrl;
    this.datachannelUrl = datachannelUrl;

    return this.register(datachannelUrl, datachannelToken).then(async () => {
      const isDataChannelTokenEnabled = await this.isDataChannelTokenEnabled();

      const connectUrl =
        isDataChannelTokenEnabled && this.webSocketUrl
          ? LLMChannel.buildUrlWithAwareSubchannels(this.webSocketUrl, AWARE_DATA_CHANNEL)
          : this.webSocketUrl;

      return this.connect(connectUrl);
    });
  };

  /**
   * Tells if LLM socket is connected
   * @returns {boolean} connected
   */
  public isConnected = (): boolean => this.connected;

  /**
   * Tells if LLM socket is binding
   * @returns {string | undefined} binding
   */
  public getBinding = (): string | undefined => this.binding;

  /**
   * Get Locus URL for the connection
   * @returns {string | undefined} locus Url
   */
  public getLocusUrl = (): string | undefined => this.locusUrl;

  /**
   * Get data channel URL for the connection
   * @returns {string | undefined} data channel Url
   */
  public getDatachannelUrl = (): string | undefined => this.datachannelUrl;

  /**
   * Get data channel token for this connection.
   * @returns {string | undefined}
   */
  public getDatachannelToken = (): string | undefined => this.datachannelToken;

  /**
   * Store the data channel token for this connection.
   * @param {string} token
   * @returns {void}
   */
  public setDatachannelToken = (token: string): void => {
    this.datachannelToken = token;
  };

  /**
   * Clear the data channel token for this connection.
   * @returns {void}
   */
  public clearDatachannelToken = (): void => {
    this.datachannelToken = undefined;
  };

  /**
   * Set the handler used to refresh the DataChannel token.
   * @param {function} handler
   * @returns {void}
   */
  public setRefreshHandler = (
    handler: () => Promise<{
      body: {datachannelToken: string; datachannelTokenType: DataChannelTokenType};
    }>
  ): void => {
    this.refreshHandler = handler;
  };

  /**
   * Refresh the data channel token using the injected handler.
   * @returns {Promise<object | null>}
   */
  public async refreshDataChannelToken() {
    if (!this.refreshHandler) {
      this.logger.warn(
        'llm#refreshDataChannelToken --> LLM refreshHandler is not set, skipping token refresh'
      );

      return null;
    }

    try {
      return await this.refreshHandler();
    } catch (error: any) {
      this.logger.warn(
        `llm#refreshDataChannelToken --> DataChannel token refresh failed: ${
          error?.message || error
        }`
      );

      return null;
    }
  }

  /**
   * Disconnects the WebSocket and clears all connection state.
   * @param {object} [options]
   * @returns {Promise<void>}
   */
  public disconnectLLM = (options?: {code: number; reason: string}): Promise<void> => {
    return this.disconnect(options).then(() => {
      this.webSocketUrl = undefined;
      this.binding = undefined;
      this.locusUrl = undefined;
      this.datachannelUrl = undefined;
      this.datachannelToken = undefined;
      this.refreshHandler = undefined;
      this.ownerMeetingId = undefined;
    });
  };

  /**
   * Matches a request URL to a stored datachannel registration URL.
   * Host can differ (e.g. rewritten by hostmap interceptor), so we first
   * try full URL prefix and then fall back to pathname prefix.
   * @param {string} requestUrl
   * @param {string} registrationUrl
   * @returns {boolean}
   */
  public static matchesDatachannelRequestUrl(requestUrl: string, registrationUrl: string): boolean {
    if (!requestUrl || !registrationUrl) {
      return false;
    }

    if (requestUrl.startsWith(registrationUrl)) {
      return true;
    }

    try {
      const request = new URL(requestUrl);
      const registration = new URL(registrationUrl);

      return request.pathname.startsWith(registration.pathname);
    } catch (error) {
      return false;
    }
  }

  /**
   * Returns true if the data channel token feature flag is enabled.
   * @returns {Promise<boolean>}
   */
  public isDataChannelTokenEnabled(): Promise<boolean> {
    // @ts-ignore
    return this.webex.internal.feature.getFeature('developer', DATA_CHANNEL_WITH_JWT_TOKEN);
  }

  /**
   * Builds a WebSocket URL with the `subscriptionAwareSubchannels` query parameter.
   * @param {string} baseUrl
   * @param {string[]} subchannels
   * @returns {string}
   */
  public static buildUrlWithAwareSubchannels = (baseUrl: string, subchannels: string[]) => {
    const urlObj = new URL(baseUrl);
    urlObj.searchParams.set(SUBSCRIPTION_AWARE_SUBCHANNELS_PARAM, subchannels.join(','));

    return urlObj.toString();
  };
}
