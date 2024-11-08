import * as Err from './Err';
import {WebexRequestPayload} from '../../types';

const getCommonErrorDetails = (errObj: WebexRequestPayload) => {
  return {
    trackingId: errObj?.headers?.trackingid || errObj?.headers?.TrackingID,
    msg: errObj?.body,
  };
};

export const createErrDetailsObject = (errObj: WebexRequestPayload) => {
  const details = getCommonErrorDetails(errObj);

  return new Err.Details('Service.reqs.generic.failure', details);
};

export const handleExternalServiceErrorDetails = (errObj: WebexRequestPayload) => {
  const details: {trackingId: string; status?: number} = getCommonErrorDetails(errObj);

  return new Err.Details<any>('Service.reqs.externalService.generic.failure', {
    ...details,
    status: errObj?.statusCode ?? '',
  });
};

export const getCanaryFlagFromSessionStorage = (): boolean => {
  const flag = sessionStorage.getItem('canary');

  return flag === 'true';
};

export const generateUUID = (): string => {
  // let d = DateTime.utc().toMillis();
  let d = Date.now();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (d + Math.random() * 16) % 16 | 0; // eslint-disable-line no-bitwise
    d = Math.floor(d / 16);

    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); // eslint-disable-line no-bitwise
  });
};

export const RETRY_INTERVAL = 200;
export const sleep = (interval: number) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(true), interval);
  });
