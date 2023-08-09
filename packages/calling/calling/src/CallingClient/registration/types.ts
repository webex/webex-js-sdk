import {METRIC_EVENT, METRIC_TYPE, REG_ACTION} from '../metrics/types';
import {IDeviceInfo, MobiusStatus} from '../../common/types';
import {LineError} from '../../Errors/catalog/LineError';

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
  sendMetric: (
    name: METRIC_EVENT,
    action: REG_ACTION,
    metric: METRIC_TYPE,
    error?: LineError
  ) => void;
  setActiveMobiusUrl: (url: string) => void;
  getActiveMobiusUrl: () => string;
  reconnectOnFailure: (caller: string) => Promise<void>;
  isReconnectPending: () => boolean;
  handleConnectionRestoration: (retry: boolean) => Promise<boolean>;
}
