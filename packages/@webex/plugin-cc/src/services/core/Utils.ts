import * as Err from './Err';
import {WebexRequestPayload} from '../../types';
import {Failure} from './GlobalTypes';
import LoggerProxy from '../../logger-proxy';

const getCommonErrorDetails = (errObj: WebexRequestPayload) => {
  return {
    trackingId: errObj?.headers?.trackingid || errObj?.headers?.TrackingID,
    msg: errObj?.body,
  };
};

export const getErrorDetails = (error: any, methodName: string, moduleName: string) => {
  const failure = error.details as Failure;
  const reason = failure?.data?.reason ?? `Error while performing ${methodName}`;
  if (!(reason === 'AGENT_NOT_FOUND' && methodName === 'silentReLogin')) {
    LoggerProxy.error(`${methodName} failed with trackingId: ${failure?.trackingId}`, {
      module: moduleName,
      method: methodName,
    });
  }

  return {
    error: new Error(reason ?? `Error while performing ${methodName}`),
    reason,
  };
};

export const createErrDetailsObject = (errObj: WebexRequestPayload) => {
  const details = getCommonErrorDetails(errObj);

  return new Err.Details('Service.reqs.generic.failure', details);
};
