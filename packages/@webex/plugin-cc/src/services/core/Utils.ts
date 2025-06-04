import * as Err from './Err';
import {WebexRequestPayload} from '../../types';
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

  return {
    error: new Error(reason ?? `Error while performing ${methodName}`),
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
