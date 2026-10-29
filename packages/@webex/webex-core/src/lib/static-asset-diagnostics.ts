/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import sha256 from 'crypto-js/sha256';

const MAX_INSPECTION_BYTES = 8192;
const MAX_HEADER_LENGTH = 256;
const RESPONSE_HEADERS = {
  responseContentType: 'content-type',
  responseServer: 'server',
  responseCache: 'x-cache',
  cdnRequestId: 'x-amz-cf-id',
  cdnPop: 'x-amz-cf-pop',
};
const VENDOR_HINTS: Array<[string, RegExp]> = [
  ['zscaler', /\bzscaler\b/i],
  ['netskope', /\bnetskope\b/i],
  ['umbrella', /\bcisco umbrella\b|\bopendns\b/i],
  ['forcepoint', /\bforcepoint\b|\bwebsense\b/i],
  ['bluecoat', /\bblue\s?coat\b|\bproxysg\b/i],
];

type FailureKind = 'http' | 'html' | 'invalid-body' | 'network';

interface AssetResponse {
  statusCode?: number;
  headers?: Record<string, unknown>;
  body?: unknown;
}

interface AssetDiagnostics {
  failureKind: FailureKind;
  httpStatus: number;
  durationMs: number;
  responseBytes?: number;
  inspectedBytes?: number;
  responseContentType?: string;
  responseServer?: string;
  responseCache?: string;
  cdnRequestId?: string;
  cdnPop?: string;
  htmlKind?: string;
  htmlVendorHint?: string;
  htmlStructureHash?: string;
}

/**
 * @param {unknown} value Candidate record.
 * @returns {boolean} Whether properties can be inspected.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * @param {unknown} value Candidate string.
 * @returns {boolean} Whether the value is a string.
 */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * @param {unknown} value Candidate status.
 * @returns {boolean} Whether a readable HTTP response status is present.
 */
function isHttpStatus(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599;
}

/**
 * @param {Object} headers Readable response headers.
 * @param {string} name Lowercase allowlisted header name.
 * @returns {string|undefined} Bounded printable value when present.
 */
function getHeader(headers: Record<string, unknown>, name: string): string | undefined {
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
  const value = key ? headers[key] : undefined;

  return isString(value)
    ? value
        .slice(0, MAX_HEADER_LENGTH)
        .replace(/[^\x20-\x7e]/g, '')
        .trim() || undefined
    : undefined;
}

/**
 * @param {unknown} body Response body.
 * @returns {Object} Bounded inspection bytes and full binary size when known.
 */
function getBodyPrefix(body: unknown): {bytes?: Uint8Array; responseBytes?: number} {
  if (body instanceof ArrayBuffer) {
    return {
      bytes: new Uint8Array(body, 0, Math.min(body.byteLength, MAX_INSPECTION_BYTES)),
      responseBytes: body.byteLength,
    };
  }
  if (ArrayBuffer.isView(body)) {
    return {
      bytes: new Uint8Array(
        body.buffer,
        body.byteOffset,
        Math.min(body.byteLength, MAX_INSPECTION_BYTES)
      ),
      responseBytes: body.byteLength,
    };
  }
  if (isString(body)) {
    return {
      bytes: new TextEncoder()
        .encode(body.slice(0, MAX_INSPECTION_BYTES))
        .subarray(0, MAX_INSPECTION_BYTES),
    };
  }

  return {};
}

/**
 * @param {string} prefix Bounded decoded body prefix.
 * @returns {Object} Finite hints and a structural grouping hash.
 */
function getHtmlDiagnostics(
  prefix: string
): Pick<AssetDiagnostics, 'htmlKind' | 'htmlVendorHint' | 'htmlStructureHash'> {
  const vendor = VENDOR_HINTS.find(([, pattern]) => pattern.test(prefix));
  let htmlKind = 'unknown';

  if (
    /access\s+denied|request\s+(blocked|denied)|blocked\s+by|web\s+(filter|gateway)/i.test(prefix)
  ) {
    htmlKind = 'access-denied';
  } else if (/<(?:div|main)\b[^>]*\bid=["'](?:root|app|reactRoot)["']/i.test(prefix)) {
    htmlKind = 'app-shell';
  }

  // Hash tag structure only: text, attributes, comments and script/style contents can contain secrets.
  const structure = (
    prefix
      .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
      .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
      .match(/<\/?[a-z][a-z0-9-]*\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi) || []
  )
    .map((tag) => tag.match(/^<\/?[a-z][a-z0-9-]*/i)![0].toLowerCase())
    .join('');

  return {
    htmlKind,
    htmlVendorHint: vendor ? vendor[0] : 'unknown',
    ...(structure ? {htmlStructureHash: sha256(structure).toString()} : {}),
  };
}

/**
 * Retains bounded response context without sending response bodies.
 * @param {unknown} reason Original rejection.
 * @param {AssetResponse} response Readable response, if one was received.
 * @param {number} startedAt Request start time in milliseconds.
 * @param {FailureKind} failureKind Failed validation stage.
 * @returns {Error} Original error when extensible, otherwise an annotated error.
 */
export default function addAssetDiagnostics(
  reason: unknown,
  response: AssetResponse | undefined,
  startedAt: number,
  failureKind: FailureKind
): Error {
  const source = response || (isRecord(reason) ? reason : {});
  const httpStatus = isHttpStatus(source.statusCode) ? source.statusCode : 0;
  const diagnostics: AssetDiagnostics = {
    failureKind: failureKind === 'network' && httpStatus ? 'http' : failureKind,
    httpStatus,
    durationMs: Math.max(0, new Date().getTime() - startedAt),
  };
  const headers = isRecord(source.headers) ? source.headers : {};

  Object.entries(RESPONSE_HEADERS).forEach(([field, header]) => {
    const value = getHeader(headers, header);

    if (value) {
      Object.assign(diagnostics, {[field]: value});
    }
  });
  if (diagnostics.responseContentType) {
    diagnostics.responseContentType = diagnostics.responseContentType
      .split(';')[0]
      .trim()
      .toLowerCase();
  }

  const {bytes, responseBytes} = getBodyPrefix(source.body);

  if (responseBytes !== undefined) {
    diagnostics.responseBytes = responseBytes;
  }
  if (bytes) {
    const prefix = new TextDecoder().decode(bytes).trimStart();

    diagnostics.inspectedBytes = bytes.byteLength;
    if (
      prefix.startsWith('<') ||
      /^(text\/html|application\/xhtml\+xml)$/.test(diagnostics.responseContentType || '')
    ) {
      Object.assign(diagnostics, getHtmlDiagnostics(prefix));
    }
  }

  let message = 'Unknown asset download error';

  if (isRecord(reason) && isString(reason.message)) message = reason.message;
  else if (isString(reason)) message = reason;
  const error =
    reason instanceof Error && Object.isExtensible(reason) ? reason : new Error(message);

  if (error !== reason && isRecord(reason) && isHttpStatus(reason.statusCode)) {
    Object.defineProperty(error, 'statusCode', {value: reason.statusCode});
    Object.defineProperty(error, 'options', {value: reason.options});
  }
  Object.defineProperty(error, 'assetDiagnostics', {value: diagnostics, configurable: true});

  return error;
}
