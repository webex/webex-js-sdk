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
   * Key: sessionId
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
      ownerMeetingId?: string;
      refreshHandler?: () => Promise<{
        body: {datachannelToken: string; datachannelTokenType: DataChannelTokenType};
      }>;
    }
  > = new Map();

  // Session-keyed token cache is intentionally decoupled from connection state.
  // Disconnecting a socket session must not implicitly wipe token cache.
  private datachannelTokens: Record<string, string | undefined> = {
    [DataChannelTokenType.Default]: undefined,
    [DataChannelTokenType.PracticeSession]: undefined,
  };

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
  ): Promise<void> => {
    // Pre-populate locusUrl and datachannelUrl before register() fires the
    // HTTP POST, so that any token refresh triggered during registration can
    // be routed via connections without falling back to a locusInfo URL scan.
    if (locusUrl && datachannelUrl) {
      const sessionData = this.connections.get(sessionId) || {};
      sessionData.locusUrl = locusUrl;
      sessionData.datachannelUrl = datachannelUrl;
      this.connections.set(sessionId, sessionData);
    }

    return this.register(datachannelUrl, datachannelToken, sessionId).then(async () => {
      if (!locusUrl || !datachannelUrl) return undefined;

      // locusUrl and datachannelUrl were pre-populated before register(); here
      // we only need to read the existing session data to get webSocketUrl/binding
      // that register() filled in.
      const sessionData = this.connections.get(sessionId) || {};

      const isDataChannelTokenEnabled = await this.isDataChannelTokenEnabled();

      const connectUrl = isDataChannelTokenEnabled
        ? LLMChannel.buildUrlWithAwareSubchannels(sessionData.webSocketUrl, AWARE_DATA_CHANNEL)
        : sessionData.webSocketUrl;

      return this.connect(connectUrl, sessionId);
    });
  };

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
   * Resolve ownership information for an LLM session.
   *
   * Rules:
   * - no current owner => caller may proceed
   * - caller has no identity to assert => treat as owner
   * - otherwise caller must match current owner
   *
   * @param {string | undefined} ownerMeetingId - Candidate owner to evaluate
   * @param {string} sessionId - Connection identifier (defaults to default session)
   * @returns {{currentOwner: (string|undefined), isOwner: boolean}}
   */
  public resolveSessionOwnership = (
    ownerMeetingId?: string,
    sessionId: string = LLM_DEFAULT_SESSION
  ): {
    currentOwner: string | undefined;
    isOwner: boolean;
  } => {
    const currentOwner = this.getOwnerMeetingId(sessionId);
    const isOwner = !currentOwner || !ownerMeetingId || currentOwner === ownerMeetingId;

    return {
      currentOwner,
      isOwner,
    };
  };

  /**
   * Get data channel token for the connection
   * @param {DataChannelTokenType|string} tokenKey
   * @param {string | undefined} ownerMeetingId - Meeting id asserting read ownership
   * @returns {string | undefined} data channel token
   */
  public getDatachannelToken = (
    tokenKey?: DataChannelTokenType | string,
    ownerMeetingId?: string
  ): string | undefined => {
    const resolvedTokenKey = tokenKey ?? DataChannelTokenType.Default;

    const {currentOwner, isOwner} = this.resolveSessionOwnership(ownerMeetingId, resolvedTokenKey);

    if (!isOwner) {
      this.logger.info(
        `llm#getDatachannelToken --> skip read for session ${resolvedTokenKey}; owned by ${currentOwner}, candidate ${ownerMeetingId}`
      );

      return undefined;
    }

    return this.datachannelTokens[resolvedTokenKey];
  };

  /**
   * Set data channel token for the connection
   * @param {string} datachannelToken - data channel token
   * @param {DataChannelTokenType|string} [tokenKey]
   * @param {string | undefined} ownerMeetingId - Meeting id asserting write ownership
   * @returns {void}
   */
  public setDatachannelToken = (
    datachannelToken: string,
    tokenKey?: DataChannelTokenType | string,
    ownerMeetingId?: string
  ): void => {
    const resolvedTokenKey = tokenKey ?? DataChannelTokenType.Default;

    const {currentOwner, isOwner} = this.resolveSessionOwnership(ownerMeetingId, resolvedTokenKey);

    if (!isOwner) {
      this.logger.info(
        `llm#setDatachannelToken --> skip write for session ${resolvedTokenKey}; owned by ${currentOwner}, candidate ${ownerMeetingId}`
      );

      return;
    }

    this.datachannelTokens[resolvedTokenKey] = datachannelToken;
  };

  /**
   * Clears a single session's data channel token.
   * @param {DataChannelTokenType|string} tokenKey
   * @param {string} ownerMeetingId - Meeting id asserting delete ownership
   * @returns {void}
   */
  public clearDatachannelToken = (
    tokenKey: DataChannelTokenType | string,
    ownerMeetingId: string
  ): void => {
    const resolvedTokenKey = tokenKey;

    const {currentOwner, isOwner} = this.resolveSessionOwnership(ownerMeetingId, resolvedTokenKey);

    if (!isOwner) {
      this.logger.info(
        `llm#clearDatachannelToken --> skip clear for session ${resolvedTokenKey}; owned by ${currentOwner}, candidate ${ownerMeetingId}`
      );

      return;
    }

    this.datachannelTokens[resolvedTokenKey] = undefined;
    delete this.datachannelTokens[resolvedTokenKey];
  };

  /**
   * Set the handler used to refresh the DataChannel token
   *
   * @param {function} handler - Function that returns a refreshed token
   * @param {string} [sessionId] - Connection identifier
   * @param {string | undefined} ownerMeetingId - Meeting id asserting refresh-handler ownership
   * @returns {void}
   */
  public setRefreshHandler(
    handler: () => Promise<{
      body: {datachannelToken: string; datachannelTokenType: DataChannelTokenType};
    }>,
    sessionId?: string,
    ownerMeetingId?: string
  ) {
    const resolvedSessionId = sessionId ?? LLM_DEFAULT_SESSION;

    const {currentOwner, isOwner} = this.resolveSessionOwnership(ownerMeetingId, resolvedSessionId);

    if (!isOwner) {
      this.logger.info(
        `llm#setRefreshHandler --> skip write for session ${resolvedSessionId}; owned by ${currentOwner}, candidate ${ownerMeetingId}`
      );

      return;
    }

    const sessionData = this.connections.get(resolvedSessionId);

    if (sessionData) {
      sessionData.refreshHandler = handler;
      if (ownerMeetingId) {
        sessionData.ownerMeetingId = ownerMeetingId;
      }

      return;
    }

    // Intentionally allow a pre-connection session shape here.
    // Some flows inject refreshHandler before register/connect so token refresh
    // is already wired when the socket lifecycle starts. register()/
    // registerAndConnect() will later fill webSocketUrl/binding/locusUrl/
    // datachannelUrl into this same session entry.
    this.connections.set(resolvedSessionId, {
      refreshHandler: handler,
      ownerMeetingId,
    });
  }

  /**
   * Refresh the data channel token using the injected handler.
   * Logs a descriptive error if the handler is missing or fails.
   * @param {string} sessionId - Connection identifier (defaults to default session)
   * @returns {Promise<string>} The refreshed token.
   */
  public async refreshDataChannelToken(sessionId: string = LLM_DEFAULT_SESSION) {
    const refreshHandler = this.connections.get(sessionId)?.refreshHandler;

    if (!refreshHandler) {
      this.logger.warn(
        `llm#refreshDataChannelToken --> LLM refreshHandler is not set for session ${sessionId}, skipping token refresh`
      );

      return null;
    }

    try {
      const res = await refreshHandler();

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
   * @param {string} ownerMeetingId - Meeting id asserting disconnect ownership
   * @returns {Promise<boolean>} True when disconnect was performed, false when skipped
   */
  public disconnectLLM = (
    options: {code: number; reason: string},
    sessionId?: string,
    ownerMeetingId?: string
  ): Promise<boolean> => {
    const resolvedSessionId = sessionId ?? LLM_DEFAULT_SESSION;

    // Backward-compat path: historically callers could omit ownerMeetingId
    // (and sometimes sessionId). Reuse current owner when available so legacy
    // calls remain best-effort without throwing at teardown time.
    const resolvedOwnerMeetingId = ownerMeetingId || this.getOwnerMeetingId(resolvedSessionId);

    if (!ownerMeetingId) {
      this.logger.warn(
        `llm#disconnectLLM --> ownerMeetingId is omitted for session ${resolvedSessionId}; using legacy compatibility path`
      );
    }

    const {currentOwner, isOwner} = this.resolveSessionOwnership(
      resolvedOwnerMeetingId,
      resolvedSessionId
    );

    if (!isOwner) {
      this.logger.info(
        `llm#disconnectLLM --> skip disconnect for session ${resolvedSessionId}; owned by ${currentOwner}, candidate ${resolvedOwnerMeetingId}`
      );

      return Promise.resolve(false);
    }

    return this.disconnect(options, resolvedSessionId).then(() => {
      // Clear owner tag before cleanup to ensure it's not lingering
      // if another meeting claimed it during disconnect
      this.setOwnerMeetingId(undefined, resolvedSessionId);

      // Clean up sessions data
      this.connections.delete(resolvedSessionId);

      return true;
    });
  };

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
      ownerMeetingId?: string;
    }
  > => new Map(this.connections);

  /**
   * Look up the locusUrl associated with a datachannel request URL.
   * Iterates all active LLM sessions and returns the locusUrl of the
   * session whose stored datachannelUrl is a prefix of the given request URL.
   *
   * @param {string} requestUrl - The in-flight request URL to match
   * @returns {string | undefined} The matching locusUrl, or undefined if not found
   */
  public getLocusUrlByDatachannelUrl(requestUrl: string): string | undefined {
    for (const [, connection] of this.connections) {
      if (
        connection.datachannelUrl &&
        LLMChannel.matchesDatachannelRequestUrl(requestUrl, connection.datachannelUrl)
      ) {
        return connection.locusUrl;
      }
    }

    return undefined;
  }

  /**
   * Look up the sessionId associated with a datachannel request URL.
   * Iterates all active LLM sessions and returns the sessionId whose
   * stored datachannelUrl is a prefix of the given request URL.
   *
   * @param {string} requestUrl - The in-flight request URL to match
   * @returns {string | undefined} The matching sessionId, or undefined if not found
   */
  public getSessionIdByDatachannelUrl(requestUrl: string): string | undefined {
    for (const [sessionId, connection] of this.connections) {
      if (
        connection.datachannelUrl &&
        LLMChannel.matchesDatachannelRequestUrl(requestUrl, connection.datachannelUrl)
      ) {
        return sessionId;
      }
    }

    return undefined;
  }

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
