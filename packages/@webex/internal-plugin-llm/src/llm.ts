/* eslint-disable consistent-return */

import Mercury from '@webex/internal-plugin-mercury';

import {LLM, DATA_CHANNEL_WITH_JWT_TOKEN} from './constants';
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

  /**
   * If the LLM plugin has been registered and listening
   * @instance
   * @type {Boolean}
   * @public
   */

  private webSocketUrl?: string;

  private binding?: string;

  private locusUrl?: string;

  private datachannelUrl?: string;

  private datachannelToken?: string;

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
        this.logger.error(`Error connecting to websocket: ${error}`);
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
  ): Promise<void> =>
    this.register(datachannelUrl, datachannelToken).then(() => {
      if (!locusUrl || !datachannelUrl) return undefined;
      this.locusUrl = locusUrl;
      this.datachannelUrl = datachannelUrl;
      this.connect(this.webSocketUrl);
    });

  /**
   * Tells if LLM socket is connected
   * @returns {boolean} connected
   */
  public isConnected = (): boolean => this.connected;

  /**
   * Tells if LLM socket is binding
   * @returns {string} binding
   */
  public getBinding = (): string => this.binding;

  /**
   * Get Locus URL for the connection
   * @returns {string} locus Url
   */
  public getLocusUrl = (): string => this.locusUrl;

  /**
   * Get data channel URL for the connection
   * @returns {string} data channel Url
   */
  public getDatachannelUrl = (): string => this.datachannelUrl;

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
   * Disconnects websocket connection
   * @param {{code: number, reason: string}} options - The disconnect option object with code and reason
   * @returns {Promise<void>}
   */
  public disconnectLLM = (options: object): Promise<void> =>
    this.disconnect(options).then(() => {
      this.locusUrl = undefined;
      this.datachannelUrl = undefined;
      this.binding = undefined;
      this.webSocketUrl = undefined;
    });

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
   * Returns true if  data channel token is enabled, false otherwise
   * @returns {Promise<boolean>} resolves with true if data channel token  is enabled
   */
  public isDataChannelTokenEnabled(): Promise<boolean> {
    // @ts-ignore
    return this.webex.internal.feature.getFeature('developer', DATA_CHANNEL_WITH_JWT_TOKEN);
  }
}
