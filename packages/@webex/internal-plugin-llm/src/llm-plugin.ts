import {WebexPlugin} from '@webex/webex-core';
import LLMChannel, {config} from './llm';
import {DATA_CHANNEL_WITH_JWT_TOKEN} from './constants';

/**
 * LLMPlugin is a factory registered as the `llm` internal plugin.
 * Instead of a single shared WebSocket connection, it manages a registry of
 * independent {@link LLMChannel} instances — one per active meeting/session.
 *
 * Typical call flow:
 * 1. `createConnection()` — instantiate a new channel
 * 2. `conn.registerAndConnect(locusUrl, datachannelUrl, token)` — connect it
 * 3. `registerConnection(id, conn)` — add it to the registry
 * 4. `unregisterConnection(id)` + `conn.disconnectLLM(options)` — tear it down
 */
export class LLMPlugin extends (WebexPlugin as any) {
  namespace = 'llm';

  /** Registry of active connections, keyed by a caller-supplied id (e.g. meeting id). */
  private connectionRegistry = new Map<string, LLMChannel>();

  /**
   * Creates a new standalone {@link LLMChannel} instance.
   * The caller is responsible for calling `registerAndConnect()` on it
   * and adding it to the registry via `registerConnection()`.
   *
   * @returns {LLMChannel} A new, unconnected LLMChannel instance.
   */
  public createConnection(): LLMChannel {
    // @ts-ignore
    return new LLMChannel({parent: this.webex});
  }

  /**
   * Adds a connection to the registry so the interceptor can look it up by URL.
   * Should be called after `registerAndConnect()` resolves successfully.
   *
   * @param {string} id - Unique identifier for the connection (e.g. meeting id).
   * @param {LLMChannel} conn - The connected LLMChannel instance to register.
   * @returns {void}
   */
  public registerConnection(id: string, conn: LLMChannel): void {
    this.connectionRegistry.set(id, conn);
  }

  /**
   * Removes a connection from the registry.
   * Should be called before or after `conn.disconnectLLM()`.
   *
   * @param {string} id - The identifier used when the connection was registered.
   * @returns {void}
   */
  public unregisterConnection(id: string): void {
    this.connectionRegistry.delete(id);
  }

  /**
   * Finds the {@link LLMChannel} whose `datachannelUrl` matches the given request URL.
   * Used by the `DataChannelAuthTokenInterceptor` to route token refresh to the
   * correct per-meeting connection.
   *
   * @param {string} url - The request URL to match against registered datachannel URLs.
   * @returns {LLMChannel | undefined} The matching connection, or `undefined` if not found.
   */
  public getConnectionByDatachannelUrl(url: string): LLMChannel | undefined {
    for (const conn of this.connectionRegistry.values()) {
      if (LLMChannel.matchesDatachannelRequestUrl(url, conn.getDatachannelUrl())) {
        return conn;
      }
    }

    return undefined;
  }

  /**
   * Returns whether the DataChannel JWT token feature flag is enabled.
   * Kept on the plugin so the interceptor and voicea can query it without
   * needing a reference to a specific connection.
   *
   * @returns {Promise<boolean>} Resolves to `true` if the feature is enabled.
   */
  public isDataChannelTokenEnabled(): Promise<boolean> {
    // @ts-ignore
    return this.webex.internal.feature.getFeature('developer', DATA_CHANNEL_WITH_JWT_TOKEN);
  }
}

export {config};
export default LLMPlugin;
