import EventEmitter from 'events';
import type {ConnectionLostDetails} from './types';
import {CC_EVENTS} from '../../config/types';
import type {WelcomeResponse} from '../../config/types';
import LoggerProxy from '../../../logger-proxy';
import workerScript from './keepalive.worker';
import {
  KEEPALIVE_WORKER_INTERVAL,
  CLOSE_SOCKET_TIMEOUT,
  WELCOME_TIMEOUT,
  METHODS,
  ALLOWED_ROUTING_NOTIFS_DOMAINS,
} from '../constants';
import {WEB_SOCKET_MANAGER_FILE} from '../../../constants';
import {isAllowedUrlHost, isRecord} from '../Utils';

const interrupted = (): Error =>
  Object.assign(new Error('WebSocket connection interrupted'), {name: 'AbortError'});

type SocketAttempt = {
  signal?: AbortSignal;
  onAbort: () => void;
  socket?: WebSocket;
  worker?: Worker;
  workerUrl?: string;
  accepted: boolean;
  timer?: ReturnType<typeof setTimeout>;
  resolve: (welcome: WelcomeResponse) => void;
  reject: (error: unknown) => void;
};

/**
 * WebSocketManager handles the WebSocket connection for Contact Center operations.
 * It connects the supplied URL and handles socket lifecycle and message delivery.
 * It also utilizes a Web Worker to manage keepalive messages and socket closure.
 * @ignore
 */
export class WebSocketManager extends EventEmitter {
  public shouldReconnect = true;
  private isConnectionLost = false;
  private attempt?: SocketAttempt;
  initWebSocket(options: {url: string; signal?: AbortSignal}): Promise<WelcomeResponse> {
    if (options.signal?.aborted) {
      return Promise.reject(interrupted());
    }

    let secure = false;
    try {
      secure = new URL(options.url).protocol === 'wss:';
    } catch {
      secure = false;
    }
    if (!secure || !isAllowedUrlHost(options.url, ALLOWED_ROUTING_NOTIFS_DOMAINS)) {
      return Promise.reject(new Error('Rejected WebSocket URL: scheme or host not allow-listed'));
    }

    const previous = this.attempt;
    if (previous) this.disposeAttempt(previous, interrupted());
    this.shouldReconnect = true;

    return new Promise((resolve, reject) => {
      const attempt: SocketAttempt = {
        signal: options.signal,
        accepted: false,
        resolve,
        reject,
        onAbort: () => this.disposeAttempt(attempt, interrupted()),
      };
      this.attempt = attempt;
      attempt.signal?.addEventListener('abort', attempt.onAbort, {once: true});
      attempt.timer = setTimeout(
        () => this.disposeAttempt(attempt, new Error('Welcome deadline exceeded')),
        WELCOME_TIMEOUT
      );
      try {
        this.connect(attempt, options.url);
      } catch (error) {
        this.disposeAttempt(attempt, error);
      }
    });
  }

  public hasUsableSocket(): boolean {
    const attempt = this.attempt;

    return !!(
      attempt &&
      this.ownsAttempt(attempt) &&
      attempt.accepted &&
      attempt.socket?.readyState === 1
    );
  }

  close(shouldReconnect: boolean, reason = 'Unknown'): void {
    this.shouldReconnect = shouldReconnect;
    const attempt = this.attempt;
    if (!attempt) return;
    this.disposeAttempt(attempt, interrupted());
    this.emit('socketClose', {shouldReconnect});
    if (reason) WebSocketManager.diagnose('WebSocket connection closed', METHODS.CLOSE);
  }

  handleConnectionLost(event: ConnectionLostDetails): void {
    this.isConnectionLost = event.isConnectionLost;
  }

  private ownsAttempt(attempt: SocketAttempt): boolean {
    return this.attempt === attempt && !attempt.signal?.aborted;
  }

  /** Diagnostics never own admission, disposal or message delivery. */
  private static diagnose(message: string, method: string): void {
    try {
      LoggerProxy.log(message, {module: WEB_SOCKET_MANAGER_FILE, method});
    } catch {
      // An unavailable diagnostic sink cannot change transport progress.
    }
  }

