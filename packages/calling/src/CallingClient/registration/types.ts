import {IDeviceInfo, MobiusStatus} from '../../common/types';

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
   * @returns A promise that resolves when registration is complete.
   */
  triggerRegistration(): Promise<void>;

  /**
   * Checks if the device is currently registered.
   *
   * @returns `true` if the device is registered; otherwise, `false`.
   */
  isDeviceRegistered(): boolean;

  /**
   * Sets the status of the registration.
   *
   * @param value - The registration status to set.
   */
  setStatus(value: MobiusStatus): void;

  /**
   * Retrieves the current registration status.
   *
   * @returns The current registration status.
   */
  getStatus(): MobiusStatus;

  /**
   * Retrieves information about the device as {@link IDeviceInfo}.
   *
   * @returns Information about the device.
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
   * @returns The active Mobius server URL.
   */
  getActiveMobiusUrl(): string;

  /**
   * Attempts to reconnect after a connection failure.
   *
   * @param caller - The caller's identifier for reconnection.
   * @returns A promise that resolves when reconnection is successful.
   */
  reconnectOnFailure(caller: string): Promise<void>;

  /**
   * Checks if a reconnection attempt is pending.
   *
   * @returns `true` if a reconnection attempt is pending; otherwise, `false`.
   */
  isReconnectPending(): boolean;

  /**
   * Handles connection restoration, optionally triggering a retry.
   *
   * @param retry - Set to `true` to trigger a retry after restoration.
   * @returns A promise that resolves to `true` if the connection is restored, or `false` if it fails.
   */
  handleConnectionRestoration(retry: boolean): Promise<boolean>;
}
