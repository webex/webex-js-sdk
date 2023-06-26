/* eslint-disable no-fallthrough */
/* eslint-disable no-underscore-dangle */
/* eslint-disable valid-jsdoc */
/* eslint-disable @typescript-eslint/no-shadow */
import * as platform from 'platform';
import {restoreRegistrationCallBack} from 'CallingClient/registration/types';
import {CallingClientErrorEmitterCallback} from '../CallingClient/types';
import {LogContext} from '../Logger/types';
import {
  CallErrorEmitterCallBack,
  CallRtpStats,
  ReceiveStatistics,
  RetryCallBack,
  TransmitStatistics,
  TransmitterVqPayload,
  VoiceQualityMetrics,
} from '../CallingClient/calling/types';
import {createCallError} from '../Errors/catalog/CallError';
import {
  DEVICE_ERROR_CODE,
  ErrorContext,
  ERROR_CODE,
  ErrorObject,
  ERROR_TYPE,
  CallErrorObject,
  CALL_ERROR_CODE,
  ERROR_LAYER,
} from '../Errors/types';
import {
  ALLOWED_SERVICES,
  CorrelationId,
  DecodeType,
  DisplayInformation,
  HTTP_METHODS,
  IDeviceInfo,
  MobiusServers,
  MobiusStatus,
  SORT,
  WebexRequestPayload,
} from './types';
import log from '../Logger';
import {CallError, CallingClientError} from '../Errors';
import {createClientError} from '../Errors/catalog/CallingDeviceError';

import {
  BYTES_RECEIVED,
  BYTES_SENT,
  CALLING_USER_AGENT,
  CISCO_DEVICE_URL,
  CODEC_ID,
  DUMMY_METRICS,
  IDENTITY_ENDPOINT_RESOURCE,
  INBOUND_CODEC_MATCH,
  INBOUND_RTP,
  JITTER_BUFFER_DELAY,
  JITTER_BUFFER_EMITTED_COUNT,
  LOCAL_CANDIDATE_ID,
  MEDIA_ID,
  MEDIA_SOURCE,
  MIME_TYPE,
  NETWORK_TYPE,
  OUTBOUND_CODEC_MATCH,
  OUTBOUND_RTP,
  PACKETS_DISCARDED,
  PACKETS_LOST,
  PACKETS_RECEIVED,
  PACKETS_SENT,
  REMOTE_INBOUND_RTP,
  ROUND_TRIP_TIME_MEASUREMENTS,
  RTC_CODEC,
  RTC_ICE_CANDIDATE,
  RTC_ICE_CANDIDATE_PAIR,
  RTP_RX_STAT,
  RTP_TX_STAT,
  SCIM_ENDPOINT_RESOURCE,
  SCIM_USER_FILTER,
  SELECTED_CANDIDATE_PAIR_ID,
  SPARK_USER_AGENT,
  TARGET_BIT_RATE,
  TIMESTAMP,
  TOTAL_ROUND_TRIP_TIME,
  TOTAL_SAMPLES_DURATION,
  TRANSPORT,
  TYPE,
  URL_ENDPOINT,
  UTILS_FILE,
} from '../CallingClient/constants';
import {JanusResponseEvent} from '../CallHistory/types';
import {
  CALLING_BACKEND,
  VoicemailResponseEvent,
  MessageInfo,
  CallingPartyInfo,
  FilteredVoicemail,
} from '../Voicemail/types';
import {
  DEVICES,
  ITEMS,
  SETTINGS,
  VALUES,
  KEY,
  TIME,
  PLACEHOLDER_KEY,
  XSI_ACTION_ENDPOINT_ORG_URL_PARAM,
  XSI_ACTION_ENDPOINT,
  INFER_ID_CONSTANT,
} from './constants';
import {
  BW_XSI_URL,
  ENTITLEMENT_BASIC,
  ENTITLEMENT_BROADWORKS_CONN,
  ENTITLEMENT_STANDARD,
  NATIVE_WEBEX_TEAMS_CALLING,
  NATIVE_SIP_CALL_TO_UCM,
  BW_XSI_ENDPOINT_VERSION,
} from '../Voicemail/constants';
import {Model, WebexSDK} from '../SDKConnector/types';
import {scimResponseBody} from '../CallingClient/calling/CallerId/types';
import SDKConnector from '../SDKConnector';
import {CallSettingResponse} from '../CallSettings/types';
import {ContactResponse} from '../Contacts/types';

