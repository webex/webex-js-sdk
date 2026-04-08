// @ts-ignore - @webex/internal-plugin-mercury does not publish TypeScript declarations
import Mercury from '@webex/internal-plugin-mercury';

export const DEFAULT_MOBIUS_WEBSOCKET_SESSION = 'mobius-websocket-session';

/**
 * Thin Mobius websocket wrapper on top of Mercury.
 *
 * Mercury already handles socket lifecycle details like reconnects, ping/pong and
 * event fan-out, so this class only exposes the basic connect, receive and send APIs.
 */
export default class MobiusWebSocket extends (Mercury as any) {
  private mobiusSessionId = DEFAULT_MOBIUS_WEBSOCKET_SESSION;

  /**
   * Connect to a Mobius websocket URL.
   */
  public async connect(webSocketUrl?: string): Promise<void> {
    return super.connect(webSocketUrl, this.mobiusSessionId);
  }

  /**
   * Disconnect an existing Mobius websocket session.
   */
  public async disconnect(): Promise<void> {
    return super.disconnect(undefined, this.mobiusSessionId);
  }

  /**
   * Send a raw payload over the active Mobius socket.
   */
  public async send(payload: string | Record<string, unknown>): Promise<void> {
    const socket = this.getSocket(this.mobiusSessionId);

    if (!socket || !socket.connected) {
      throw new Error(`Mobius socket is not connected for session ${this.mobiusSessionId}`);
    }

    return socket.send(payload);
  }

  /**
   * Convenience helper for callers that need a simple connection state check.
   */
  public isConnected(): boolean {
    return Boolean(this.getSocket(this.mobiusSessionId)?.connected);
  }
}
