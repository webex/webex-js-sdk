import Url from 'url';

// Lowercase and drop any leading/trailing dots so `.Webex.com` and `webex.com.`
// compare equal to `webex.com`. DNS treats all three as the same name. Brackets
// are stripped so the two parsers' IPv6 spellings (`[::1]` vs `::1`) compare equal.
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
 * label boundaries. A substring test would let `notwebex.com` and
 * `webex.com.attacker.net` impersonate `webex.com`.
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
 * Parsing lives here, and deliberately uses both url parsers, because this
 * check authorizes an `Authorization` header and the two transports behind
 * `@webex/http-core` disagree about what the host of a url is:
 *
 * - the browser transport (`request.shim.js` -> `xhr`) parses per WHATWG, which
 *   percent-decodes the authority, so it reads `https://a%2eb.com` as `a.b.com`
 * - the node transport (`request.js` -> the `request` package) uses Node's
 *   legacy `Url.parse`, which ends the authority at the first `%`, so it reads
 *   the same url as `a`
 *
 * Authorizing on one parser while a transport connects using the other is how a
 * token reaches an attacker's host, in whichever direction the mismatch runs.
 * So rather than picking a parser, require both to agree and fail closed when
 * they do not: a url whose host is ambiguous is never an allowed domain.
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
