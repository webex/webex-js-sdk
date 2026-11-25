import EventEmitter from 'events';
import {HTTP_METHODS} from '../../../types';
import type {WebexSDK, SubscribeRequest} from '../../../types';
import {WCC_API_GATEWAY, SUBSCRIBE_API} from '../../constants';
import type {ConnectionLostDetails} from './types';
import {CC_EVENTS, SYSTEM_EVENTS} from '../../config/types';
import type {SubscribeResponse, WelcomeResponse} from '../../config/types';
import LoggerProxy from '../../../logger-proxy';
import workerScript from './keepalive.worker';
import {
  KEEPALIVE_WORKER_INTERVAL,
  CLOSE_SOCKET_TIMEOUT,
  TIMEOUT_REQ,
  WELCOME_TIMEOUT,
  METHODS,
  ALLOWED_ROUTING_NOTIFS_DOMAINS,
  REFERENCE_SERVING_REGIONS,
} from '../constants';
import {WEB_SOCKET_MANAGER_FILE} from '../../../constants';
import {
  createRegionRecoveryError,
  isAllowedUrlHost,
  isRecord,
  normalizeRecoveryFailure,
} from '../Utils';

/** Placement parsing is independent of socket URL authorization. @internal */
export const parseServingRegion = (webSocketUrl: string): string | undefined => {
  try {
    const labels = new URL(webSocketUrl).hostname.toLowerCase().split('.');

    return REFERENCE_SERVING_REGIONS.find((region) => labels.includes(region));
  } catch {
    return undefined;
  }
};

type SocketAttempt = {
  resource: string;
  signal?: AbortSignal;
  onAbort: () => void;
  socket?: WebSocket;
  worker?: Worker;
  workerUrl?: string;
  url?: string;
  accepted: boolean;
  timer?: ReturnType<typeof setTimeout>;
  resolve: (welcome: WelcomeResponse) => void;
  reject: (error: unknown) => void;
};

/** Owns one admitted socket and every resource associated with its lifetime. @ignore */
export class WebSocketManager extends EventEmitter {
  public shouldReconnect = true;
  private isConnectionLost = false;
  private attempt?: SocketAttempt;
  private servingRegion?: string;
  private webex: WebexSDK;

  constructor(options: {webex: WebexSDK}) {
    super();
    this.webex = options.webex;
  }

  public initWebSocket(options: {
    body: SubscribeRequest;
    resource: string;
    signal?: AbortSignal;
  }): Promise<WelcomeResponse> {
    if (options.signal?.aborted) {
      return Promise.reject(createRegionRecoveryError('RECOVERY_INTERRUPTED'));
    }
    const previous = this.attempt;
    if (previous) this.disposeAttempt(previous, createRegionRecoveryError('RECOVERY_INTERRUPTED'));
    this.clearServingRegion();
    this.shouldReconnect = true;

    return new Promise((resolve, reject) => {
      const attempt: SocketAttempt = {
        resource: options.resource,
        signal: options.signal,
        accepted: false,
        resolve,
        reject,
        onAbort: () =>
          this.disposeAttempt(attempt, createRegionRecoveryError('RECOVERY_INTERRUPTED')),
      };
      this.attempt = attempt;
      attempt.signal?.addEventListener('abort', attempt.onAbort, {once: true});
      attempt.timer = setTimeout(
        () => this.disposeAttempt(attempt, new Error('Subscribe deadline exceeded')),
        TIMEOUT_REQ
      );
      if (attempt.signal?.aborted) {
        attempt.onAbort();

        return;
      }
      // Retain both continuations after cancellation: late HTTP cannot install a socket.
      this.register(options.body, attempt).then(
        () => {
          if (!this.ownsAttempt(attempt)) return;
          clearTimeout(attempt.timer);
          attempt.timer = setTimeout(
            () => this.disposeAttempt(attempt, new Error('Welcome deadline exceeded')),
            WELCOME_TIMEOUT
          );
          try {
            this.connect(attempt);
          } catch (error) {
            this.disposeAttempt(attempt, error);
          }
        },
        (error) => this.disposeAttempt(attempt, error)
      );
    });
  }

  public cancelPending(error: Error): void {
    const attempt = this.attempt;
    if (attempt && !attempt.accepted) this.disposeAttempt(attempt, error);
  }

  public getServingRegion(): string | undefined {
    return this.servingRegion;
  }

