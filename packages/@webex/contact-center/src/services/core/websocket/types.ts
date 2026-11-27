import type {SubscribeRequest} from '../../../types';
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
  onTerminalFailure: (error: ConnectionRecoveryError) => void;
};

/** Regional policy is opaque to the transport scheduler. */
export type RegionRecoveryOptions = {
  onScheduled: (attempt: number, retryAfterMs: number) => void;
  onAttemptSettled?: (
    attempt: number,
    outcome: 'retrying' | 'terminal',
    failure?: RecoveryFailure
  ) => void;
  afterWelcome: (
    welcome: WelcomeResponse,
    isConnected: () => boolean
  ) => Promise<void | (() => void)>;
};

/** @internal A regional recovery owns its promise and retry count across socket attempts. */
export type RegionRecoveryInvocation = RegionRecoveryOptions & {
  attempt: number;
  resolve: () => void;
  reject: (error: ConnectionRecoveryError) => void;
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
