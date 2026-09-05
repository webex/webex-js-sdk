import {CC_FILE} from '../constants';
import type {AISummaryFailureContext} from '../types';
import {getErrorDetails} from './core/Utils';

export type AISummaryError = Error & {data?: Record<string, unknown>};

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export const isFiniteNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const AI_SUMMARY_FEEDBACK_VALUES = new Set(['none', 'thumbs_up', 'thumbs_down'] as const);

/** Creates an AI Summary error, optionally enriched with transport diagnostics. */
export const createSummaryError = (
  errorCode: string,
  methodName?: string,
  context?: Partial<AISummaryFailureContext> & {statusCode?: number}
): AISummaryError => {
  if (methodName) {
    const {error} = getErrorDetails(
      {
        ...(context?.statusCode !== undefined ? {statusCode: context.statusCode} : {}),
        details: {
          data: {
            reason: errorCode,
            methodName,
            ...(context?.eventName ? {eventName: context.eventName} : {}),
            ...(context?.agentId ? {agentId: context.agentId} : {}),
            ...(context?.orgId ? {orgId: context.orgId} : {}),
            ...(context?.interactionId ? {interactionId: context.interactionId} : {}),
            ...(context?.conversationId ? {conversationId: context.conversationId} : {}),
          },
        },
      },
      methodName,
      CC_FILE,
      {uploadLogs: false}
    );

    (error as AISummaryError).data = {
      ...((error as AISummaryError).data ?? {}),
      errorCode,
      ...(context?.statusCode !== undefined ? {statusCode: context.statusCode} : {}),
    };

    return error as AISummaryError;
  }

  const error = new Error(errorCode) as AISummaryError;

  error.data = {errorCode};

  return error;
};