  public clearServingRegion(): void {
    this.servingRegion = undefined;
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

  public close(shouldReconnect: boolean, reason = 'Unknown'): void {
    this.shouldReconnect = shouldReconnect;
    this.clearServingRegion();
    const attempt = this.attempt;
    if (!attempt) return;
    this.disposeAttempt(attempt, createRegionRecoveryError('RECOVERY_INTERRUPTED'));
    this.notifySocketClose(shouldReconnect);
    if (reason) WebSocketManager.diagnose('WebSocket connection closed', METHODS.CLOSE);
  }

  public handleConnectionLost(event: ConnectionLostDetails): void {
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

  private async register(
    connectionConfig: SubscribeRequest,
    attempt: SocketAttempt
  ): Promise<void> {
    const isIntEnv = this.webex.internal?.services?.isIntegrationEnvironment() || false;
    const orgId = this.webex.credentials.getOrgId();
    const response: SubscribeResponse = await this.webex.request({
      service: WCC_API_GATEWAY,
      resource: attempt.resource,
      method: HTTP_METHODS.POST,
      body: connectionConfig,
      headers: isIntEnv && orgId ? {'X-ORGANIZATION-ID': orgId} : undefined,
      timeout: TIMEOUT_REQ,
    });
    if (!this.ownsAttempt(attempt)) return;
    const failure = normalizeRecoveryFailure(response);
    if (failure.status !== undefined && (failure.status < 200 || failure.status >= 300)) {
      throw response;
    }
    const url = response.body?.webSocketUrl;
    let isWss = false;
    try {
      isWss = new URL(url).protocol === 'wss:';
    } catch {
      isWss = false;
    }
    if (!isWss || !isAllowedUrlHost(url, ALLOWED_ROUTING_NOTIFS_DOMAINS)) {
      throw new Error(
        'Rejected webSocketUrl from RoutingNotifs registration: scheme or host not allow-listed'
      );
    }
    attempt.url = url;
  }

  private connect(attempt: SocketAttempt): void {
    if (!this.ownsAttempt(attempt) || !attempt.url) return;
    const socket = new WebSocket(attempt.url);
    attempt.socket = socket;
    socket.onopen = () => {
      if (!this.ownsAttempt(attempt) || attempt.worker) return;
      try {
        socket.send(JSON.stringify({keepalive: 'true'}));
        const blob = new Blob([workerScript], {type: 'application/javascript'});
        attempt.workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(attempt.workerUrl);
        attempt.worker = worker;
        worker.onmessage = (event: MessageEvent) => {
          if (!this.ownsAttempt(attempt)) return;
          if (event.data?.type === 'keepalive' && socket.readyState === 1)
            socket.send(JSON.stringify({keepalive: 'true'}));
          if (event.data?.type === 'closeSocket' && this.isConnectionLost) {
            this.close(true, 'WebSocket did not auto close within 16 secs');
          }
        };
        worker.postMessage({
          type: 'start',
          intervalDuration: KEEPALIVE_WORKER_INTERVAL,
          isSocketClosed: false,
          closeSocketTimeout: CLOSE_SOCKET_TIMEOUT,
        });
      } catch (error) {
        const admitted = attempt.accepted;
        this.disposeAttempt(attempt, error);
        if (admitted) this.notifySocketClose(this.shouldReconnect);
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
        if (attempt.accepted) this.deliverMessage(event.data);

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
        if (attempt.resource === SUBSCRIBE_API)
          this.servingRegion = parseServingRegion(attempt.url);
        attempt.resolve(messageData as WelcomeResponse);
      }
      if (messageType === CC_EVENTS.AGENT_MULTI_LOGIN) {
        // Capture and close the receiving owner before observers can replace it.
        this.shouldReconnect = false;
        this.disposeAttempt(attempt, createRegionRecoveryError('RECOVERY_INTERRUPTED'));
        this.notifySocketClose(false);
      } else if (!attempt.accepted && messageType !== SYSTEM_EVENTS.SYSTEM_REGION_SWITCH) {
        return;
      }
      this.deliverMessage(event.data);
    };
  }

  /** Node snapshot and once-wrapper semantics with isolation for internal consumers. */
  private deliverMessage(payload: string): void {
    this.rawListeners('message').forEach((listener) => {
      try {
        listener.call(this, payload);
      } catch {
        WebSocketManager.diagnose('WebSocket message consumer failed', METHODS.DELIVER_MESSAGE);
      }
    });
  }

  private notifySocketClose(shouldReconnect: boolean): void {
    try {
      this.emit('socketClose', {shouldReconnect});
    } catch {
      WebSocketManager.diagnose(
        'WebSocket close consumer failed',
        METHODS.WEB_SOCKET_ON_CLOSE_HANDLER
      );
    }
  }

  private webSocketOnCloseHandler(attempt: SocketAttempt, error: Error): void {
    if (this.attempt !== attempt) return;
    const reconnect = this.shouldReconnect;
    const admitted = attempt.accepted;
    this.disposeAttempt(attempt, error, false);
    if (admitted) this.notifySocketClose(reconnect);
  }

  /** Invalidate ownership before releasing any resource or invoking rejection callbacks. */
  private disposeAttempt(attempt: SocketAttempt, error: unknown, closeSocket = true): void {
    if (this.attempt !== attempt) return;
    this.attempt = undefined;
    this.clearServingRegion();
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
        attempt.worker.postMessage({type: 'terminate'});
      } catch {
        WebSocketManager.diagnose('Worker stop failed', METHODS.DISPOSE_ATTEMPT);
      }
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
