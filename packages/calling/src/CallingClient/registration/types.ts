import {Devices, IDeviceInfo, RegistrationStatus} from '../../common/types';
import {LineError} from '../../Errors/catalog/LineError';
import {MobiusAsyncEvent} from '../calling/types';

export type Header = {
  [key: string]: string;
};

/**
 * Reason a registration is torn down without any re-registration attempt.
 * The values double as the label used in hard-stop log messages.
 */
export enum HARD_STOP_REASON {
  REGISTRATION_DOWN = 'registration-down',
  SESSION_SUPERSEDED = 'session-superseded',
}

/**
 * Describes a hard stop of the registration. A superseded session must carry the
 * {@link LineError} that is handed to the SDK consumer as the reason on
 * `LINE_EVENTS.UNREGISTERED`; a registration-down stop carries no reason.
 */
export type HardStop =
  | {reason: HARD_STOP_REASON.REGISTRATION_DOWN; error?: undefined}
  | {reason: HARD_STOP_REASON.SESSION_SUPERSEDED; error: LineError};

export type restoreRegistrationCallBack = (
  restoreData: IDeviceInfo,
  caller: string
) => Promise<boolean>;

export type retry429CallBack = (retryAfter: number, caller: string) => Promise<void>;

export type sessionSupersededCallBack = (clientError: LineError) => Promise<void>;

/**
 * Specialized handlers a caller of `handleRegistrationErrors` opts into. A flow only
 * passes the handlers for the status codes it can act on, which is what keeps handling
 * such as the `409` session-superseded hard stop scoped to the keepalive flow.
 */
export type RegistrationErrorHandlers = {
  /** Invoked on `429` so the caller can reschedule its own flow after `Retry-After`. */
  retry429Cb?: retry429CallBack;
  /** Invoked on `403` device-limit so the caller can restore the existing registration. */
  restoreRegCb?: restoreRegistrationCallBack;
  /** Invoked on `409` so the caller can hard stop a superseded calling session. */
  sessionSupersededCb?: sessionSupersededCallBack;
};

/**
 * Outcome of `handleRegistrationErrors`.
 */
export type RegistrationErrorResult = {
  /** The error is terminal — the caller must not retry. */
  finalError: boolean;
  /** The Mobius WebSocket of the failed server must be torn down before moving on. */
  shouldDisconnect: boolean;
};

export type FailoverCacheState = {
  attempt: number;
  timeElapsed: number;
  retryScheduledTime: number;
  serverType: 'primary' | 'backup';
};

/**
 * Represents an interface for managing registration-related operations.
 */
export interface IRegistration {
  /**
   * Sets the primary and backup Mobius server URLs.
   *
   * @param primaryMobiusUris - An array of primary Mobius server URLs.
   * @param backupMobiusUris - An array of backup Mobius server URLs.
   */
  setMobiusServers(primaryMobiusUris: string[], backupMobiusUris: string[]): void;

  /**
   * Triggers the registration process with the given list of servers
   * Registration is attempted with primary and backup until it succeeds or the list is exhausted
   */
  triggerRegistration(): Promise<void>;

  /**
   * Checks if the device is currently registered.
   *
   */
  isDeviceRegistered(): boolean;

  /**
   * Sets the status of the registration.
   *
   * @param value - The registration status to set.
   */
  setStatus(value: RegistrationStatus): void;

  /**
   * Retrieves the current registration status.
   *
   */
  getStatus(): RegistrationStatus;

  /**
   * Retrieves information about the device as {@link IDeviceInfo}.
   *
   */
  getDeviceInfo(): IDeviceInfo;

  /**
   * Clears the keep-alive timer used for registration.
   */
  clearKeepaliveTimer(): void;

  /**
   * Deregisters the device.
   */
  deregister(closeMobiusWss: boolean): void;

  /**
   * Sets the active Mobius server URL to use for registration.
   *
   * @param url - The Mobius server URL to set as active.
   */
  setActiveMobiusUrl(url: string): void;

  /**
   * Retrieves the active Mobius server URL.
   *
   */
  getActiveMobiusUrl(): string;

  /**
   * Attempts to reconnect after a connection failure.
   *
   * @param caller - The caller's identifier for reconnection.
   */
  reconnectOnFailure(caller: string): Promise<void>;

  /**
   * Checks if a reconnection attempt is pending.
   *
   */
  isReconnectPending(): boolean;

  /**
   * Restores the connection and attempts refreshing existing registration with server.
   * Allows retry if not restored in the first attempt.
   *
   * @param retry - Set to `true` to trigger a retry after restoration.
   */
  handleConnectionRestoration(retry: boolean): Promise<boolean>;

  /**
   * Populate deviceInfo from a devices response (e.g., getDevices API).
   */
  setDeviceInfo(body: Devices): void;

  /**
   * Handles a Mobius REGISTRATION_DOWN async event. Ends the first active
   * call (if any) and runs registration-side cleanup.
   *
   * @param event - The Mobius async event payload (optional).
   */
  handleRegistrationDownEvent(event?: MobiusAsyncEvent): Promise<void>;
}
