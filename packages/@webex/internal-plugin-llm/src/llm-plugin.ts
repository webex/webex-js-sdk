/* eslint-disable require-jsdoc */
import {WebexPlugin} from '@webex/webex-core';
import LLMChannel, {config} from './llm';
import {DATA_CHANNEL_WITH_JWT_TOKEN, LLM_DEFAULT_SESSION} from './constants';
import {DataChannelTokenType} from './llm.types';

/**
 * LLMPlugin — registered as `webex.internal.llm`.
 *
 * Maintains a Map<sessionId, LLMChannel> so multiple simultaneous LLM
 * connections (e.g. default session + practice session) can coexist.
 * All existing callers continue to work unchanged via the session-keyed API.
 *
 * sessionId values are the LLM_DEFAULT_SESSION / LLM_PRACTICE_SESSION constants,
 * which match the DataChannelTokenType enum values so token keys and session keys
 * are the same namespace.
 */
export class LLMPlugin extends (WebexPlugin as any) {
  namespace = 'llm';

  private sessions = new Map<string, LLMChannel>();

  private connectingPromises = new Map<string, Promise<void>>();

  private getOrCreateSession(sessionId: string): LLMChannel {
    let channel = this.sessions.get(sessionId);

    if (!channel) {
      // @ts-ignore — WebexPlugin children require {parent: this.webex}
      channel = new LLMChannel({parent: this.webex});
      // Forward all events emitted by the channel up through the plugin so that
      // callers doing llm.on('event:relay.event', ...) or llm.on('online', ...)
      // receive events from whichever session channel emits them.
      channel.on('all', (eventName: string, ...args: any[]) => {
        this.trigger(eventName, ...args);
      });
      this.sessions.set(sessionId, channel);
    }

    return channel;
  }

  private getSession(sessionId: string): LLMChannel | undefined {
    return this.sessions.get(sessionId);
  }

  // Before webex.internal.llm was LLChannel instance which extended Mercury so it was directly available
  get hasEverConnected(): boolean {
    for (const ch of this.sessions.values()) {
      if (ch.hasEverConnected) return true;
    }

    return false;
  }

  public registerAndConnect(
    locusUrl: string,
    datachannelUrl: string,
    datachannelToken?: string,
    sessionId: string = LLM_DEFAULT_SESSION
  ): Promise<void> {
    // Deduplicate concurrent calls for the same session while a connection is in-flight.
    const inProgress = this.connectingPromises.get(sessionId);

    if (inProgress) {
      return inProgress;
    }

    const channel = this.getOrCreateSession(sessionId);

    // If the channel is already connected to the exact same datachannel URL,
    // there is nothing to do — avoid triggering a reconnect that would cause
    // the server to replace the existing connection with 4000 Replaced.
    if (
      channel.isConnected() &&
      channel.getDatachannelUrl() === datachannelUrl &&
      channel.getLocusUrl() === locusUrl
    ) {
      return Promise.resolve();
    }

    const promise = channel
      .registerAndConnect(locusUrl, datachannelUrl, datachannelToken)
      .finally(() => {
        this.connectingPromises.delete(sessionId);
      });

    this.connectingPromises.set(sessionId, promise);

    return promise;
  }

  public disconnectLLM(
    options: {code: number; reason: string},
    // eslint-disable-next-line default-param-last
    sessionId: string = LLM_DEFAULT_SESSION,
    ownerMeetingId?: string
  ): Promise<boolean | void> {
    const channel = this.getSession(sessionId);

    if (!channel) return Promise.resolve();

    const {isOwner} = this.resolveSessionOwnership(ownerMeetingId, sessionId);

    if (!isOwner) {
      this.logger.info(`llm#disconnectLLM --> skipping, not owner of session ${sessionId}`);

      return Promise.resolve(false);
    }

    return channel.disconnectLLM(options).then(() => {
      this.sessions.delete(sessionId);

      return true;
    });
  }

  public disconnectAllLLM(options?: {code: number; reason: string}): Promise<void> {
    const promises = Array.from(this.sessions.entries()).map(([sessionId, channel]) =>
      channel.disconnectLLM(options).then(() => this.sessions.delete(sessionId))
    );

    return Promise.all(promises).then(() => undefined);
  }

  public isConnected(sessionId: string = LLM_DEFAULT_SESSION): boolean {
    return this.getSession(sessionId)?.isConnected() ?? false;
  }

  public getBinding(sessionId: string = LLM_DEFAULT_SESSION): string | undefined {
    return this.getSession(sessionId)?.getBinding();
  }

  public getSocket(sessionId: string = LLM_DEFAULT_SESSION): any {
    return this.getSession(sessionId)?.socket;
  }

  // Backwards-compatibility: callers that access llm.socket directly
  // (e.g. voicea's getPublishTransport) get the default session socket.
  get socket(): any {
    return this.getSocket(LLM_DEFAULT_SESSION);
  }

  public getLocusUrl(sessionId: string = LLM_DEFAULT_SESSION): string | undefined {
    return this.getSession(sessionId)?.getLocusUrl();
  }

  public getDatachannelUrl(sessionId: string = LLM_DEFAULT_SESSION): string | undefined {
    return this.getSession(sessionId)?.getDatachannelUrl();
  }

  // tokenKey IS the sessionId (DataChannelTokenType enum values equal LLM_*_SESSION constants)

