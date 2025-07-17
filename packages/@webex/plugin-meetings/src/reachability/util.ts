/* eslint-disable import/prefer-default-export */
/**
 * Converts a stun url to a turn url
 *
 * @param {string} stunUrl url of a stun server
 * @param {'tcp'|'udp'} protocol what protocol to use for the turn server
 * @returns {string} url of a turn server
 */
export function convertStunUrlToTurn(stunUrl: string, protocol: 'udp' | 'tcp') {
  // stunUrl looks like this: "stun:external-media91.public.wjfkm-a-10.prod.infra.webex.com:5004"
  // and we need it to be like this: "turn:external-media91.public.wjfkm-a-10.prod.infra.webex.com:5004?transport=tcp"
  const url = new URL(stunUrl);

  if (url.protocol !== 'stun:') {
    throw new Error(`Not a STUN URL: ${stunUrl}`);
  }

  url.protocol = 'turn:';
  if (protocol === 'tcp') {
    url.searchParams.append('transport', 'tcp');
  }

  return url.toString();
}

/**
 * Converts a stun url to a turns url
 *
 * @param {string} stunUrl url of a stun server
 * @returns {string} url of a turns server
 */
export function convertStunUrlToTurnTls(stunUrl: string) {
  // stunUrl looks like this: "stun:external-media1.public.wjfkm-a-15.prod.infra.webex.com:443"
  // and we need it to be like this: "turns:external-media1.public.wjfkm-a-15.prod.infra.webex.com:443?transport=tcp"
  const url = new URL(stunUrl);

  if (url.protocol !== 'stun:') {
    throw new Error(`Not a STUN URL: ${stunUrl}`);
  }

  url.protocol = 'turns:';
  url.searchParams.append('transport', 'tcp');

  return url.toString();
}

/**
 * Checks if the given server address is a domain name.
 *
 * @param {string} url - The server IP or domain name to check.
 * @returns {boolean} true if the server IP is a domain name, false otherwise.
 */
export function isDomainName(url: string): boolean {
  // Regex to match IPv4 addresses
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

  // Regex to match IPv6 addresses (enclosed in square brackets or plain format)
  const ipv6Regex = /^\[?([a-fA-F0-9]{0,4}:){2,7}[a-fA-F0-9]{0,4}\]?$/;

  // Check if the input matches IPv4 or IPv6
  if (ipv4Regex.test(url) || ipv6Regex.test(url)) {
    return false; // It's an IP address
  }

  // If it doesn't match IPv4 or IPv6, assume it's a domain name
  return true;
}
