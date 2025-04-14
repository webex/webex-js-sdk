import * as Err from './Err';
import {LogsMetaData, WebexRequestPayload} from '../../types';
import {Failure} from './GlobalTypes';
import LoggerProxy from '../../logger-proxy';
import MetricsManager from '../../metrics/MetricsManager';
import WebexRequest from './WebexRequest';
import {METRIC_EVENT_NAMES} from '../../metrics/constants';
import {UTILS_FILE} from '../../constants';

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

export const uploadLogs = async (metadata: LogsMetaData) => {
  try {
    const response = await WebexRequest.getInstance().uploadLogs(metadata);
    LoggerProxy.info(`Logs uploaded successfully`, {
      module: UTILS_FILE,
      method: uploadLogs.name,
    });

    MetricsManager.getInstance().trackEvent(
      METRIC_EVENT_NAMES.UPLOAD_LOGS_SUCCESS,
      {
        trackingId: response?.trackingid,
        feedbackId: metadata.feedbackId,
      },
      ['behavioral']
    );

    return {...response, feedbackId: metadata.feedbackId};
  } catch (error) {
    LoggerProxy.error(`Error uploading logs: ${error}`, {
      module: UTILS_FILE,
      method: uploadLogs.name,
    });

    MetricsManager.getInstance().trackEvent(
      METRIC_EVENT_NAMES.UPLOAD_LOGS_FAILED,
      {
        stack: error?.stack?.toString(),
      },
      ['behavioral']
    );
    throw error;
  }
};