export function filterMobiusUris(mobiusServers: MobiusServers, defaultMobiusUrl: string) {
  const logContext = {
    file: UTILS_FILE,
    method: filterMobiusUris.name,
  };

  const urisArrayPrimary = [];
  const urisArrayBackup = [];

  if (mobiusServers?.primary?.uris) {
    log.info('Adding Primary uris', logContext);
    for (const uri of mobiusServers.primary.uris) {
      urisArrayPrimary.push(`${uri}${URL_ENDPOINT}`);
    }
  }

  if (mobiusServers?.backup?.uris) {
    log.info('Adding Backup uris', logContext);
    for (const uri of mobiusServers.backup.uris) {
      urisArrayBackup.push(`${uri}${URL_ENDPOINT}`);
    }
  }

  /*
   * If there are no entries in both primary and backup arrays then add the default
   * uri in primary array, otherwise in backup.
   */
  log.info('Adding Default uri', logContext);
  if (!urisArrayPrimary.length && !urisArrayBackup.length) {
    urisArrayPrimary.push(`${defaultMobiusUrl}${URL_ENDPOINT}`);
  } else {
    urisArrayBackup.push(`${defaultMobiusUrl}${URL_ENDPOINT}`);
  }

  const primaryUris: string[] = [];
  const backupUris: string[] = [];

  /* Remove duplicates from primary by keeping the order intact */
  for (let i = 0; i < urisArrayPrimary.length; i += 1) {
    if (primaryUris.indexOf(urisArrayPrimary[i]) === -1) {
      primaryUris.push(urisArrayPrimary[i]);
    }
  }

  /* Remove duplicates from backup by keeping the order intact */
  for (let i = 0; i < urisArrayBackup.length; i += 1) {
    if (backupUris.indexOf(urisArrayBackup[i]) === -1) {
      backupUris.push(urisArrayBackup[i]);
    }
  }

  return {primary: primaryUris, backup: backupUris};
}

/**
 * Updates the error context for a particular calling client instance.
 *
 * @param errContext - Error Context as generated by the caller.
 * @param type - Error type based on status code.
 * @param message - Custom message for user.
 * @param correlationId - Unique identifier for a call.
 * @param callError - Call error instance.
 */
function updateCallErrorContext(
  errContext: ErrorContext,
  type: ERROR_TYPE,
  message: string,
  correlationId: CorrelationId,
  callError: CallError
) {
  const errObj = <CallErrorObject>{};

  errObj.context = errContext;
  errObj.type = type;
  errObj.message = message;
  errObj.correlationId = correlationId;
  callError.setCallError(errObj);
}

/**
 * Updates the error context for a particular calling client instance.
 *
 * @param errContext - Error Context as generated by the caller.
 * @param type - Error type based on status code.
 * @param message - Custom message for user.
 * @param clientError - Client Error.
 */
function updateErrorContext(
  errContext: ErrorContext,
  type: ERROR_TYPE,
  message: string,
  clientError: CallingClientError
) {
  const errObj = <ErrorObject>{};

  errObj.context = errContext;
  errObj.type = type;
  errObj.message = message;
  clientError.setError(errObj);
}

/**
 * Emits final failure to the client after it gives up
 * retrying registration and records error metric.
 *
 * @param callingClient - Instance of CallingClient.
 * @param caller - Method which called this handler.
 * @param file - File name from where error got reported.
 */
export function emitFinalFailure(
  emitterCb: CallingClientErrorEmitterCallback,
  loggerContext: LogContext
) {
  const clientError = createClientError('', {}, ERROR_TYPE.DEFAULT, MobiusStatus.DEFAULT);

  updateErrorContext(
    loggerContext,
    ERROR_TYPE.SERVICE_UNAVAILABLE,
    'An unknown error occurred. Wait a moment and try again. Please contact the administrator if the problem persists.',
    clientError
  );
  emitterCb(clientError);
}

/**
 * Handle various Error flows here. Decide whether to emit event or retry.
 * @param err - Error body.
 * @param emitterCb - CallingClientErrorEmitter
 * @param loggerContext - Logging context that has method and file name
 * @param restoreRegCb - Callback which will try restoring resgistration in case of 403
 *
 * In emitterCb,
 * For non final error scenarios in registration flow,
 * send Unregistered event only without any error message
 * in order to have the web client update only the UI
 * state to disconnected and not show any error dialog
 * to the end user as in those scenarios a retry will
 * be scheduled to attempt registration again.
 *
 */
