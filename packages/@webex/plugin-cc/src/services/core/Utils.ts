import * as Err from './Err';
import {LoginOption, WebexRequestPayload} from '../../types';
import {Failure} from './GlobalTypes';
import LoggerProxy from '../../logger-proxy';
import WebexRequest from './WebexRequest';

/**
 * Extracts common error details from a Webex request payload.
 *
 * @param errObj - The Webex request payload object.
 * @returns An object containing the tracking ID and message body.
 * @private
 * @ignore
 */
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

export const getStationLoginErrorData = (failure: Failure, loginOption: LoginOption) => {
  let duplicateLocationMessage = 'This value is already in use';

  if (loginOption === LoginOption.EXTENSION) {
    duplicateLocationMessage = 'This extension is already in use';
  }

  if (loginOption === LoginOption.AGENT_DN) {
    duplicateLocationMessage =
      'Dial number is in use. Try a different one. For help, reach out to your administrator or support team.';
  }

  const errorCodeMessageMap = {
    DUPLICATE_LOCATION: {
      message: duplicateLocationMessage,
      fieldName: loginOption,
    },
    INVALID_DIAL_NUMBER: {
      message:
        'Enter a valid US dial number. For help, reach out to your administrator or support team.',
      fieldName: loginOption,
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

/**
 * Extracts error details and logs the error. Also uploads logs for the error unless it is a silent relogin agent not found error.
 *
 * @param error - The error object, expected to have a `details` property of type Failure.
 * @param methodName - The name of the method where the error occurred.
 * @param moduleName - The name of the module where the error occurred.
 * @returns An object containing the error instance and the reason string.
 * @public
 * @example
 * const details = getErrorDetails(error, 'fetchData', 'DataModule');
 * if (details.error) { handleError(details.error); }
 * @ignore
 */
export const getErrorDetails = (error: any, methodName: string, moduleName: string) => {
  let errData = {message: '', fieldName: ''};

  const failure = error.details as Failure;
  const reason = failure?.data?.reason ?? `Error while performing ${methodName}`;

  if (!(reason === 'AGENT_NOT_FOUND' && methodName === 'silentRelogin')) {
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
    errData = getStationLoginErrorData(failure, error.loginOption);

    LoggerProxy.error(
      `${methodName} failed with reason: ${reason}, message: ${errData.message}, fieldName: ${errData.fieldName}`,
      {
        module: moduleName,
        method: methodName,
        trackingId: failure?.trackingId,
      }
    );
  }

  const err = new Error(reason ?? `Error while performing ${methodName}`);
  // @ts-ignore - add custom property to the error object for backward compatibility
  err.data = errData;

  return {
    error: err,
    reason,
  };
};

/**
 * Creates an error details object suitable for use with the Err.Details class.
 *
 * @param errObj - The Webex request payload object.
 * @returns An instance of Err.Details with the generic failure message and extracted details.
 * @public
 * @example
 * const errDetails = createErrDetailsObject(webexRequestPayload);
 * @ignore
 */
export const createErrDetailsObject = (errObj: WebexRequestPayload) => {
  const details = getCommonErrorDetails(errObj);

  return new Err.Details('Service.reqs.generic.failure', details);
};
