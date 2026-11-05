/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import Url from 'url';

import {matchAllowedDomain, normalizeAllowedDomains} from './domains';

export interface AllowedWithoutAuthHeaderRule {
  domain: string;
  paths: string[];
}

interface AnonymousRequestOptions {
  uri?: unknown;
  url?: unknown;
  baseUrl?: unknown;
  headers?: Record<string, unknown>;
  auth?: unknown;
  oauth?: unknown;
  hawk?: unknown;
  httpSignature?: unknown;
  aws?: unknown;
  addAuthHeader?: boolean;
  shouldRefreshAccessToken?: boolean;
}

interface Endpoint {
  hostname?: string | null;
  pathname?: string | null;
}

const isRulePath = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('/') && !/[?#\\]/.test(value);

const isRuleDomain = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  const [domain] = normalizeAllowedDomains([value]);

  return Boolean(
    domain &&
      domain.length <= 253 &&
      domain.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
  );
};

const isAnonymousRule = (value: unknown): value is AllowedWithoutAuthHeaderRule => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const rule = value as AllowedWithoutAuthHeaderRule;

  return (
    isRuleDomain(rule.domain) &&
    Array.isArray(rule.paths) &&
    rule.paths.length > 0 &&
    rule.paths.every(isRulePath)
  );
};

const isUrlString = (value: unknown): value is string => typeof value === 'string';

const normalizeRequestUrl = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (isUrlString(value)) {
    return value;
  }

  try {
    // Invoke the branded native serializer; do not trust a caller's href field.
    return URL.prototype.toString.call(value);
  } catch {
    throw new TypeError('Anonymous request rules require a string or native URL.');
  }
};

/**
 * Validate configuration and report whether a final safeguard is needed.
 * @param {unknown} rules - Host-configured anonymous endpoint rules.
 * @returns {boolean} Whether any rules were configured.
 */
export const hasAnonymousRequestRules = (rules: unknown): boolean => {
  if (rules === undefined) {
    return false;
  }
  if (!Array.isArray(rules) || !rules.every(isAnonymousRule)) {
    throw new TypeError(
      'services.allowedWithoutAuthHeader must contain valid domain and exact-path rules.'
    );
  }

  return rules.length > 0;
};

const matchesEndpoint = (endpoint: Endpoint | undefined, rule: AllowedWithoutAuthHeaderRule) =>
  Boolean(
    endpoint?.hostname &&
      endpoint.pathname &&
      matchAllowedDomain(`https://${endpoint.hostname}`, [rule.domain]) &&
      rule.paths.includes(endpoint.pathname)
  );

/**
 * Match a configured endpoint without letting an unsafe form regain auth trust.
 * Both transports must agree on the host and exact path. A recognized endpoint
 * with userinfo, an unsafe scheme/port, or conflicting parses is rejected.
 * @param {unknown} value - Request URL.
 * @param {unknown} rules - Host-configured anonymous endpoint rules.
 * @returns {boolean} Whether the request must omit Authorization.
 */
export const isAnonymousRequest = (value: unknown, rules: unknown): boolean => {
  if (!hasAnonymousRequestRules(rules)) {
    return false;
  }

  const url = normalizeRequestUrl(value);

  if (!url) {
    return false;
  }

  let parsed: URL | undefined;
  let legacy: ReturnType<typeof Url.parse> | undefined;

  try {
    parsed = new URL(url);
  } catch {
    // The other parser can still identify an unsafe configured endpoint.
  }
  try {
    legacy = Url.parse(url);
  } catch {
    // A configured endpoint recognized by only one parser must fail closed.
  }

  const rule = (rules as unknown[])
    .filter(isAnonymousRule)
    .find((candidate) => matchesEndpoint(parsed, candidate) || matchesEndpoint(legacy, candidate));

  if (!rule) {
    return false;
  }

  if (
    !parsed ||
    !legacy ||
    parsed.protocol !== 'https:' ||
    legacy.protocol !== 'https:' ||
    parsed.port ||
    (legacy.port && legacy.port !== '443') ||
    parsed.username ||
    parsed.password ||
    legacy.auth ||
    parsed.pathname !== legacy.pathname ||
    !matchAllowedDomain(url, [rule.domain])
  ) {
    throw new Error('Request blocked: unsafe URL for an anonymous request.');
  }

  return true;
};

/**
 * Suppress SDK, caller-supplied, inherited, and transport-generated authorization.
 * @param {Object} options - The actual request options.
 * @param {unknown} rules - Host-configured anonymous endpoint rules.
 * @returns {boolean} Whether the anonymous policy was applied.
 */
export const applyAnonymousRequestPolicy = (
  options: AnonymousRequestOptions,
  rules: unknown
): boolean => {
  if (!hasAnonymousRequestRules(rules)) {
    return false;
  }

  const key = options.uri !== undefined && options.uri !== null ? 'uri' : 'url';
  let url = normalizeRequestUrl(options[key]);

  if (options.baseUrl) {
    if (
      !isUrlString(options.baseUrl) ||
      !isUrlString(url) ||
      url.startsWith('//') ||
      url.includes('://')
    ) {
      throw new TypeError('Anonymous request rules require a string baseUrl and relative URI.');
    }

    const separator = options.baseUrl.endsWith('/') || url.startsWith('/') || url === '' ? '' : '/';
    const relative = options.baseUrl.endsWith('/') && url.startsWith('/') ? url.slice(1) : url;

    url = `${options.baseUrl}${separator}${relative}`;
    options.baseUrl = false;
  }
  if (url !== undefined) {
    options[key] = url;
  }
  if (!isAnonymousRequest(url, rules)) {
    return false;
  }

  // Redirects shallow-copy options. Do not remove auth from the source headers.
  options.headers = {...options.headers};
  Object.keys(options.headers).forEach((name) => {
    if (name.toLowerCase() === 'authorization') {
      Reflect.deleteProperty(options.headers, name);
    }
  });
  // A false sentinel also prevents DefaultOptions from restoring transport auth.
  options.baseUrl = false;
  options.auth = false;
  options.oauth = false;
  options.hawk = false;
  options.httpSignature = false;
  options.aws = false;
  options.addAuthHeader = false;
  options.shouldRefreshAccessToken = false;

  return true;
};