  private connect(attempt: SocketAttempt, url: string): void {
    const socket = new WebSocket(url);
    attempt.socket = socket;
    socket.onopen = () => {
      if (!this.ownsAttempt(attempt) || attempt.worker) return;
      try {
        socket.send(JSON.stringify({keepalive: 'true'}));
        const workerScriptBlob = new Blob([workerScript], {type: 'application/javascript'});
        attempt.workerUrl = URL.createObjectURL(workerScriptBlob);
        const worker = new Worker(attempt.workerUrl);
        attempt.worker = worker;
        worker.onmessage = (keepAliveEvent: MessageEvent) => {
          if (!this.ownsAttempt(attempt)) return;
          if (keepAliveEvent?.data?.type === 'keepalive' && socket.readyState === 1)
            socket.send(JSON.stringify({keepalive: 'true'}));
          if (
            keepAliveEvent?.data?.type === 'closeSocket' &&
            this.isConnectionLost &&
            this.shouldReconnect
          ) {
            this.close(true, 'WebSocket did not auto close within 16 secs');
          }
        };
        worker.postMessage({
          type: 'start',
          intervalDuration: KEEPALIVE_WORKER_INTERVAL, // Keepalive interval
          isSocketClosed: false,
          closeSocketTimeout: CLOSE_SOCKET_TIMEOUT, // Close socket timeout
        });
      } catch (error) {
        this.disposeAttempt(attempt, error);
      }
    };
    socket.onerror = () =>
      this.webSocketOnCloseHandler(attempt, new Error('WebSocket connection failed'));
    socket.onclose = () => this.webSocketOnCloseHandler(attempt, new Error('WebSocket closed'));
    socket.onmessage = (event: MessageEvent) => {
      if (!this.ownsAttempt(attempt)) return;
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        if (attempt.accepted) this.emit('message', event.data);

        return;
      }
      const frame = isRecord(data) ? data : undefined;
      const messageType = frame?.type;
      const messageData = frame?.data;
      if (
        messageType === CC_EVENTS.WELCOME &&
        !attempt.accepted &&
        isRecord(messageData) &&
        !Array.isArray(messageData)
      ) {
        attempt.accepted = true;
        clearTimeout(attempt.timer);
        attempt.resolve(messageData as WelcomeResponse);
      }
      if (messageType === CC_EVENTS.AGENT_MULTI_LOGIN) {
        // Capture and close the receiving owner before observers can replace it.
        this.shouldReconnect = false;
        this.disposeAttempt(attempt, interrupted());
        this.emit('socketClose', {shouldReconnect: false});
      } else if (!attempt.accepted) {
        return;
      }
      this.emit('message', event.data);
    };
  }

  private webSocketOnCloseHandler(attempt: SocketAttempt, error: Error): void {
    if (this.attempt !== attempt) return;
    const reconnect = this.shouldReconnect;
    const admitted = attempt.accepted;
    this.disposeAttempt(attempt, error, false);
    if (admitted) this.emit('socketClose', {shouldReconnect: reconnect});
  }

  /** Invalidate ownership before releasing any resource or invoking rejection callbacks. */
  private disposeAttempt(attempt: SocketAttempt, error: unknown, closeSocket = true): void {
    if (this.attempt !== attempt) return;
    this.attempt = undefined;
    clearTimeout(attempt.timer);
    attempt.signal?.removeEventListener('abort', attempt.onAbort);
    if (!attempt.accepted) attempt.reject(error);
    if (attempt.socket) {
      attempt.socket.onopen = null;
      attempt.socket.onmessage = null;
      attempt.socket.onerror = null;
      attempt.socket.onclose = null;
      if (closeSocket) {
        try {
          attempt.socket.close();
        } catch {
          WebSocketManager.diagnose('Socket disposal failed', METHODS.DISPOSE_ATTEMPT);
        }
      }
    }
    if (attempt.worker) {
      attempt.worker.onmessage = null;
      try {
        attempt.worker.terminate();
      } catch {
        WebSocketManager.diagnose('Worker disposal failed', METHODS.DISPOSE_ATTEMPT);
      }
    }
    if (attempt.workerUrl) {
      try {
        URL.revokeObjectURL(attempt.workerUrl);
      } catch {
        WebSocketManager.diagnose('Worker URL disposal failed', METHODS.DISPOSE_ATTEMPT);
      }
    }
  }
}

export default WebSocketManager;
