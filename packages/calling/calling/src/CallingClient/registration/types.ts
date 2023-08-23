import {IDeviceInfo, MobiusStatus} from '../../common/types';

export type Header = {
  [key: string]: string;
};

export type restoreRegistrationCallBack = (
  restoreData: IDeviceInfo,
  caller: string
) => Promise<boolean>;

export interface IRegistration {
  setMobiusServers: (primaryMobiusUris: string[], backupMobiusUris: string[]) => void;
  triggerRegistration: () => Promise<void>;
  isDeviceRegistered: () => boolean;
  setStatus: (value: MobiusStatus) => void;
  getStatus: () => MobiusStatus;
  getDeviceInfo: () => IDeviceInfo;
  startKeepaliveTimer: (url: string, interval: number) => void;
  clearKeepaliveTimer: () => void;
  deregister: () => void;
  setActiveMobiusUrl: (url: string) => void;
  getActiveMobiusUrl: () => string;
  reconnectOnFailure: (caller: string) => Promise<void>;
  isReconnectPending: () => boolean;
  handleConnectionRestoration: (retry: boolean) => Promise<boolean>;
}