export async function handleErrors(
  err: WebexRequestPayload,
  emitterCb: CallingClientErrorEmitterCallback,
  loggerContext: LogContext,
  restoreRegCb?: restoreRegistrationCallBack
): Promise<boolean> {
  const clientError = createClientError('', {}, ERROR_TYPE.DEFAULT, MobiusStatus.DEFAULT);

  const errorCode = err.statusCode as number;
  let finalError = false;

  log.warn(`Status code: -> ${errorCode}`, loggerContext);

  switch (errorCode) {
    case ERROR_CODE.UNAUTHORIZED: {
      // Return it to the Caller
      finalError = true;
      log.warn(`401 Unauthorized`, loggerContext);

      updateErrorContext(
        loggerContext,
        ERROR_TYPE.TOKEN_ERROR,
        'User is unauthorized due to an expired token. Sign out, then sign back in.',
        clientError
      );

      emitterCb(clientError, finalError);
      break;
    }

    case ERROR_CODE.INTERNAL_SERVER_ERROR: {
      log.warn(`500 Internal Server Error`, loggerContext);
      updateErrorContext(
        loggerContext,
        ERROR_TYPE.SERVER_ERROR,
        'An unknown error occurred while placing the request. Wait a moment and try again.',
        clientError
      );

      emitterCb(clientError, finalError);
      break;
    }

    case ERROR_CODE.SERVICE_UNAVAILABLE: {
      log.warn(`503 Service Unavailable`, loggerContext);
      updateErrorContext(
        loggerContext,
        ERROR_TYPE.SERVICE_UNAVAILABLE,
        'An error occurred on the server while processing the request. Wait a moment and try again.',
        clientError
      );

      emitterCb(clientError, finalError);
      break;
    }

    case ERROR_CODE.FORBIDDEN: {
      log.warn(`403 Forbidden`, loggerContext);

      const errorBody = <IDeviceInfo>err.body;

      if (!errorBody) {
        log.warn('Error response has no body, throwing default error', loggerContext);
        updateErrorContext(
          loggerContext,
          ERROR_TYPE.FORBIDDEN_ERROR,
          'An unauthorized action has been received. This action has been blocked. Please contact the administrator if this persists.',
          clientError
        );

        emitterCb(clientError, finalError);

        return finalError;
      }

      const code = errorBody.errorCode as number;

      log.warn(`Error code found : ${code}`, loggerContext);
      switch (code) {
        case DEVICE_ERROR_CODE.DEVICE_LIMIT_EXCEEDED: {
          const errorMessage = 'User device limit exceeded';
          log.warn(errorMessage, loggerContext);
          if (restoreRegCb) {
            const caller = loggerContext.method || 'handleErrors';
            await restoreRegCb(errorBody, caller);
          }
          break;
        }
        case DEVICE_ERROR_CODE.DEVICE_CREATION_DISABLED: {
          const errorMessage =
            'User is not configured for WebRTC calling. Please contact the administrator to resolve this issue.';
          finalError = true;
          updateErrorContext(loggerContext, ERROR_TYPE.FORBIDDEN_ERROR, errorMessage, clientError);
          log.warn(errorMessage, loggerContext);
          emitterCb(clientError, true);
          break;
        }
        case DEVICE_ERROR_CODE.DEVICE_CREATION_FAILED: {
          const errorMessage =
            'An unknown error occurred while provisioning the device. Wait a moment and try again.';
          updateErrorContext(loggerContext, ERROR_TYPE.FORBIDDEN_ERROR, errorMessage, clientError);
          log.warn(errorMessage, loggerContext);
          emitterCb(clientError, finalError);
          break;
        }
        default: {
          const errorMessage =
            'An unknown error occurred. Wait a moment and try again. Please contact the administrator if the problem persists.';
          updateErrorContext(loggerContext, ERROR_TYPE.FORBIDDEN_ERROR, errorMessage, clientError);
          log.warn(errorMessage, loggerContext);
          emitterCb(clientError, finalError);
        }
      }
      break;
    }

    case ERROR_CODE.DEVICE_NOT_FOUND: {
      finalError = true;
      log.warn(`404 Device Not Found`, loggerContext);

      updateErrorContext(
        loggerContext,
        ERROR_TYPE.NOT_FOUND,
        'The client has unregistered. Please wait for the client to register before attempting the call. If error persists, sign out, sign back in and attempt the call.',
        clientError
      );
      emitterCb(clientError, finalError);
      break;
    }

    default: {
      updateErrorContext(loggerContext, ERROR_TYPE.DEFAULT, 'Unknown error', clientError);
      log.warn(`Unknown Error`, loggerContext);
      emitterCb(clientError, finalError);
    }
  }

  return finalError;
}

/**
 * Handler for call related errors.
 *
 * @param emitterCb - Event emitter function.
 * @param errorType - Type of error experienced.
 * @param errorLayer - Call control or media layer.
 * @param retryCb - Failure retry function.
 * @param correlationId - CorrelationId of the call.
 * @param err - Error Response.
 * @param caller - Caller function.
 * @param file - File name.
 */
