import {OAuthError} from '../credentials/grant-errors';

export const INVALID_ACCESS_TOKEN = 'invalid_access_token';
export const ACCESS_DENIED = 'access_denied';

const catalogAuthFailures = new WeakMap();
const catalogAuthReplayLimit = /^Failed after \d+ replay attempts$/;
const reasonByStatus = {
  401: INVALID_ACCESS_TOKEN,
  403: ACCESS_DENIED,
};

/**
 * A catalog 401 can arrive as an OAuth refresh failure or the auth replay limit.
 * @param {Error} error
 * @returns {boolean}
 */
export function isWrappedCatalogAuthFailure(error) {
  return (
    error instanceof OAuthError ||
    (typeof error?.message === 'string' && catalogAuthReplayLimit.test(error.message))
  );
}

/**
 * @param {string} reason
 * @returns {boolean}
 */
export function isCatalogAuthReason(reason) {
  return reason === INVALID_ACCESS_TOKEN || reason === ACCESS_DENIED;
}

/**
 * Classify a postauth catalog failure.
 * A result is stored. Null means any previously stored failure should be cleared.
 * Network errors and HTTP 5xx stay null.
 * @param {Error} error
 * @returns {{status: number, reason: string}|null}
 */
export function classifyCatalogAuthFailure(error) {
  const status = error && (error.catalogAuthStatus || error.statusCode || error.status);
  const reason = reasonByStatus[status];

  if (reason) {
    return {
      status,
      reason,
    };
  }

  if (isWrappedCatalogAuthFailure(error)) {
    return {
      status: 401,
      reason: INVALID_ACCESS_TOKEN,
    };
  }

  return null;
}

/**
 * @param {object} services
 * @param {Error} error
 * @returns {void}
 */
export function recordCatalogAuthFailure(services, error) {
  const authFailure = classifyCatalogAuthFailure(error);

  if (authFailure) {
    catalogAuthFailures.set(services, authFailure);

    return;
  }

  catalogAuthFailures.delete(services);
}

/**
 * @param {object} services
 * @returns {void}
 */
export function clearCatalogAuthFailure(services) {
  catalogAuthFailures.delete(services);
}

/**
 * @param {object} services
 * @returns {{status: number, reason: string}|null}
 */
export function getCatalogAuthFailure(services) {
  return catalogAuthFailures.get(services) || null;
}

/**
 * @param {object} services
 * @param {string} fallbackMessage
 * @returns {Error}
 */
export function serviceLookupError(services, fallbackMessage) {
  const authFailure = getCatalogAuthFailure(services);

  if (authFailure && isCatalogAuthReason(authFailure.reason)) {
    const authError = new Error(authFailure.reason);

    authError.reason = authFailure.reason;
    authError.statusCode = authFailure.status;

    return authError;
  }

  return new Error(fallbackMessage);
}
