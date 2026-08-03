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
export const hostnameMatchesDomain = (hostname: string, allowedDomain: string): boolean => {
  const host = normalizeHostname(hostname);
  const domain = normalizeHostname(allowedDomain);

  return !!host && !!domain && (host === domain || host.endsWith(`.${domain}`));
};

export default hostnameMatchesDomain;