export async function handleCallErrors(
  emitterCb: CallErrorEmitterCallBack,
  errorLayer: ERROR_LAYER,
  retryCb: RetryCallBack,
  correlationId: CorrelationId,
  err: WebexRequestPayload,
  caller: string,
  file: string
) {
  const loggerContext = {
    file,
    method: caller,
  };
  const callError = createCallError('', loggerContext, ERROR_TYPE.DEFAULT, '', errorLayer);

  const errorCode = err.statusCode as number;

  log.warn(`Status code: ->${errorCode}`, loggerContext);

  switch (errorCode) {
    case ERROR_CODE.UNAUTHORIZED: {
      log.warn(`401 Unauthorized`, loggerContext);

      updateCallErrorContext(
        loggerContext,
        ERROR_TYPE.TOKEN_ERROR,
        'User is unauthorized due to an expired token. Sign out, then sign back in.',
        correlationId,
        callError
      );

      emitterCb(callError);
      break;
    }

    case ERROR_CODE.FORBIDDEN:
    /* follow through as both 403 and 503 can have similar error codes */

    case ERROR_CODE.SERVICE_UNAVAILABLE: {
      const errorBody = <IDeviceInfo>err.body;

      if (!errorBody) {
        log.warn('Error response has no body, throwing default error', loggerContext);
        updateCallErrorContext(
          loggerContext,
          err.statusCode === 403 ? ERROR_TYPE.FORBIDDEN_ERROR : ERROR_TYPE.SERVICE_UNAVAILABLE,
          err.statusCode === 403
            ? 'An unauthorized action has been received. This action has been blocked. Please contact the administrator if this persists.'
            : 'An error occurred on the server while processing the request. Wait a moment and try again.',
          correlationId,
          callError
        );
        emitterCb(callError);

        return;
      }

      /* Handle retry-after cases */

      if (err.headers && 'retry-after' in err.headers && retryCb) {
        const retryInterval = err.headers['retry-after'] as unknown as number;

        log.warn(`Retry Interval received: ${retryInterval}`, loggerContext);
        retryCb(retryInterval);

        return;
      }

      /* Handling various Error codes */
      const code = errorBody.errorCode as number;

      let message!: string;

      switch (code) {
        case CALL_ERROR_CODE.INVALID_STATUS_UPDATE: {
          message =
            'An invalid status update has been received for the call. Wait a moment and try again.';
          break;
        }
        case CALL_ERROR_CODE.DEVICE_NOT_REGISTERED: {
          message =
            'The client has unregistered. Please wait for the client to register before attempting the call. If error persists, sign out, sign back in and attempt the call.';
          break;
        }
        case CALL_ERROR_CODE.CALL_NOT_FOUND: {
          message = 'Call is not found on the server. Wait a moment and try again.';
          break;
        }
        case CALL_ERROR_CODE.ERROR_PROCESSING: {
          message =
            'An error occurred while processing the call on the server. Wait a moment and try again.';
          break;
        }
        case CALL_ERROR_CODE.USER_BUSY: {
          message = 'Called user is busy.';
          break;
        }
        case CALL_ERROR_CODE.PARSING_ERROR: {
          message =
            'An error occurred while parsing the provided information. Wait a moment and try again.';
          break;
        }
        case CALL_ERROR_CODE.NOT_ACCEPTABLE: {
          message =
            'An error occurred on the server while accepting the call. Wait a moment and try again. Please contact the administrator if this persists.';
          break;
        }
        case CALL_ERROR_CODE.CALL_REJECTED: {
          message =
            'Call rejected by the server. Wait a moment and try again. Please contact the administrator if this persists.';
          break;
        }
        case CALL_ERROR_CODE.NOT_AVAILABLE: {
          message =
            'Calling services not available. Wait a moment and try again. Please contact the administrator if this persists.';
          break;
        }
        default: {
          message = 'An unknown error occurred. Wait a moment and try again.';
        }
      }

      /* We just emit the errors to the app */

      updateCallErrorContext(
        loggerContext,
        err.statusCode === 403 ? ERROR_TYPE.FORBIDDEN_ERROR : ERROR_TYPE.SERVICE_UNAVAILABLE,
        message,
        correlationId,
        callError
      );

      emitterCb(callError);
      break;
    }

    case ERROR_CODE.DEVICE_NOT_FOUND: {
      log.warn(`404 Call Not Found`, loggerContext);

      updateCallErrorContext(
        loggerContext,
        ERROR_TYPE.NOT_FOUND,
        'Call is no longer active. Wait a moment and try again.',
        correlationId,
        callError
      );

      emitterCb(callError);
      break;
    }

    case ERROR_CODE.INTERNAL_SERVER_ERROR: {
      log.warn(`500 Internal Server Error`, loggerContext);

      updateCallErrorContext(
        loggerContext,
        ERROR_TYPE.SERVER_ERROR,
        'An unknown error occurred in the call. Wait a moment and try again.',
        correlationId,
        callError
      );

      emitterCb(callError);
      break;
    }

    default: {
      log.warn(`Unknown Error`, loggerContext);
    }
  }
}

/**
 *Function to return error details.
 *
 * @param errorCode - WebexRequestPayload // Error status code for failed cases.
 * @param err -.
 * @param loggerContext -.
 * @returns Error response (status code and error message).
 */
