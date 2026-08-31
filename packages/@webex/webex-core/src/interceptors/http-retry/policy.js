/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

export const DEFAULT_HTTP_RETRY_POLICY = {
  enabled: false,
  retryAfterStatuses: [429, 503],
  backoffStatuses: [408, 429, 500, 502, 503, 504],
  retryNetworkErrors: false,
  methods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'],
  maxRetries: 3,
  retryAfter: {
    enabled: true,
    maxDelay: 3600000,
  },
  backoff: {
    initialDelay: 400,
    factor: 2,
    maxDelay: 3200,
    jitterRatio: 0.2,
  },
  bodyErrorCodes: {
    paths: ['errorCode', 'code', 'reason.reasonCode'],
    nonRetryable: [],
  },
  paths: [],
};

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const normalizePolicy = (policy) => {
  if (policy === true) {
    return {enabled: true};
  }

  if (policy === false) {
    return {enabled: false};
  }

  return isObject(policy) ? policy : {};
};

export const mergeHttpRetryPolicy = (...policies) =>
  policies.reduce((result, policy) => {
    Object.entries(normalizePolicy(policy)).forEach(([key, value]) => {
      if (isObject(value) && isObject(result[key])) {
        result[key] = mergeHttpRetryPolicy(result[key], value);
      } else if (Array.isArray(value)) {
        result[key] = [...value];
      } else {
        result[key] = value;
      }
    });

    return result;
  }, {});

const getPath = (uri = '') => {
  try {
    return new URL(uri, 'https://webex.invalid').pathname;
  } catch {
    return String(uri).split(/[?#]/, 1)[0];
  }
};

const matchesAny = (values, predicate) =>
  Array.isArray(values) && values.some((value) => typeof value === 'string' && predicate(value));

const matchesPath = (rule, path) => {
  const {match = {}} = rule || {};

  return (
    matchesAny(match.exact, (value) => path === value) ||
    matchesAny(match.prefixes, (value) => path.startsWith(value)) ||
    matchesAny(match.suffixes, (value) => path.endsWith(value))
  );
};

const applyPathPolicies = (policy, path) =>
  (Array.isArray(policy.paths) ? policy.paths : []).reduce(
    (resolved, rule) =>
      matchesPath(rule, path) ? mergeHttpRetryPolicy(resolved, rule.policy) : resolved,
    policy
  );

const withoutPaths = (policy) => {
  const rest = {...normalizePolicy(policy)};

  delete rest.paths;

  return rest;
};

export const resolveHttpRetryPolicy = ({config, requestPolicy, serviceName, skipRetries, uri}) => {
  const httpRetry = isObject(config) ? config : {};
  const defaultPolicy = mergeHttpRetryPolicy(DEFAULT_HTTP_RETRY_POLICY, httpRetry.default);
  const path = getPath(uri);
  let resolved = applyPathPolicies(defaultPolicy, path);

  resolved = withoutPaths(resolved);

  if (typeof serviceName === 'string') {
    const servicePolicy = httpRetry.services?.[serviceName.toLowerCase()];

    if (servicePolicy !== undefined) {
      resolved = withoutPaths(
        applyPathPolicies(mergeHttpRetryPolicy(resolved, servicePolicy), path)
      );
    }
  }

  resolved = mergeHttpRetryPolicy(resolved, requestPolicy);

  if (skipRetries) {
    resolved.enabled = false;
  }

  return resolved;
};

const asFiniteNumber = (value, fallback) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
};

const includesNumber = (values, value) =>
  Array.isArray(values) && values.some((candidate) => Number(candidate) === value);

const getStatusCode = (reason) => {
  const value = reason?.statusCode ?? reason?.status;
  const statusCode = Number(value);

  return Number.isFinite(statusCode) ? statusCode : undefined;
};

const getRetryAfter = (reason) => {
  const headers = reason?.headers || {};
  const headerName = Object.keys(headers).find((name) => name.toLowerCase() === 'retry-after');

  return headerName ? headers[headerName] : reason?.retryAfter;
};

const getOwnPathValue = (value, path) => {
  if (typeof path !== 'string' || path.length === 0) {
    return undefined;
  }

  return path.split('.').reduce((current, key) => {
    if (
      (isObject(current) || Array.isArray(current)) &&
      Object.prototype.hasOwnProperty.call(current, key)
    ) {
      return current[key];
    }

    return undefined;
  }, value);
};

const normalizeBodyErrorCode = (value) => {
  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined;
};

const hasNonRetryableBodyErrorCode = (policy, reason) => {
  const paths = policy.bodyErrorCodes?.paths;
  const nonRetryable = policy.bodyErrorCodes?.nonRetryable;

  if (!Array.isArray(paths) || !Array.isArray(nonRetryable) || nonRetryable.length === 0) {
    return false;
  }

  const normalizedCodes = nonRetryable
    .map(normalizeBodyErrorCode)
    .filter((code) => code !== undefined);

  return paths.some((path) => {
    const errorCode = normalizeBodyErrorCode(getOwnPathValue(reason?.body, path));

    return errorCode !== undefined && normalizedCodes.includes(errorCode);
  });
};

export const parseRetryAfter = (value, now = Date.now()) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }

  const seconds = Number(String(value).trim());

  if (Number.isFinite(seconds)) {
    return seconds >= 0 ? seconds * 1000 : undefined;
  }

  const date = Date.parse(value);

  return Number.isFinite(date) ? Math.max(date - now, 0) : undefined;
};

