// Lowercase and drop any leading/trailing dots so `.Webex.com` and `webex.com.`
// compare equal to `webex.com`. DNS treats all three as the same name.
const normalizeHostname = (value: string): string =>
  typeof value === 'string' ? value.toLowerCase().replace(/^\.+/, '').replace(/\.+$/, '') : '';

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
 * Parsing lives here rather than in the callers so every caller resolves the
 * host the same way the transport does. Node's legacy `Url.parse` ends the
 * authority at the first `%`, so it reads `https://webex.com%2eattacker.net` as
 * the host `webex.com`, while the browser (and `new URL`) percent-decode it to
 * `webex.com.attacker.net` and connect there. Authorizing on one parser while
 * the transport uses another is how a token reaches an attacker's host.
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

  try {
    ({hostname} = new URL(url));
  } catch {
    // Not a parsable absolute url, so it cannot belong to an allowed domain.
    return undefined;
  }

  return (allowedDomains || []).find((allowedDomain) =>
    hostnameMatchesDomain(hostname, allowedDomain)
  );
};

export default matchAllowedDomain;