export async function serviceErrorCodeHandler(
  err: WebexRequestPayload,
  loggerContext: LogContext
): Promise<JanusResponseEvent | VoicemailResponseEvent | CallSettingResponse | ContactResponse> {
  const errorCode = err.statusCode as number;
  const failureMessage = 'FAILURE';

  switch (errorCode) {
    case ERROR_CODE.BAD_REQUEST: {
      log.warn(`400 Bad request`, loggerContext);

      const errorDetails = {
        statusCode: 400,
        data: {
          error: '400 Bad request',
        },
        message: failureMessage,
      };

      return errorDetails;
    }

    case ERROR_CODE.UNAUTHORIZED: {
      log.warn(`401 User is unauthorised, possible token expiry`, loggerContext);
      const errorDetails = {
        statusCode: 401,
        data: {
          error: 'User is unauthorised, possible token expiry',
        },
        message: failureMessage,
      };

      return errorDetails;
    }

    case ERROR_CODE.FORBIDDEN: {
      log.warn(`403 User request is forbidden`, loggerContext);

      const errorDetails = {
        statusCode: 403,
        data: {
          error: 'User request is forbidden',
        },
        message: failureMessage,
      };

      return errorDetails;
    }

    case ERROR_CODE.DEVICE_NOT_FOUND: {
      log.warn(`404 User info not found`, loggerContext);

      const errorDetails = {
        statusCode: 404,
        data: {
          error: 'User info not found',
        },
        message: failureMessage,
      };

      return errorDetails;
    }

    case ERROR_CODE.REQUEST_TIMEOUT: {
      log.warn(`408 Request to the server timedout`, loggerContext);

      const errorDetails = {
        statusCode: 408,
        data: {
          error: 'Request to the server timedout',
        },
        message: failureMessage,
      };

      return errorDetails;
    }

    case ERROR_CODE.INTERNAL_SERVER_ERROR: {
      log.warn(`500 Internal server error occurred`, loggerContext);

      const errorDetails = {
        statusCode: 500,
        data: {
          error: 'Internal server error occurred',
        },
        message: failureMessage,
      };

      return errorDetails;
    }

    case ERROR_CODE.SERVICE_UNAVAILABLE: {
      log.warn(`503 Unable to establish a connection with the server`, loggerContext);

      const errorDetails = {
        statusCode: 503,
        data: {
          error: 'Unable to establish a connection with the server',
        },
        message: failureMessage,
      };

      return errorDetails;
    }

    default: {
      log.warn(`422 Exception has occurred`, loggerContext);
      const errorDetails = {
        statusCode: 422,
        data: {
          error: '422 Exception has occurred',
        },
        message: failureMessage,
      };

      return errorDetails;
    }
  }
}

/**
 * @param stats - RTC peer connection stats.
 * @returns CallRtpStats.
 */
export function parseMediaQualityStatistics(stats: RTCStatsReport): CallRtpStats {
  if (!stats || navigator.userAgent.indexOf('Firefox') !== -1) {
    log.info('RTCStatsReport is null, adding dummy stats', {
      file: UTILS_FILE,
      method: parseMediaQualityStatistics.name,
    });

    return DUMMY_METRICS as unknown as CallRtpStats;
  }

  try {
    let type!: string;
    let id!: string;
    let inboundCodec!: string;
    let outboundCodec!: string;

    const localCandidates = {};
    const candidatePairs = {};
    const codecList = {};

    const rxStat = {} as ReceiveStatistics;
    const txStat = {} as TransmitStatistics;
    const vqPayload = {} as VoiceQualityMetrics;

    let jitterBufferDelay = 0;
    let jitterBufferEmittedCount = 0;
    let totalRoundTripTime = 0;
    let roundTripTimeMeasurements = 0;
    let selectedPair = '';
    let bitRate = 0;

    /* Set defaults */
    vqPayload.maxJitter = 0;
    vqPayload.VoPktSizeMs = 20;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stats.forEach((report: any) => {
      Object.keys(report).forEach((statName) => {
        if (statName !== TIMESTAMP) {
          if (!type || statName === TYPE) {
            type = report[statName] as string;
          } else if (!id || statName === MEDIA_ID) {
            id = report[statName] as string;
          } else if (id && id.indexOf(RTC_ICE_CANDIDATE_PAIR) !== -1) {
            if (statName === LOCAL_CANDIDATE_ID) {
              candidatePairs[id] = report[statName];
            }
          } else if (id && id.indexOf(RTC_ICE_CANDIDATE) !== -1) {
            if (statName === NETWORK_TYPE) {
              localCandidates[id] = report[statName];
            }
          } else if (
            id &&
            (id.indexOf(INBOUND_CODEC_MATCH) !== -1 ||
              id.indexOf(OUTBOUND_CODEC_MATCH) !== -1 ||
              id.indexOf(RTC_CODEC) !== -1)
          ) {
            if (statName === MIME_TYPE) {
              codecList[id] = report[statName];
            }
          } else if (type && type === REMOTE_INBOUND_RTP) {
            switch (statName) {
              case TOTAL_ROUND_TRIP_TIME: {
                totalRoundTripTime = report[statName];
                break;
              }
              case ROUND_TRIP_TIME_MEASUREMENTS: {
                roundTripTimeMeasurements = report[statName];
                break;
              }
              default: {
                // We don't care about the other stats
              }
            }
          } else if (type && type === INBOUND_RTP) {
            switch (statName) {
              case CODEC_ID: {
                inboundCodec = report[statName];
                break;
              }
              case PACKETS_RECEIVED: {
                rxStat.Pkt = report[statName];
                break;
              }
              case BYTES_RECEIVED: {
                rxStat.Oct = report[statName];
                break;
              }
              case PACKETS_DISCARDED: {
                rxStat.LatePkt = report[statName];
                break;
              }
              case PACKETS_LOST: {
                rxStat.LostPkt = report[statName];
                break;
              }
              case JITTER_BUFFER_DELAY: {
                jitterBufferDelay = report[statName];
                break;
              }
              case JITTER_BUFFER_EMITTED_COUNT: {
                jitterBufferEmittedCount = report[statName];
                break;
              }
              default: {
                // We don't care about the other stats
              }
            }
          } else if (type && type === TRANSPORT) {
            switch (statName) {
              case SELECTED_CANDIDATE_PAIR_ID: {
                selectedPair = report[statName];
                break;
              }
              default: {
                // We don't care about the other stats
              }
            }
          } else if (type && type === OUTBOUND_RTP) {
            switch (statName) {
              case CODEC_ID: {
                outboundCodec = report[statName];
                break;
              }
              case PACKETS_SENT: {
                txStat.Pkt = report[statName];
                break;
              }
              case BYTES_SENT: {
                txStat.Oct = report[statName];
                break;
              }
              case TARGET_BIT_RATE: {
                bitRate = report[statName];
                break;
              }
              default: {
                // We don't care about the other stats
              }
            }
          } else if (type && type === MEDIA_SOURCE) {
            switch (statName) {
              case TOTAL_SAMPLES_DURATION: {
                rxStat.Dur = report[statName];
                txStat.Dur = report[statName];
                break;
              }
              default: {
                // We don't care about the other stats
              }
            }
          }
        }
      });
    });

    /* One way Delay */
    if (roundTripTimeMeasurements !== 0) {
      vqPayload.VoOneWayDelayMs = totalRoundTripTime / (2 * roundTripTimeMeasurements);
    } else {
      vqPayload.VoOneWayDelayMs = 0;
    }
    /* Application type */
    vqPayload.hwType = `${platform.os}/${platform.name}-${platform.version}`;

    /* Network type */
    vqPayload.networkType = localCandidates[candidatePairs[selectedPair]];

    /* Average Jitter */
    rxStat.AvgJit = jitterBufferDelay / jitterBufferEmittedCount;

    /* Update codec */
    // eslint-disable-next-line prefer-destructuring
    vqPayload.VoRxCodec = codecList[inboundCodec].split('/')[1];

    const txVqPayload = {} as TransmitterVqPayload;

    // eslint-disable-next-line prefer-destructuring
    txVqPayload.VoTxCodec = codecList[outboundCodec].split('/')[1];
    txVqPayload.rtpBitRate = bitRate;

    const byeStats = {};

    rxStat.VQMetrics = vqPayload;
    txStat.VQMetrics = txVqPayload;

    byeStats[RTP_RX_STAT] = rxStat;
    byeStats[RTP_TX_STAT] = txStat;

    log.log(JSON.stringify(byeStats), {file: UTILS_FILE, method: parseMediaQualityStatistics.name});

    return byeStats as CallRtpStats;
  } catch (err: unknown) {
    log.warn(`Caught error while parsing RTP stats, ${err}`, {
      file: UTILS_FILE,
      method: parseMediaQualityStatistics.name,
    });

    return DUMMY_METRICS as unknown as CallRtpStats;
  }
}

