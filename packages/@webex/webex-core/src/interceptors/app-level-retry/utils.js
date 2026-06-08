/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {cloneDeep, isPlainObject} from 'lodash';

import {DEFAULT_APP_LEVEL_RETRY_CONFIG, RETRY_AFTER_HEADER} from './constants';

const normalizeBooleanPolicy = (policy) => {
  if (policy === true) {
    return {enabled: true};
  }

  if (policy === false) {
    return {enabled: false};
  }

  return policy || {};
};

export const mergeRetryPolicy = (...policies) =>
  policies.reduce((merged, policy) => {
    const normalizedPolicy = normalizeBooleanPolicy(policy);

    Object.keys(normalizedPolicy).forEach((key) => {
      const value = normalizedPolicy[key];

      if (isPlainObject(value) && isPlainObject(merged[key])) {
        merged[key] = mergeRetryPolicy(merged[key], value);

        return;
      }

      merged[key] = cloneDeep(value);
    });

    return merged;
  }, {});

const normalizeServiceName = (serviceName) =>
  typeof serviceName === 'string' ? serviceName.toLowerCase() : undefined;

const getServicePolicy = (serviceName, services = {}) => {
  const normalizedServiceName = normalizeServiceName(serviceName);

  if (!normalizedServiceName) {
    return undefined;
  }

  const serviceKey = Object.keys(services).find(
    (key) => normalizeServiceName(key) === normalizedServiceName
  );

  return serviceKey ? services[serviceKey] : undefined;
};

export const resolveRetryPolicy = ({appLevelRetry, serviceName, requestRetryPolicy}) => {
  const appPolicy = mergeRetryPolicy(DEFAULT_APP_LEVEL_RETRY_CONFIG, appLevelRetry);
  const servicePolicy = getServicePolicy(serviceName, appPolicy.services);
  const resolvedPolicy = mergeRetryPolicy(appPolicy, servicePolicy, requestRetryPolicy);

  delete resolvedPolicy.services;

  return resolvedPolicy;
};

const getStatusCode = (reason) => {
  const statusCode = Number(reason && reason.statusCode);

  return Number.isFinite(statusCode) ? statusCode : undefined;
};

const isStatusEnabled = (statuses, statusCode) => {
  if (!statusCode) {
    return false;
  }

  if (Array.isArray(statuses)) {
    return statuses.map(Number).includes(statusCode);
  }

  return statuses && statuses[statusCode] === true;
};

export const normalizeMethod = (method) => (method || 'GET').toUpperCase();

const isMethodEnabled = (methods, method) => {
  if (Array.isArray(methods)) {
    return methods.map(normalizeMethod).includes(normalizeMethod(method));
  }

  return methods && methods[normalizeMethod(method)] === true;
};

export const shouldApplyRetryPolicy = ({policy, method}) =>
  Boolean(policy && policy.enabled) && isMethodEnabled(policy.methods, method);

export const shouldRetry = ({policy, reason, method}) =>
  shouldApplyRetryPolicy({policy, method}) &&
  isStatusEnabled(policy.statuses, getStatusCode(reason));

export const getRetryAfterHeader = (headers = {}) => {
  const headerName = Object.keys(headers || {}).find(
    (name) => name.toLowerCase() === RETRY_AFTER_HEADER
  );

  return headerName ? headers[headerName] : undefined;
};

export const parseRetryAfter = (retryAfter) => {
  if (retryAfter === undefined || retryAfter === null) {
    return undefined;
  }

  const retryAfterSeconds = Number(String(retryAfter).trim());

  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds < 0) {
    return undefined;
  }

  return retryAfterSeconds * 1000;
};

export const getRetryAfterValue = (reason) =>
  getRetryAfterHeader(reason && reason.headers) ?? (reason && reason.retryAfter);

const normalizeDelay = (delay) => {
  const normalizedDelay = Number(delay);

  return Number.isFinite(normalizedDelay) && normalizedDelay >= 0 ? normalizedDelay : undefined;
};

export const getMaxRetries = (policy) => {
  const maxRetries = Number(policy && policy.maxRetries);

  if (Number.isFinite(maxRetries) && maxRetries >= 0) {
    return Math.floor(maxRetries);
  }

  return DEFAULT_APP_LEVEL_RETRY_CONFIG.maxRetries;
};

export const getRetryDelay = ({policy, reason, retryCount}) => {
  const maxRetries = getMaxRetries(policy);

  if (retryCount >= maxRetries) {
    return undefined;
  }

  if (policy.retryAfter && policy.retryAfter.enabled !== false) {
    const retryAfterDelay = parseRetryAfter(getRetryAfterValue(reason));

    if (retryAfterDelay !== undefined) {
      const maxDelay = normalizeDelay(policy.retryAfter.maxDelay);

      return maxDelay === undefined ? retryAfterDelay : Math.min(retryAfterDelay, maxDelay);
    }
  }

  if (!policy.fallback || policy.fallback.enabled === false) {
    return undefined;
  }

  const delays = Array.isArray(policy.fallback.delays)
    ? policy.fallback.delays.map(normalizeDelay).filter((delay) => delay !== undefined)
    : DEFAULT_APP_LEVEL_RETRY_CONFIG.fallback.delays;

  if (!delays.length) {
    return undefined;
  }

  return delays[Math.min(retryCount, delays.length - 1)];
};
