/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import Url from 'url';

import {matchAllowedDomain, normalizeAllowedDomains} from './domains';

interface RequestOptions {
  uri?: string;
  url?: string;
  headers?: Record<string, unknown>;
  [key: string]: unknown;
}

interface Services {
  getServiceFromUrl(url: string): unknown;
  validateDomains: boolean;
  hasAllowedDomains(): boolean;
  isAllowedDomainUrl(url: string): boolean;
}

/**
 * Admit a domain-only fallback without granting credential trust.
 * @param {Object} options - Request options.
 * @param {Array<string>} domains - Domains permitted without Authorization.
 * @param {Object} services - Existing catalog and credential-domain policy.
 * @returns {boolean} Whether this request uses the anonymous fallback.
 */
export default function applyAnonymousRequestPolicy(
  options: RequestOptions,
  domains?: string[],
  services?: Services
): boolean {
  const url = options.uri || options.url;

  if (!url || !matchAllowedDomain(url, normalizeAllowedDomains(domains))) {
    return false;
  }
  if (
    services?.getServiceFromUrl(url) ||
    (services?.validateDomains && services.hasAllowedDomains() && services.isAllowedDomainUrl(url))
  ) {
    return false;
  }
  // Node's transport can create Basic auth from URL userinfo even with auth: false.
  if (Url.parse(url).auth) {
    throw new Error('Request blocked: URL credentials are not allowed for anonymous requests.');
  }

  // Redirects shallow-copy options. Preserve the source request's headers.
  options.headers = {...options.headers};
  Object.keys(options.headers).forEach((name) => {
    if (name.toLowerCase() === 'authorization') {
      Reflect.deleteProperty(options.headers, name);
    }
  });
  options.auth = false;
  options.oauth = false;
  options.hawk = false;
  options.httpSignature = false;
  options.aws = false;
  options.addAuthHeader = false;
  options.shouldRefreshAccessToken = false;

  return true;
}