/**
 * To simulate delays.
 *
 * @param msec - Amount of delay.
 * @returns - Promise.
 */
export const waitForMsecs = (msec: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, msec);
  });

/**
 * Register calling backend.
 *
 * @param webex -.
 * @returns CallingBackEnd.
 */
export function getCallingBackEnd(webex: WebexSDK): CALLING_BACKEND {
  const entModels: Model[] = webex.internal.device.features.entitlement.models;
  let callingBackend;

  if (webex.internal.device.callingBehavior === NATIVE_WEBEX_TEAMS_CALLING) {
    for (let i = 0; i < entModels.length; i += 1) {
      if (
        entModels[i][VALUES][KEY] === ENTITLEMENT_BASIC ||
        entModels[i][VALUES][KEY] === ENTITLEMENT_STANDARD
      ) {
        callingBackend = CALLING_BACKEND.WXC;
        break;
      } else if (entModels[i][VALUES][KEY] === ENTITLEMENT_BROADWORKS_CONN) {
        callingBackend = CALLING_BACKEND.BWRKS;
        break;
      }
    }
  } else if (webex.internal.device.callingBehavior === NATIVE_SIP_CALL_TO_UCM) {
    callingBackend = CALLING_BACKEND.UCM;
  } else {
    callingBackend = CALLING_BACKEND.INVALID;
  }

  return callingBackend as CALLING_BACKEND;
}

/**
 * Register XSI endpoint based on calling backend.
 *
 * @param webex -.
 * @param loggerContext -.
 * @param callingBackend -.
 * @returns Promise.
 */
export async function getXsiActionEndpoint(
  webex: WebexSDK,
  loggerContext: LogContext,
  callingBackend: CALLING_BACKEND
) {
  try {
    switch (callingBackend) {
      case CALLING_BACKEND.WXC: {
        const userIdResponse = <WebexRequestPayload>await webex.request({
          uri: `${webex.internal.services._serviceUrls.hydra}/${XSI_ACTION_ENDPOINT_ORG_URL_PARAM}`,
          method: HTTP_METHODS.GET,
        });
        const response = userIdResponse.body as WebexRequestPayload;

        const xsiEndpoint = response[ITEMS][0][XSI_ACTION_ENDPOINT];

        return xsiEndpoint;
      }

      case CALLING_BACKEND.BWRKS: {
        const bwTokenResponse = <WebexRequestPayload>await webex.request({
          uri: `${webex.internal.services._serviceUrls.wdm}/${DEVICES}`,
          method: HTTP_METHODS.GET,
        });
        const response = bwTokenResponse.body as WebexRequestPayload;

        let xsiEndpoint = response[DEVICES][0][SETTINGS][BW_XSI_URL];

        if (response[DEVICES][0][SETTINGS][BW_XSI_URL].endsWith(BW_XSI_ENDPOINT_VERSION)) {
          xsiEndpoint = response[DEVICES][0][SETTINGS][BW_XSI_URL].slice(0, -5);
        }

        return xsiEndpoint;
      }

      default: {
        throw new Error('Calling backend is not identified, exiting....');
      }
    }
  } catch (err: unknown) {
    const errorInfo = err as WebexRequestPayload;

    serviceErrorCodeHandler(errorInfo, loggerContext);

    return errorInfo;
  }
}

