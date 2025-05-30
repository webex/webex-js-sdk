import * as Err from './Err';
import {WebexRequestPayload} from '../../types';
import {Failure} from './GlobalTypes';
import LoggerProxy from '../../logger-proxy';
import WebexRequest from './WebexRequest';

const getCommonErrorDetails = (errObj: WebexRequestPayload) => {
  return {
    trackingId: errObj?.headers?.trackingid || errObj?.headers?.TrackingID,
    msg: errObj?.body,
  };
};

export const isValidDialNumber = (input: string): boolean => {
  // This regex checks for a valid dial number format for only few countries such as US, Canada.
  const regexForDn = /1[0-9]{3}[2-9][0-9]{6}([,]{1,10}[0-9]+){0,1}/;

  return regexForDn.test(input);
};

export const getStationLoginErrorDetails = (failure: Failure) => {
  const errorCodeMessageMap = {
    DUPLICATE_LOCATION: {
      message: 'This extension is already in use',
      fieldName: 'input',
    },
    INVALID_DIAL_NUMBER: {
      message:
        'Enter a valid US dial number. For help, reach out to your administrator or support team.',
      fieldName: 'input',
    },
  };

  const defaultMessage = 'An error occurred while logging in to the station';
  const defaultFieldName = 'generic';

  const reason = failure?.data?.reason || '';

  return {
    message: errorCodeMessageMap[reason]?.message || defaultMessage,
    fieldName: errorCodeMessageMap[reason]?.fieldName || defaultFieldName,
  };
};

export const getErrorDetails = (error: any, methodName: string, moduleName: string) => {
  let moreDetails = {};

  const failure = error.details as Failure;
  const reason = failure?.data?.reason ?? `Error while performing ${methodName}`;

  if (!(reason === 'AGENT_NOT_FOUND' && methodName === 'silentReLogin')) {
    LoggerProxy.error(`${methodName} failed with reason: ${reason}`, {
      module: moduleName,
      method: methodName,
      trackingId: failure?.trackingId,
    });
    // we can add more conditions here if not needed for specific cases eg: silentReLogin
    WebexRequest.getInstance().uploadLogs({
      correlationId: failure?.trackingId,
    });
  }

  if (methodName === 'stationLogin') {
    moreDetails = getStationLoginErrorDetails(failure);
  }

  return {
    error: new Error(reason ?? `Error while performing ${methodName}`),
    reason,
    moreDetails,
  };
};

export const createErrDetailsObject = (errObj: WebexRequestPayload) => {
  const details = getCommonErrorDetails(errObj);

  return new Err.Details('Service.reqs.generic.failure', details);
};
