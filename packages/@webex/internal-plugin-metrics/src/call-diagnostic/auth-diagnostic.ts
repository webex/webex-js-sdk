import {isPlainObject} from 'lodash';

import type {
  ClientEvent,
  ClientEventPayload,
  MeetingClientEventOptions,
  SubmitClientEventArgs,
  SubmitClientEventOptions,
} from '../metrics.types';

export const AUTH_DIAGNOSTIC_TYPE = 'auth' as const;

const AUTH_OPTION_FIELDS = [
  'correlationId',
  'preLoginId',
  'rawError',
  'environment',
  'newEnvironmentType',
  'clientLaunchMethod',
  'browserLaunchMethod',
  'triggeredTime',
  'vendorId',
  'clientType',
  'subClientType',
  'networkType',
] as const satisfies readonly (keyof MeetingClientEventOptions)[];

const AUTH_PAYLOAD_FIELDS = [
  'loginInfo',
  'eventData',
  'errors',
  'canProceed',
  'telemetryOptOut',
  'privacyAndSecurityPermission',
] as const satisfies readonly (keyof NonNullable<ClientEventPayload>)[];

export const AUTH_DIAGNOSTIC_IDENTIFIER_FIELDS = [
  'correlationId',
  'userId',
  'deviceId',
  'orgId',
  'machineId',
] as const satisfies readonly (keyof NonNullable<
  NonNullable<ClientEvent['payload']>['identifiers']
>)[];

type AuthOptionField = (typeof AUTH_OPTION_FIELDS)[number];
type AuthPayloadField = (typeof AUTH_PAYLOAD_FIELDS)[number];

export type AuthDiagnosticOptions = Pick<MeetingClientEventOptions, AuthOptionField> & {
  diagnosticType: typeof AUTH_DIAGNOSTIC_TYPE;
  correlationId: string;
} & {
  [Key in Exclude<keyof MeetingClientEventOptions, AuthOptionField | 'diagnosticType'>]?: never;
};

export type AuthDiagnosticPayload = Pick<NonNullable<ClientEventPayload>, AuthPayloadField> & {
  [Key in Exclude<keyof NonNullable<ClientEventPayload>, AuthPayloadField>]?: never;
};

export type AuthDiagnosticEventArgs = {
  name: ClientEvent['name'];
  options: AuthDiagnosticOptions;
  payload?: AuthDiagnosticPayload;
};

const authOptionFields = new Set<string>(AUTH_OPTION_FIELDS);
const authPayloadFields = new Set<string>(AUTH_PAYLOAD_FIELDS);

type ClientEventConstructionOptions = Omit<MeetingClientEventOptions, 'diagnosticType'> & {
  diagnosticType?: unknown;
};

/**
 * Select the auth builder after the full argument check.
 * @param {Object} options client event options
 * @returns {boolean} True when the caller selects auth diagnostics.
 */
export function isAuthDiagnosticOptions(
  options?: SubmitClientEventOptions
): options is AuthDiagnosticOptions {
  return options?.diagnosticType === AUTH_DIAGNOSTIC_TYPE;
}

/**
 * Validate explicit auth inputs before shared enrichment or payload merging.
 * @param {Object} args client event arguments
 * @returns {void} Returns after checking the auth input.
 */
export function assertValidClientEventArgs(args: {
  name: ClientEvent['name'];
  options?: ClientEventConstructionOptions;
  payload?: ClientEventPayload;
}): asserts args is SubmitClientEventArgs {
  const {options, payload} = args;

  if (options?.diagnosticType === undefined) return;

  if (options.diagnosticType !== AUTH_DIAGNOSTIC_TYPE) {
    throw new Error('Unsupported diagnostic type');
  }

  if (typeof options.correlationId !== 'string' || !options.correlationId.trim()) {
    throw new Error('Auth diagnostics require a correlation ID');
  }

  if (Object.keys(options).some((key) => key !== 'diagnosticType' && !authOptionFields.has(key))) {
    throw new Error('Auth diagnostic options contain unsupported fields');
  }

  if (payload !== undefined && !isPlainObject(payload)) {
    throw new Error('Auth diagnostic payload must be an object');
  }

  if (Object.keys(payload ?? {}).some((key) => !authPayloadFields.has(key))) {
    throw new Error('Auth diagnostic payload contains unsupported fields');
  }
}