export const isReplayableBody = (body) => {
  if (!body) {
    return true;
  }

  return !(
    typeof body.getReader === 'function' ||
    typeof body.pipe === 'function' ||
    (typeof body.read === 'function' && typeof body.releaseLock === 'function') ||
    (typeof Symbol !== 'undefined' && typeof body[Symbol.asyncIterator] === 'function')
  );
};

const getRetryCount = (options) =>
  Math.max(Math.floor(asFiniteNumber(options?.$httpRetryCount, 0)), 0);

const getMaxRetries = (policy) =>
  Math.max(Math.floor(asFiniteNumber(policy.maxRetries, DEFAULT_HTTP_RETRY_POLICY.maxRetries)), 0);

const isBaseEligible = (policy, options) =>
  policy?.enabled === true &&
  Array.isArray(policy.methods) &&
  policy.methods.some(
    (method) => String(method).toUpperCase() === String(options.method || 'GET').toUpperCase()
  ) &&
  isReplayableBody(options.body) &&
  getRetryCount(options) < getMaxRetries(policy);

const getBackoffDelay = (policy, retryCount, random) => {
  const initialDelay = Math.max(asFiniteNumber(policy.backoff?.initialDelay, 400), 0);
  const factor = Math.max(asFiniteNumber(policy.backoff?.factor, 2), 0);
  const maxDelay = Math.max(asFiniteNumber(policy.backoff?.maxDelay, 3200), 0);
  const jitterRatio = Math.min(Math.max(asFiniteNumber(policy.backoff?.jitterRatio, 0.2), 0), 1);
  const baseDelay = Math.min(initialDelay * factor ** retryCount, maxDelay);
  const jitteredDelay = baseDelay * (1 + (random() * 2 - 1) * jitterRatio);

  return Math.round(Math.min(Math.max(jitteredDelay, 0), maxDelay));
};

export const getHttpRetryDelay = ({
  policy,
  options,
  reason,
  now = Date.now(),
  random = Math.random,
}) => {
  if (!isBaseEligible(policy, options)) {
    return undefined;
  }

  if (hasNonRetryableBodyErrorCode(policy, reason)) {
    return undefined;
  }

  const statusCode = getStatusCode(reason);
  const retryCount = getRetryCount(options);

  if (
    includesNumber(policy.retryAfterStatuses, statusCode) &&
    policy.retryAfter?.enabled !== false
  ) {
    const retryAfterDelay = parseRetryAfter(getRetryAfter(reason), now);

    if (retryAfterDelay !== undefined) {
      const maxDelay = Math.max(asFiniteNumber(policy.retryAfter.maxDelay, 3600000), 0);

      return retryAfterDelay <= maxDelay ? retryAfterDelay : undefined;
    }
  }

  const isNetworkError = statusCode === undefined || statusCode === 0;
  const usesBackoff =
    (isNetworkError && policy.retryNetworkErrors === true) ||
    includesNumber(policy.backoffStatuses, statusCode);

  return usesBackoff ? getBackoffDelay(policy, retryCount, random) : undefined;
};

export const willRetryHttpRequest = ({policy, options, reason}) =>
  getHttpRetryDelay({policy, options, reason, random: () => 0.5}) !== undefined;
