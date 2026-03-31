// @ts-ignore - @webex/internal-plugin-mercury does not publish TypeScript declarations
import Mercury from '@webex/internal-plugin-mercury';

export type MobiusEnvelope<T = unknown> = {
  id?: string;
  data?: T;
  headers?: Record<string, unknown>;
  trackingId?: string;
  timestamp?: number;
  type?: string;
  sessionId?: string;
};

export type MobiusEventListener<T = unknown> = (event: MobiusEnvelope<T>) => void;

export type MobiusMessagePayload = string | Record<string, unknown>;

export const DEFAULT_MOBIUS_WEBSOCKET_SESSION = 'mobius-websocket-session';

/**
 * Thin Mobius websocket wrapper on top of Mercury.
 *
 * Mercury already handles socket lifecycle details like reconnects, ping/pong and
 * event fan-out, so this class only exposes the basic connect, receive and send APIs.
 */
export default class MobiusWebSocket extends (Mercury as any) {
  namespace = 'Mercury';

  defaultSessionId = DEFAULT_MOBIUS_WEBSOCKET_SESSION;

  /**
   * Connect to a Mobius websocket URL.
   */
  public async connectToMobius(
    webSocketUrl?: string,
    sessionId = this.defaultSessionId
  ): Promise<void> {
    return this.connect(webSocketUrl, sessionId);
  }

  /**
   * Disconnect an existing Mobius websocket session.
   */
  public async disconnectFromMobius(sessionId = this.defaultSessionId): Promise<void> {
    return this.disconnect(undefined, sessionId);
  }

  /**
   * Subscribe to all Mercury events received on the socket.
   */
  public onMobiusEvent<T = unknown>(
    listener: MobiusEventListener<T>,
    sessionId = this.defaultSessionId
  ): void {
    this.on(this.getScopedEventName('event', sessionId), listener);
  }

  /**
   * Unsubscribe from the generic Mercury event stream.
   */
  public offMobiusEvent<T = unknown>(
    listener: MobiusEventListener<T>,
    sessionId = this.defaultSessionId
  ): void {
    this.off(this.getScopedEventName('event', sessionId), listener);
  }

  /**
   * Subscribe to a specific Mercury event type, for example `mobius.call`.
   */
  public onEventType<T = unknown>(
    eventType: string,
    listener: MobiusEventListener<T>,
    sessionId = this.defaultSessionId
  ): void {
    this.on(this.getScopedEventName(`event:${eventType}`, sessionId), listener);
  }

  /**
   * Unsubscribe from a specific Mercury event type.
   */
  public offEventType<T = unknown>(
    eventType: string,
    listener: MobiusEventListener<T>,
    sessionId = this.defaultSessionId
  ): void {
    this.off(this.getScopedEventName(`event:${eventType}`, sessionId), listener);
  }

  /**
   * Send a raw payload over the active Mobius socket.
   */
  public async sendEvent(
    payload: MobiusMessagePayload,
    sessionId = this.defaultSessionId
  ): Promise<void> {
    const socket = this.getSocket(sessionId);

    if (!socket || !socket.connected) {
      throw new Error(`Mobius socket is not connected for session ${sessionId}`);
    }

    return socket.send(payload);
  }

  /**
   * Convenience helper for callers that need a simple connection state check.
   */
  public isConnected(sessionId = this.defaultSessionId): boolean {
    return Boolean(this.getSocket(sessionId)?.connected);
  }

  private getScopedEventName(eventName: string, sessionId = this.defaultSessionId): string {
    return sessionId === this.defaultSessionId ? eventName : `${eventName}:${sessionId}`;
  }
}
