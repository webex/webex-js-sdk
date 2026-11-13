/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

const NUMERIC_FIELDS = ['httpStatus', 'durationMs', 'responseBytes', 'inspectedBytes'];
const STRING_FIELDS = [
  'responseContentType',
  'responseServer',
  'responseCache',
  'cdnRequestId',
  'cdnPop',
  'htmlStructureHash',
];
const TAG_VALUES: Record<string, string[]> = {
  failureKind: ['http', 'html', 'invalid-body', 'network'],
  htmlKind: ['access-denied', 'app-shell', 'unknown'],
  htmlVendorHint: ['zscaler', 'netskope', 'umbrella', 'forcepoint', 'bluecoat', 'unknown'],
};

/**
 * @param {unknown} value Candidate record.
 * @returns {boolean} Whether properties can be inspected.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * @param {unknown} value Candidate string.
 * @returns {boolean} Whether the string has visible content.
 */
function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} value Candidate measurement.
 * @returns {boolean} Whether the measurement is finite and nonnegative.
 */
function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Projects only the diagnostic contract into metric dimensions.
 * @param {unknown} reason Asset rejection carrying optional diagnostics.
 * @returns {Object} Allowlisted fields and finite tags.
 */
export function getAssetFailureDiagnostics(reason: unknown): {
  fields: Record<string, number | string>;
  tags: Record<string, string>;
} {
  const fields: Record<string, number | string> = {};
  const tags: Record<string, string> = {};
  const diagnostics =
    isRecord(reason) && isRecord(reason.assetDiagnostics) ? reason.assetDiagnostics : {};

  NUMERIC_FIELDS.forEach((name) => {
    const value = diagnostics[name];

    if (isNonnegativeNumber(value)) fields[name] = value;
  });
  STRING_FIELDS.forEach((name) => {
    const value = diagnostics[name];

    if (isNonemptyString(value)) {
      const normalized = value
        .slice(0, 256)
        .replace(/[^\x20-\x7e]/g, '')
        .trim();

      if (normalized) fields[name] = normalized;
    }
  });
  Object.entries(TAG_VALUES).forEach(([name, values]) => {
    const value = diagnostics[name];

    if (isNonemptyString(value) && values.includes(value)) tags[name] = value;
  });

  return {fields, tags};
}

/**
 * @param {unknown} reason Certificate validation rejection.
 * @returns {string} Bounded nonempty reason without serializing arbitrary objects.
 */
export function getKmsFailureReason(reason: unknown): string {
  const candidates = isRecord(reason)
    ? [reason.message, reason.resultMessage, reason.errorMessage]
    : [reason];
  const message = candidates.find(isNonemptyString);

  return message ? message.trim().slice(0, 512) : 'Unknown KMS certificate validation failure';
}
