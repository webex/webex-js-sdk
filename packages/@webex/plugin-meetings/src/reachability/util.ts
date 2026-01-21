/* eslint-disable import/prefer-default-export */
import {Address4, Address6} from 'ip-address';
import {STUN_TURN_URL_REGEX} from '../constants';
import {SubnetDetail} from './reachability.types';

/**
 * Checks if the given string is a valid IP address (IPv4 or IPv6)
 * Uses Address4 and Address6 from ip-address library for robust validation
 * @param {string} str - String to check
 * @returns {boolean} true if it's a valid IP address
 */
export function isIpAddress(str: string): boolean {
  if (!str) {
    return false;
  }

  // Handle IPv6 addresses with brackets
  const cleanStr = str.startsWith('[') && str.endsWith(']') ? str.slice(1, -1) : str;

  try {
    // Check IPv4 first (most common)
    if (Address4.isValid(str) || Address4.isValid(cleanStr)) {
      return true;
    }

    // Check IPv6
    if (Address6.isValid(str) || Address6.isValid(cleanStr)) {
      return true;
    }

    return false; // It's a domain name
  } catch {
    return false; // Error in validation, assume it's a domain name
  }
}

/**
 * Parses a STUN/TURN URL to extract host and port information
 * @param {string} url - The STUN/TURN URL to parse (e.g., 'stun:server.com:3478' or 'turn:server.com:5004')
 * @returns {object} Object containing host and port, or empty object if parsing fails
 */
export function parseIceServerUrl(url: string): {host?: string; port?: number} {
  try {
    const match = url.match(STUN_TURN_URL_REGEX);
    if (match) {
      const [, , hostname, urlPort] = match;
      if (hostname && urlPort) {
        return {
          host: hostname,
          port: parseInt(urlPort, 10),
        };
      }
      if (hostname) {
        return {host: hostname};
      }
    }

    return {};
  } catch (error) {
    return {};
  }
}

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
 * Pre-populates subnet details from STUN URLs, marked as unreachable initially
 * @param {string[]} urls - STUN URLs to extract IPs from
 * @returns {SubnetDetail[]} subnet details marked as unreachable
 */
export function prepopulateSubnetDetails(urls: string[]): SubnetDetail[] {
  const details: SubnetDetail[] = [];
  const seenIpPorts = new Set<string>();

  urls.forEach((url) => {
    const parsed = parseIceServerUrl(url);
    if (parsed.host && parsed.port && isIpAddress(parsed.host)) {
      const key = `${parsed.host}:${parsed.port}`;
      if (!seenIpPorts.has(key)) {
        seenIpPorts.add(key);
        details.push({
          serverIp: parsed.host,
          port: parsed.port,
          answeredTx: 0, // unreachable initially
          lostTx: 1,
          latencies: [],
        });
      }
    }
  });

  return details;
}
