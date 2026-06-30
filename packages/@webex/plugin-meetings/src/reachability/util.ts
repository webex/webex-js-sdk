/* eslint-disable import/prefer-default-export */
import {EnableReachabilityChecksConfig, ResolvedReachabilityProtocols} from './reachability.types';

/**
 * Resolves `enableReachabilityChecks` into explicit per-protocol flags.
 * Defaults to all protocols enabled when not configured.
 * UDP is always tested unless reachability is disabled entirely (`false`).
 *
 * @param {EnableReachabilityChecksConfig} enabled value of config.meetings.enableReachabilityChecks
 * @returns {ResolvedReachabilityProtocols} resolved per-protocol flags
 */
export function resolveReachabilityProtocols(
  enabled: EnableReachabilityChecksConfig = true
): ResolvedReachabilityProtocols {
  if (typeof enabled === 'object') {
    return {
      udp: true,
      tcp: enabled.tcp ?? true,
      tls: enabled.tls ?? true,
    };
  }

  return {udp: enabled, tcp: enabled, tls: enabled};
}

/**
 * Whether any reachability protocol is enabled.
 *
 * @param {EnableReachabilityChecksConfig} config value of config.meetings.enableReachabilityChecks
 * @returns {boolean} true if any protocol is enabled
 */
export function isReachabilityEnabled(config: EnableReachabilityChecksConfig = true): boolean {
  const {udp, tcp, tls} = resolveReachabilityProtocols(config);

  return udp || tcp || tls;
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