  public getDatachannelToken(
    // eslint-disable-next-line default-param-last
    tokenKey: string = LLM_DEFAULT_SESSION,
    ownerMeetingId?: string
  ): string | undefined {
    const channel = this.getSession(tokenKey);

    if (!channel) return undefined;

    const {isOwner, currentOwner} = this.resolveSessionOwnership(ownerMeetingId, tokenKey);

    if (!isOwner) {
      this.logger.info(
        `llm#getDatachannelToken --> skip read for session ${tokenKey}; owned by ${currentOwner}, candidate ${ownerMeetingId}`
      );

      return undefined;
    }

    return channel.getDatachannelToken();
  }

  public setDatachannelToken(
    datachannelToken: string,
    ownerMeetingId?: string,
    tokenKey: string = LLM_DEFAULT_SESSION
  ): void {
    const channel = this.getOrCreateSession(tokenKey);
    const {isOwner, currentOwner} = this.resolveSessionOwnership(ownerMeetingId, tokenKey);

    if (!isOwner) {
      this.logger.info(
        `llm#setDatachannelToken --> skip write for session ${tokenKey}; owned by ${currentOwner}, candidate ${ownerMeetingId}`
      );

      return;
    }

    channel.setDatachannelToken(datachannelToken);
  }

  public clearDatachannelToken(tokenKey: string, ownerMeetingId: string): void {
    const channel = this.getSession(tokenKey);

    if (!channel) return;

    const {isOwner, currentOwner} = this.resolveSessionOwnership(ownerMeetingId, tokenKey);

    if (!isOwner) {
      this.logger.info(
        `llm#clearDatachannelToken --> skip clear for session ${tokenKey}; owned by ${currentOwner}, candidate ${ownerMeetingId}`
      );

      return;
    }

    channel.clearDatachannelToken();
  }

  public setRefreshHandler(
    handler: () => Promise<{
      body: {datachannelToken: string; datachannelTokenType: DataChannelTokenType};
    }>,
    ownerMeetingId?: string,
    sessionId: string = LLM_DEFAULT_SESSION
  ): void {
    const channel = this.getOrCreateSession(sessionId);
    const {isOwner, currentOwner} = this.resolveSessionOwnership(ownerMeetingId, sessionId);

    if (!isOwner) {
      this.logger.info(
        `llm#setRefreshHandler --> skip write for session ${sessionId}; owned by ${currentOwner}, candidate ${ownerMeetingId}`
      );

      return;
    }

    channel.setRefreshHandler(handler);
  }

  public refreshDataChannelToken(sessionId: string = LLM_DEFAULT_SESSION): Promise<any> {
    const channel = this.getSession(sessionId);

    if (!channel) {
      this.logger.warn(`llm#refreshDataChannelToken --> no channel for session ${sessionId}`);

      return Promise.resolve(null);
    }

    return channel.refreshDataChannelToken();
  }

  public setOwnerMeetingId(
    ownerMeetingId: string | undefined,
    sessionId: string = LLM_DEFAULT_SESSION
  ): void {
    const channel = this.getSession(sessionId);

    if (channel) channel.ownerMeetingId = ownerMeetingId;
  }

  public getOwnerMeetingId(sessionId: string = LLM_DEFAULT_SESSION): string | undefined {
    return this.getSession(sessionId)?.ownerMeetingId;
  }

  public resolveSessionOwnership(
    ownerMeetingId?: string,
    sessionId: string = LLM_DEFAULT_SESSION
  ): {currentOwner: string | undefined; isOwner: boolean} {
    const currentOwner = this.getOwnerMeetingId(sessionId);
    const isOwner = !currentOwner || !ownerMeetingId || currentOwner === ownerMeetingId;

    return {currentOwner, isOwner};
  }

  public getConnectionByDatachannelUrl(url: string): LLMChannel | undefined {
    for (const channel of this.sessions.values()) {
      const datachannelUrl = channel.getDatachannelUrl();

      if (datachannelUrl && LLMChannel.matchesDatachannelRequestUrl(url, datachannelUrl)) {
        return channel;
      }
    }

    return undefined;
  }

  public getLocusUrlByDatachannelUrl(requestUrl: string): string | undefined {
    for (const channel of this.sessions.values()) {
      const datachannelUrl = channel.getDatachannelUrl();

      if (datachannelUrl && LLMChannel.matchesDatachannelRequestUrl(requestUrl, datachannelUrl)) {
        return channel.getLocusUrl();
      }
    }

    return undefined;
  }

  public getSessionIdByDatachannelUrl(requestUrl: string): string | undefined {
    for (const [sessionId, channel] of this.sessions.entries()) {
      const datachannelUrl = channel.getDatachannelUrl();

      if (datachannelUrl && LLMChannel.matchesDatachannelRequestUrl(requestUrl, datachannelUrl)) {
        return sessionId;
      }
    }

    return undefined;
  }

  public isDataChannelTokenEnabled(): Promise<boolean> {
    // @ts-ignore
    return this.webex.internal.feature.getFeature('developer', DATA_CHANNEL_WITH_JWT_TOKEN);
  }

  public getAllConnections(): Map<string, LLMChannel> {
    return new Map(this.sessions);
  }
}

export {config};
export default LLMPlugin;
