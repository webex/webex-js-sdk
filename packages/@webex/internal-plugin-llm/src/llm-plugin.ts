/* eslint-disable require-jsdoc */
import {WebexPlugin} from '@webex/webex-core';
import LLMChannel, {config} from './llm';
import {DATA_CHANNEL_WITH_JWT_TOKEN} from './constants';

/**
 * LLMPlugin — registered as `webex.internal.llm`.
 *
 * Factory for creating LLMChannel instances. Each Meeting creates and owns
 * its own LLMChannel(s), allowing multiple independent connections without
 * the need for session IDs or ownership tracking.
 *
 * This is a breaking API change from the previous design where the plugin
 * maintained a Map of sessions and exposed session-keyed methods.
 *
 * Old usage (no longer supported):
 *   webex.internal.llm.isConnected()
 *   webex.internal.llm.registerAndConnect(url, dcUrl, token, sessionId)
 *
 * New usage:
 *   const llm = webex.internal.llm.createConnection();
 *   await llm.registerAndConnect(url, dcUrl, token);
 *   llm.isConnected();
 *   // When done:
 *   await llm.disconnect();
 */
export class LLMPlugin extends (WebexPlugin as any) {
  namespace = 'llm';

  /**
   * Registry of active LLM channels for interceptor lookup.
   * Channels are registered when created and unregistered on disconnect.
   */
  private channels = new Set<LLMChannel>();

  /**
   * Creates a new LLMChannel instance. The caller owns the channel and is
   * responsible for connecting, disconnecting, and cleaning it up.
   *
   * @example
   * const llm = webex.internal.llm.createConnection();
   * llm.setRefreshHandler(() => meeting.refreshDataChannelToken());
   * await llm.registerAndConnect(locusUrl, datachannelUrl, token);
   *
   * // Subscribe to events directly on the channel
   * llm.on('event:relay.event', handler);
   * llm.on('online', onlineHandler);
   *
   * // When done
   * await llm.disconnect();
   *
   * @returns {LLMChannel} A new LLM connection instance
   */
  public createConnection(): LLMChannel {
    // @ts-ignore — WebexPlugin children require {parent: this.webex}
    const channel = new LLMChannel({parent: this.webex});

    this.channels.add(channel);
    channel.on('disconnected', () => this.channels.delete(channel));

    return channel;
  }

  /**
   * Returns true if the data channel token feature flag is enabled.
   * This is a global check, not per-connection.
   * @returns {Promise<boolean>}
   */
  public isDataChannelTokenEnabled(): Promise<boolean> {
    // @ts-ignore
    return this.webex.internal.feature.getFeature('developer', DATA_CHANNEL_WITH_JWT_TOKEN);
  }

  /**
   * Find a connection by its datachannel URL. Used by the interceptor to
   * route token refresh requests to the correct channel.
   * @param {string} url - The request URL to match
   * @returns {LLMChannel | undefined}
   */
  public getConnectionByDatachannelUrl(url: string): LLMChannel | undefined {
    for (const channel of this.channels) {
      const datachannelUrl = channel.getDatachannelUrl();

      if (datachannelUrl && LLMChannel.matchesDatachannelRequestUrl(url, datachannelUrl)) {
        return channel;
      }
    }

    return undefined;
  }

  /**
   * Get all active connections. Useful for diagnostics/debugging.
   * @returns {Set<LLMChannel>}
   */
  public getAllConnections(): Set<LLMChannel> {
    return new Set(this.channels);
  }

  /**
   * Disconnect all active connections. Useful for cleanup on logout.
   * @param {object} [options] - Disconnect options
   * @param {number} [options.code] - WebSocket close code
   * @param {string} [options.reason] - WebSocket close reason
   * @returns {Promise<void>}
   */
  public async disconnectAll(options?: {code: number; reason: string}): Promise<void> {
    const promises = Array.from(this.channels).map((channel) => channel.disconnect(options));

    await Promise.all(promises);
  }
}

export {config};
export default LLMPlugin;
