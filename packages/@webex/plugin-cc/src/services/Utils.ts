import * as Err from './core/Err';
import {WebexRequestPayload} from '../types';
import {WCC_API_GATEWAY} from './constants';

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

export const getRoutingHost = () => {
  return `${WCC_API_GATEWAY}`;
};
