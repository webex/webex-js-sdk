import * as Err from './Err';
import {LoginOption, WebexRequestPayload} from '../../types';
import {Failure, AugmentedError} from './GlobalTypes';
import LoggerProxy from '../../logger-proxy';
import WebexRequest from './WebexRequest';
import {
  TaskData,
  ConsultTransferPayLoad,
  CONSULT_TRANSFER_DESTINATION_TYPE,
  Interaction,
} from '../task/types';
import {PARTICIPANT_TYPES, STATE_CONSULT} from './constants';

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
 * Checks if the destination type represents an entry point variant (EPDN or ENTRYPOINT).
 */
const isEntryPointOrEpdn = (destAgentType?: string): boolean => {
  return destAgentType === 'EPDN' || destAgentType === 'ENTRYPOINT';
};

/**
 * Determines if the task involves dialing a number based on the destination type.
 * Returns 'DIAL_NUMBER' for dial-related destinations, empty string otherwise.
 */
const getAgentActionTypeFromTask = (taskData?: TaskData): 'DIAL_NUMBER' | '' => {
  const destAgentType = taskData?.destinationType;

  // Check if destination requires dialing: direct dial number or entry point variants
  const isDialNumber = destAgentType === 'DN';
  const isEntryPointVariant = isEntryPointOrEpdn(destAgentType);

  // If the destination type is a dial number or an entry point variant, return 'DIAL_NUMBER'
  return isDialNumber || isEntryPointVariant ? 'DIAL_NUMBER' : '';
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
 * Extracts error details from task API errors and logs them. Also uploads logs for the error.
 * This handles the specific error format returned by task API calls.
 *
 * @param error - The error object from task API calls with structure: {id: string, details: {trackingId: string, msg: {...}}}
 * @param methodName - The name of the method where the error occurred.
 * @param moduleName - The name of the module where the error occurred.
 * @returns AugmentedError containing structured error details on err.data for metrics and logging
 * @public
 * @example
 * const taskError = generateTaskErrorObject(error, 'transfer', 'TaskModule');
 * throw taskError.error;
 * @ignore
 */
export const generateTaskErrorObject = (
  error: any,
  methodName: string,
  moduleName: string
): AugmentedError => {
  const trackingId = error?.details?.trackingId || error?.trackingId || '';
  const errorMsg = error?.details?.msg;

  const fallbackMessage =
    (error && typeof error.message === 'string' && error.message) ||
    `Error while performing ${methodName}`;
  const errorMessage = errorMsg?.errorMessage || fallbackMessage;
  const errorType =
    errorMsg?.errorType ||
    (error && typeof error.name === 'string' && error.name) ||
    'Unknown Error';
  const errorData = errorMsg?.errorData || '';
  const reasonCode = errorMsg?.reasonCode || 0;

  // Log and upload for Task API formatted errors
  LoggerProxy.error(`${methodName} failed: ${errorMessage} (${errorType})`, {
    module: moduleName,
    method: methodName,
    trackingId,
  });
  WebexRequest.getInstance().uploadLogs({
    correlationId: trackingId,
  });

  const reason = `${errorType}: ${errorMessage}${errorData ? ` (${errorData})` : ''}`;
  const err: AugmentedError = new Error(reason);
  err.data = {
    message: errorMessage,
    errorType,
    errorData,
    reasonCode,
    trackingId,
  };

  return err;
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

/**
 * Gets the consulted agent ID from the media object by finding the agent
 * in the consult media participants (excluding the current agent).
 *
 * @param media - The media object from the interaction
 * @param agentId - The current agent's ID to exclude from the search
 * @returns The consulted agent ID, or empty string if none found
 */
export const getConsultedAgentId = (media: Interaction['media'], agentId: string): string => {
  let consultParticipants: string[] = [];
  let consultedParticipantId = '';

  Object.keys(media).forEach((key) => {
    if (media[key].mType === STATE_CONSULT) {
      consultParticipants = media[key].participants;
    }
  });

  if (consultParticipants.includes(agentId)) {
    const id = consultParticipants.find((participant) => participant !== agentId);
    consultedParticipantId = id || consultedParticipantId;
  }

  return consultedParticipantId;
};

/**
 * Gets the destination agent ID for CBT (Capacity Based Team) scenarios.
 * CBT refers to teams created in Control Hub with capacity-based routing
 * (as opposed to agent-based routing). This handles cases where the consulted
 * participant is not directly in participants but can be found by matching
 * the dial number (dn).
 *
 * @param interaction - The interaction object
 * @param consultingAgent - The consulting agent identifier
 * @returns The destination agent ID for CBT scenarios, or empty string if none found
 */
export const getDestAgentIdForCBT = (interaction: Interaction, consultingAgent: string): string => {
  const participants = interaction.participants;
  let destAgentIdForCBT = '';

  // Check if this is a CBT scenario (consultingAgent exists but not directly in participants)
  if (consultingAgent && !participants[consultingAgent]) {
    const foundEntry = Object.entries(participants).find(
      ([, participant]: [string, Interaction['participants'][string]]) => {
        return (
          participant.pType.toLowerCase() === PARTICIPANT_TYPES.DN &&
          participant.type === PARTICIPANT_TYPES.AGENT &&
          participant.dn === consultingAgent
        );
      }
    );

    if (foundEntry) {
      destAgentIdForCBT = foundEntry[0];
    }
  }

  return destAgentIdForCBT;
};

/**
 * Calculates the destination agent ID for consult operations.
 *
 * @param interaction - The interaction object
 * @param agentId - The current agent's ID
 * @returns The destination agent ID
 */
export const calculateDestAgentId = (interaction: Interaction, agentId: string): string => {
  const consultingAgent = getConsultedAgentId(interaction.media, agentId);

  // Check if this is a CBT (Capacity Based Team) scenario
  // If not CBT, the function will return empty string and we'll use the normal flow
  const destAgentIdCBT = getDestAgentIdForCBT(interaction, consultingAgent);
  if (destAgentIdCBT) {
    return destAgentIdCBT;
  }

  return interaction.participants[consultingAgent]?.type === PARTICIPANT_TYPES.EP_DN
    ? interaction.participants[consultingAgent]?.epId
    : interaction.participants[consultingAgent]?.id;
};

/**
 * Calculates the destination agent ID for fetching destination type.
 *
 * @param interaction - The interaction object
 * @param agentId - The current agent's ID
 * @returns The destination agent ID for determining destination type
 */
export const calculateDestType = (interaction: Interaction, agentId: string): string => {
  const consultingAgent = getConsultedAgentId(interaction.media, agentId);

  // Check if this is a CBT (Capacity Based Team) scenario, otherwise use consultingAgent
  const destAgentIdCBT = getDestAgentIdForCBT(interaction, consultingAgent);
  const destinationaegntId = destAgentIdCBT || consultingAgent;
  const destAgentType = destinationaegntId
    ? interaction.participants[destinationaegntId]?.pType
    : undefined;
  if (destAgentType) {
    if (destAgentType === 'DN') {
      return CONSULT_TRANSFER_DESTINATION_TYPE.DIALNUMBER;
    }
    if (destAgentType === 'EP-DN') {
      return CONSULT_TRANSFER_DESTINATION_TYPE.ENTRYPOINT;
    }
    // Keep the existing destinationType if it's something else (like "agent" or "Agent")
    // Convert "Agent" to lowercase for consistency

    return destAgentType.toLowerCase();
  }

  return CONSULT_TRANSFER_DESTINATION_TYPE.AGENT;
};

export const deriveConsultTransferDestinationType = (
  taskData?: TaskData
): ConsultTransferPayLoad['destinationType'] => {
  const agentActionType = getAgentActionTypeFromTask(taskData);

  if (agentActionType === 'DIAL_NUMBER') {
    return isEntryPointOrEpdn(taskData?.destinationType)
      ? CONSULT_TRANSFER_DESTINATION_TYPE.ENTRYPOINT
      : CONSULT_TRANSFER_DESTINATION_TYPE.DIALNUMBER;
  }

  return CONSULT_TRANSFER_DESTINATION_TYPE.AGENT;
};
