import {SubscribeRequest} from '../../../types';
import type {WebSocketManager} from './WebSocketManager';
import type {RecoveryFailure} from '../types';
import type {WelcomeResponse} from '../../config/types';

/** Terminal transport outcomes retained for module declarations; absent from the root barrel. */
export type ConnectionRecoveryFailureKind =
  | 'cancelled'
  | 'authentication-failed'
  | 'region-mismatch'
  | 'after-welcome-failed';

/** Safe terminal rejection; never retains a cause, request or URL. */
export type ConnectionRecoveryError = Error & {
  data: RecoveryFailure & {kind: ConnectionRecoveryFailureKind};
};

/** Registration-owned ordinary monitoring options, retained for emitted method signatures. */
export type ConnectionResetOptions = {
  subscribeRequest: SubscribeRequest;
  signal: AbortSignal;
  onTerminalFailure: (error: ConnectionRecoveryError) => void;
  recoverIfDisconnected?: boolean;
};

/** Regional policy is opaque to the transport scheduler. */
export type RegionRecoveryOptions = {
  signal: AbortSignal;
  /** Synchronous owner check at each wait expiry, before transport admission. */
  canAttempt?: () => boolean;
  onScheduled: (attempt: number, retryAfterMs: number) => void;
  onAttemptSettled?: (
    attempt: number,
    outcome: 'retrying' | 'terminal',
    failure?: RecoveryFailure
  ) => void;
  afterWelcome: (welcome: WelcomeResponse, signal: AbortSignal) => Promise<void | (() => void)>;
};

/**
 * Options for initializing a connection service.
 * @typedef ConnectionServiceOptions
 * @property {WebSocketManager} webSocketManager - The WebSocket manager instance.
 * @property {SubscribeRequest} subscribeRequest - The subscribe request payload.
 * @ignore
 */
export type ConnectionServiceOptions = {
  webSocketManager: WebSocketManager;
  subscribeRequest: SubscribeRequest;
};

/**
 * Details about the state of a lost connection and recovery attempts.
 * @typedef ConnectionLostDetails
 * @property {boolean} isConnectionLost - Indicates if the connection is currently lost.
 * @property {boolean} isRestoreFailed - Indicates if restoring the connection has failed.
 * @property {boolean} isSocketReconnected - Indicates if the socket has been reconnected.
 * @property {boolean} isKeepAlive - Indicates if the keep-alive mechanism is active.
 * @ignore
 */
export type ConnectionLostDetails = {
  isConnectionLost: boolean;
  isRestoreFailed: boolean;
  isSocketReconnected: boolean;
  isKeepAlive: boolean;
};
