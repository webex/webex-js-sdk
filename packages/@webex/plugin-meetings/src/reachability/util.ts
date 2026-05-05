/* eslint-disable import/prefer-default-export */
import {Address4, Address6} from 'ip-address';
import {STUN_TURN_URL_REGEX} from '../constants';
import {SubnetDetail} from './reachability.types';

/**
 * Parses a STUN/TURN URL to extract host and port information.
 * Returns host with brackets removed for IPv6, and isIp flag.
 * @param {string} url - The STUN/TURN URL to parse (e.g., 'stun:server.com:3478', 'stun:[2402:2500::1]:5004')
 * @returns {object} Object containing host, port, and isIp flag
 */
export function parseIceServerUrl(url: string): {
  host?: string;
  port?: number;
  isIp: boolean;
} {
  const match = url.match(STUN_TURN_URL_REGEX);

  if (!match) {
    return {isIp: false};
  }

  const [, ipv6, hostOrIpv4, portStr] = match;
  const port = portStr ? parseInt(portStr, 10) : undefined;

  // IPv6 in brackets - validate and return without brackets
  if (ipv6) {
    if (!Address6.isValid(ipv6)) {
      return {isIp: false};
    }

    return {host: ipv6, port, isIp: true};
  }

  // IPv4 or domain name
  if (hostOrIpv4) {
    const isIp = Address4.isValid(hostOrIpv4);

    return {host: hostOrIpv4, port, isIp};
  }

  return {isIp: false};
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
 * Pre-populates subnet details from STUN URLs.
 * By default, only includes IP addresses (IPv4 or IPv6), skips domain names.
 * When includeDomains is true, also includes domain names (used for UDP per-URL mode).
 * @param {string[]} urls - STUN URLs to extract hosts from
 * @param {boolean} [includeDomains=false] - Whether to include domain names in details
 * @returns {SubnetDetail[]} subnet details marked as unreachable
 */
export function prepopulateSubnetDetails(urls: string[], includeDomains = false): SubnetDetail[] {
  const details: SubnetDetail[] = [];
  const seenHostPorts = new Set<string>();

  urls.forEach((url) => {
    const {host, port, isIp} = parseIceServerUrl(url);
    if (host && port) {
      // Skip domain names unless includeDomains is true
      if (!isIp && !includeDomains) {
        return;
      }

      const key = `${host}:${port}`;
      if (!seenHostPorts.has(key)) {
        seenHostPorts.add(key);
        details.push({
          serverIp: host,
          port,
          answeredTx: 0,
          lostTx: 1,
          latencies: [],
        });
      }
    }
  });

  return details;
}