/**
 * Get sorted VoicemailList based on sort order passed.
 *
 * @param webex - Webex object to get service urls.
 * @param callingBackend - CallingBackend will have info like UCM.
 * @returns VGEndpointUrl.
 */
export function getVgActionEndpoint(webex: WebexSDK, callingBackend: CALLING_BACKEND) {
  try {
    if (callingBackend && callingBackend === CALLING_BACKEND.UCM) {
      return webex.internal.services._serviceUrls['ucmgmt-gateway'];
    }
    throw new Error('Calling backend is not identified, exiting....');
  } catch (err: unknown) {
    const errorInfo = err as unknown;

    return errorInfo;
  }
}

/**
 * Get sorted VoiceMailList based on sort order passed.
 *
 * @param voiceMessageList - List of voicemessage.
 * @param sortOrder - Type of sort either ascending or descending.
 * @returns Sorted voicemessageList .
 */
export function getSortedVoicemailList(
  voiceMessageList: MessageInfo[],
  sortOrder: SORT
): MessageInfo[] {
  /* istanbul ignore else */
  if (sortOrder === SORT.DESC) {
    voiceMessageList.sort(
      (voiceMail, nextVoiceMail) =>
        nextVoiceMail[TIME][PLACEHOLDER_KEY] - voiceMail[TIME][PLACEHOLDER_KEY]
    );
  } else if (sortOrder === SORT.ASC) {
    voiceMessageList.sort(
      (voiceMail, nextVoiceMail) =>
        voiceMail[TIME][PLACEHOLDER_KEY] - nextVoiceMail[TIME][PLACEHOLDER_KEY]
    );
  }

  return voiceMessageList;
}

/**
 *  Handler to perform a SCIM Query.
 *
 * @param filter - A filter for the query.
 * @returns - Promise.
 */
async function scimQuery(filter: string) {
  log.info(`Starting resolution for filter:- ${filter}`, {
    file: UTILS_FILE,
    method: 'scimQuery',
  });
  const sdkConnector = SDKConnector;
  const webex = sdkConnector.getWebex();

  const scimUrl = `${webex.internal.services._serviceUrls.identity}/${IDENTITY_ENDPOINT_RESOURCE}/${SCIM_ENDPOINT_RESOURCE}/${webex.internal.device.orgId}/${SCIM_USER_FILTER}`;
  const query = scimUrl + encodeURIComponent(filter);

  return <WebexRequestPayload>(<unknown>webex.request({
    uri: query,
    method: HTTP_METHODS.GET,
    headers: {
      [CISCO_DEVICE_URL]: webex.internal.device.url,
      [SPARK_USER_AGENT]: CALLING_USER_AGENT,
    },
    service: ALLOWED_SERVICES.MOBIUS,
  }));
}

/**
 * Resolve Caller Id display information using SCIM query.
 *
 * @param filter - CI userId.
 */
export async function resolveCallerIdDisplay(filter: string) {
  let resolution;
  const displayResult = {} as DisplayInformation;

  try {
    const response = await scimQuery(filter);

    resolution = response.body as scimResponseBody;

    log.info(`Number of records found for this user :- ${resolution.totalResults}`, {
      file: UTILS_FILE,
      method: 'resolveCallerIdDisplay',
    });
  } catch (err) {
    const res = err as WebexRequestPayload;

    log.warn(`Error response: - ${res.statusCode}`, {
      file: UTILS_FILE,
      method: 'resolveCallerIdDisplay',
    });
  }

  if (resolution?.totalResults && resolution.totalResults > 0) {
    /* Every user has single resource from what we have discussed. May need to revisit this later
     * for shared-line use-cases.
     */
    const scimResource = resolution.Resources[0];

    displayResult.name = scimResource.displayName;

    /* Pick only the primary number  OR  2nd preference Work */
    const numberObj = scimResource.phoneNumbers.find((num) => num.primary === true);

    if (numberObj) {
      displayResult.num = <string>numberObj.value;
    } else if (scimResource.phoneNumbers.length > 0) {
      /* When no primary number exists OR PA-ID/From failed to populate, we take the first number */
      log.info('Failure to resolve caller information. Setting number as caller ID', {
        file: UTILS_FILE,
        method: 'resolveCallerIdDisplay',
      });
      displayResult.num = scimResource.phoneNumbers[0].value;
    }

    /* For Webapp, we are only picking thumbnail photo */
    const photo = scimResource.photos?.find((photo) => photo.type === 'thumbnail');

    displayResult.avatarSrc = photo ? photo.value : 'unknown';

    displayResult.id = scimResource.id;

    log.info(
      `Extracted details:- name: ${displayResult.name} , number: ${displayResult.num}, photo: ${displayResult.avatarSrc}, id: ${displayResult.id}`,
      {
        file: UTILS_FILE,
        method: 'resolveCallerIdDisplay',
      }
    );
  }

  return displayResult;
}

