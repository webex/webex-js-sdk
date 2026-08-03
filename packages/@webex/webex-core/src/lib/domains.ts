import Url from 'url';

// Lowercase and drop any leading/trailing dots so `.Example.com` and `example.com.`
// compare equal to `example.com`. DNS treats all three as the same name. Brackets are
// stripped so the two parsers' IPv6 spellings (`[::1]` vs `::1`) compare equal.
const normalizeHostname = (value: string): string =>
  typeof value === 'string'
    ? value
        .toLowerCase()
        .replace(/^\[|\]$/g, '')
        .replace(/^\.+/, '')
        .replace(/\.+$/, '')
    : '';

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
