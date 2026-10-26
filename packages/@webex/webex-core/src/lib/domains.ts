import Url from 'url';

import {uniq} from 'lodash';

// Canonicalise a hostname for comparison: lowercase, drop the brackets around
// an IPv6 literal, and drop leading/trailing dots. DNS treats `Example.com`,
// `example.com.` and `example.com` as the same name.
//
// Node's `url.domainToASCII` looks like the standard way to do this, but the
// `url` polyfill this package bundles for the browser does not implement it,
// so it cannot be used here. It also leaves trailing dots in place.
const normalizeHostname = (value: string): string =>
  typeof value === 'string'
    ? value
        .toLowerCase()
        .replace(/^\[|\]$/g, '')
        .replace(/^\.+/, '')
        .replace(/\.+$/, '')
    : '';

/**
 * Canonicalise a list of configured allowed domains, discarding any entry that
 * is not a usable hostname. Callers normalise on the way in so the stored list
 * is already canonical, rather than re-deriving it on every request.
 *
 * @param {Array<string>} allowedDomains - The configured allowed domains.
 * @returns {Array<string>} - Normalized, de-duplicated, non-empty entries.
 */
export const normalizeAllowedDomains = (allowedDomains: Array<string>): Array<string> =>
  uniq(
    (Array.isArray(allowedDomains) ? allowedDomains : []).map(normalizeHostname).filter(Boolean)
  );

/**
 * Determine if a hostname is covered by an allowed domain, matching only on DNS
 * label boundaries, so that a hostname is allowed only when it is the domain
 * itself or a subdomain of it. Matching on a substring instead would treat
 * unrelated hostnames that merely contain the domain as allowed.
 *
 * @param {string} hostname - Hostname to test. Must not include a port.
 * @param {string} allowedDomain - The configured allowed domain.
 * @returns {boolean} - True when the hostname is the domain or a subdomain of it.
 */
const hostnameMatchesDomain = (hostname: string, allowedDomain: string): boolean => {
  // The stored list is normalized on write, but `allowedDomains` is a public
  // property, so normalize again here rather than trust it.
  const host = normalizeHostname(hostname);
  const domain = normalizeHostname(allowedDomain);

  return !!host && !!domain && (host === domain || host.endsWith(`.${domain}`));
};

/**
 * Find the allowed domain covering a url, or `undefined` if there is none.
 *
 * Parsing lives here rather than in the callers, and deliberately uses both url
 * parsers, because this check gates an `Authorization` header. The two
 * transports behind `@webex/http-core` do not use the same url parser: the
 * browser transport parses per WHATWG, the node transport uses Node's legacy
 * `Url.parse`, and for some inputs the two resolve different hosts.
 *
 * Rather than picking one, require both to agree and fail closed when they do
 * not, so this check can never authorize a host that differs from the one a
 * transport would actually connect to. Do not narrow this to a single parser.
 *
 * @param {string} url - The url to match the allowed domains against.
 * @param {Array<string>} allowedDomains - The configured allowed domains.
 * @returns {string} - The matching allowed domain, or undefined if there is none.
 */
export const matchAllowedDomain = (
  url: string,
  allowedDomains: Array<string>
): string | undefined => {
  let hostname: string;
  let legacyHostname: string;

  try {
    ({hostname} = new URL(url));
    ({hostname: legacyHostname} = Url.parse(url));
  } catch {
    // Not a parsable absolute url, so it cannot belong to an allowed domain.
    return undefined;
  }

  if (normalizeHostname(hostname) !== normalizeHostname(legacyHostname)) {
    return undefined;
  }

  return (allowedDomains || []).find((allowedDomain) =>
    hostnameMatchesDomain(hostname, allowedDomain)
  );
};

export default matchAllowedDomain;