/**
 * Resolve contact info from display name, using people search API.
 *
 * @param name - Display name.
 */
export async function resolveCallerIdByName(name: string) {
  const displayResult = {} as DisplayInformation;
  const sdkConnector = SDKConnector;
  const webex = sdkConnector.getWebex();
  /**
   * @param query - Display name.
   */
  const searchDirectory = (query: string) => {
    return webex.people.list({
      displayName: query,
    });
  };

  await searchDirectory(name).then((results) => {
    log.info(`DS Result: ${results}`, {
      file: UTILS_FILE,
      method: 'resolveCallerIdByName',
    });
    if (results && results.items && results.items.length > 0) {
      const resolution = results.items[0];

      displayResult.name = resolution.displayName;

      /* id is like cisco spark://us/PEOPLE/b853bbd1-1136-4d25-938d-0c37541b1234
       *  We need to extract UUID portion. */
      const id = Buffer.from(resolution.id, 'base64').toString('binary');

      displayResult.id = id.split('/').pop();

      const numObj = resolution.phoneNumbers.find((num) => num.type === 'work');

      if (numObj) {
        displayResult.num = numObj.value;
      } else if (resolution.phoneNumbers.length > 0) {
        displayResult.num = resolution.phoneNumbers[0].value;
      }
      displayResult.avatarSrc = resolution.avatar;
      log.info(
        `Extracted details:- name: ${displayResult.name} , number: ${displayResult.num}, photo: ${displayResult.avatarSrc}, id: ${displayResult.id}`,
        {
          file: UTILS_FILE,
          method: 'resolveCallerIdByName',
        }
      );
    }
  });

  return displayResult;
}

/**
 * Resolve the contact information.
 *
 * @param callingPartyInfo - Calling Party Info.
 */
export async function resolveContact(
  callingPartyInfo: CallingPartyInfo
): Promise<DisplayInformation | null> {
  if (callingPartyInfo.userExternalId && callingPartyInfo.userExternalId.$) {
    /* SCIM Search */
    return resolveCallerIdDisplay(`id eq "${callingPartyInfo.userExternalId.$}"`);
  }
  if (callingPartyInfo.name && callingPartyInfo.name.$) {
    /* People Search */
    return resolveCallerIdByName(callingPartyInfo.name.$);
  }

  return null;
}

/**
 * Store encrypted voicemailList in SessionStorage.
 *
 * @param context - Context for storage.
 * @param voiceMessageList - List of voicemessage.
 */
export function storeVoicemailList(context: string, voiceMessageList: MessageInfo[]) {
  const vmEncodedList = Buffer.from(JSON.stringify(voiceMessageList), 'utf8').toString('base64');

  sessionStorage.setItem(context, vmEncodedList.toString());
}

/**
 * Fetch decrypted voicemailList from SessionStorage.
 *
 * @param context - Context for the storage.
 * @param offset - Number of voicemail records to skip.
 * @param offsetLimit - Number of voicemail list to fetch from the offset.
 * @param loggerContext - File, method name object.
 * @returns - Array containing voicemails and flag to indicate availability of more voicemails.
 */
export function fetchVoicemailList(
  context: string,
  offset: number,
  offsetLimit: number,
  loggerContext: LogContext
): FilteredVoicemail {
  let moreVoicemails = false;
  let requiredVoicemailList: MessageInfo[] = [];

  try {
    const voicemailList = JSON.parse(
      Buffer.from(sessionStorage.getItem(context) as string, 'base64').toString('utf8')
    );

    log.info(`Length of voicemail list:  ${voicemailList.length}`, loggerContext);

    if (voicemailList.length > offset + offsetLimit) {
      moreVoicemails = true;
    }

    requiredVoicemailList = voicemailList.slice(offset, offset + offsetLimit);
  } catch (err: unknown) {
    log.warn(`Caught exception while fetching voicemail from storage. ${err}`, loggerContext);
    const errorInfo = err as WebexRequestPayload;

    serviceErrorCodeHandler(errorInfo, {});
  }

  return {messages: requiredVoicemailList, moreVMAvailable: moreVoicemails};
}

/**
 * Converts a uuid to a hydra id without a network dip.
 *
 * @param id - ID to be encoded to base64.
 * @param decodeType - DecodeType.
 * @returns - Encoded string value.
 */
export function inferIdFromUuid(id: string, decodeType: DecodeType): string {
  return Buffer.from(`${INFER_ID_CONSTANT}/${decodeType}/${id}`, 'binary').toString('base64');
}
