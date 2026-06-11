/* eslint-disable consistent-return */

import Mercury from '@webex/internal-plugin-mercury';

// eslint-disable-next-line no-unused-vars
import {
  LLM,
  DATA_CHANNEL_WITH_JWT_TOKEN,
  AWARE_DATA_CHANNEL,
  SUBSCRIPTION_AWARE_SUBCHANNELS_PARAM,
} from './constants';
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
  private webSocketUrl?: string;
  private binding?: string;
  private locusUrl?: string;
  private datachannelUrl?: string;
  private datachannelToken?: string;

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
        this.logger.error(`LLMChannel#register --> Error connecting to websocket: ${error}`);
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
  public isConnected = (): boolean => {
    const socket = this.getSocket();

    return socket ? socket.connected : false;
  };

  /**
   * @returns {string | undefined} The WebSocket binding identifier
   */
  public getBinding = (): string | undefined => this.binding;

  /**
   * @returns {string | undefined} The locus URL for this connection
   */
  public getLocusUrl = (): string | undefined => this.locusUrl;

  /**
   * @returns {string | undefined} The datachannel registration URL
   */
  public getDatachannelUrl = (): string | undefined => this.datachannelUrl;

  /**
   * @returns {string | undefined} The current datachannel auth token
   */
  public getDatachannelToken = (): string | undefined => this.datachannelToken;

  /**
   * @param {string | undefined} token - The datachannel auth token to store
   * @returns {void}
   */
  public setDatachannelToken = (token: string | undefined): void => {
    this.datachannelToken = token;
  };

  private refreshHandler?: () => Promise<{body: {datachannelToken: string}}>;

  /**
   * Set the handler used to refresh the DataChannel token
   *
   * @param {function} handler - Function that returns a refreshed token
   * @returns {void}
   */
  public setRefreshHandler(handler: () => Promise<{body: {datachannelToken: string}}>): void {
    this.refreshHandler = handler;
  }

  /**
   * Refresh the data channel token using the injected handler.
   * Logs a descriptive error if the handler is missing or fails.
   * @returns {Promise<string>} The refreshed token.
   */
  public async refreshDataChannelToken() {
    if (!this.refreshHandler) {
      this.logger.warn(
        `llm#refreshDataChannelToken --> LLM refreshHandler is not set, skipping token refresh`
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
   * @returns {Promise<void>}
   */
  public disconnectLLM = (options: {code: number; reason: string}): Promise<void> => {
    return this.disconnect(options).then(() => {
      this.webSocketUrl = undefined;
      this.binding = undefined;
      this.locusUrl = undefined;
      this.datachannelUrl = undefined;
      this.refreshHandler = undefined;
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
