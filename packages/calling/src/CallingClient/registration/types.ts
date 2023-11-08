import {IDeviceInfo, RegistrationStatus} from '../../common/types';

export type Header = {
  [key: string]: string;
};

export type restoreRegistrationCallBack = (
  restoreData: IDeviceInfo,
  caller: string
) => Promise<boolean>;

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
  deregister(): void;

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
}
