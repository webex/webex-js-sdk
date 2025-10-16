import {Address4, Address6} from 'ip-address';
import {STUN_TURN_URL_REGEX} from '../constants';

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
 * Parses a STUN/TURN URL to extract host and port information
 * @param {string} url - The STUN/TURN URL to parse (e.g., 'stun:server.com:3478' or 'turn:server.com:5004')
 * @returns {object} Object containing host and port, or empty object if parsing fails
 *
 */
export function parseIceServerUrl(url: string): {host?: string; port?: number} {
  try {
    // Handle ICE server URLs: 'stun:', 'turn:', or 'turns:' with optional query params
    const [, , hostname, urlPort] = url.match(STUN_TURN_URL_REGEX);
    if (hostname && urlPort) {
      const host = hostname;
      const port = urlPort ? parseInt(urlPort, 10) : undefined;

      return {host, port};
    }

    return {};
  } catch (error) {
    return {};
  }
}

/**
 * Determines if a string represents a literal IP address (IPv4 or IPv6)
 * Uses Address4 and Address6 from ip-address library for robust validation
 * @param {string} host - The hostname or IP address to check
 * @returns {boolean} true if the host is a literal IP address, false if it's a domain name
 */
export function isIpAddress(host: string): boolean {
  if (!host) {
    return false;
  }

  // Handle IPv6 addresses with brackets
  const cleanHost = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

  try {
    // Check IPv4 first (most common)
    if (Address4.isValid(host) || Address4.isValid(cleanHost)) {
      return true;
    }

    // Check IPv6
    if (Address6.isValid(host) || Address6.isValid(cleanHost)) {
      return true;
    }

    return false; // It's a domain name
  } catch {
    return false; // Error in validation, assume it's a domain name
  }
}
