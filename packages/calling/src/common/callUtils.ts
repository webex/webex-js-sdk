import {
  LocalMicrophoneStream,
  MediaConnectionEventNames,
  RoapMediaConnection,
  RoapMessageEvent,
} from '@webex/internal-media-core';
import {CALL_UTILS_FILE, ICE_CANDIDATES_TIMEOUT} from '../CallingClient/constants';
import log from '../Logger';
import {
  CANDIDATE_ADDRESS_INDEX,
  EXCLUDED_HOST_IPS,
  IPV4_FALLBACK_ADDRESS,
  MAX_HOST_IPS,
  SDP_HOST_CANDIDATE_REGEX,
} from './constants';

let hostIps: string[] = [];

/**
 * Modifies SDP to replace IPv6 "c=" lines with IPv4.And adds an IPv4 candidate if none exists.
 *
 * @param sdp - Session Description Protocol string.
 * @returns Modified SDP string.
 */
export function modifySdpForIPv4(sdp: string): string {
  try {
    // Normalize line endings to avoid issues
    sdp = sdp.replace(/\r\n|\r/g, '\n');

    // Ensure consistent spacing without removing intentional indentation
    sdp = sdp.replace(/^[ \t]+/gm, '');

    // Check if at least one IPv6 "c=" line is present
    const ipv6CLineMatches = sdp.match(/c=IN IP6 [\da-f:.]+/gi) || [];
    const hasIPv6CLine = ipv6CLineMatches.length > 0;

    if (hasIPv6CLine) {
      log.info('Modifying SDP for IPv4 compatibility', {
        file: CALL_UTILS_FILE,
        method: 'modifySdpForIPv4',
      });

      // Extract an existing IPv4 candidate's IP, if available
      const ipv4CandidateMatch = sdp.match(/a=candidate:\d+ \d+ \w+ \d+ ([\d.]+) \d+ typ \w+/);
      const ipv4Address = ipv4CandidateMatch?.[1] || IPV4_FALLBACK_ADDRESS; // Default fallback

      // Replace all IPv6 "c=" lines with IPv4 using the extracted IP (or default)
      sdp = sdp.replace(/c=IN IP6 [\da-f:.]+/gi, `c=IN IP4 ${ipv4Address}`);

      // Ensure newline separation between candidate lines
      if (!ipv4CandidateMatch) {
        let ipv4CandidateAdded = false;

        sdp = sdp.replace(
          /(a=candidate:(\d+) (\d+) (\w+) (\d+) ([\da-f:.]+) (\d+) typ (\w+)[^\n]*)/g,
          (
            match: string,
            full: string,
            foundation: string,
            componentId: string,
            transport: string, // Supports both UDP and TCP
            priority: string,
            connectionAddress: string,
            port: string,
            candidateType: string
          ) => {
            if (!ipv4CandidateAdded && connectionAddress.includes(':')) {
              // Ensure it's IPv6 and only add once
              ipv4CandidateAdded = true;
              const newFoundation = (parseInt(foundation, 10) + 1).toString();

              return (
                `${full}\n` +
                `a=candidate:${newFoundation} ${componentId} ${transport} ${priority} ${ipv4Address} ${port} typ ${candidateType} generation 0 network-id 1 network-cost 10`
              );
            }

            return match;
          }
        );
      }
    }

    return sdp;
  } catch (error) {
    log.warn(`Error modifying SDP for IPv4 compatibility: ${error}`, {
      file: CALL_UTILS_FILE,
      method: 'modifySdpForIPv4',
    });

    return sdp; // Return original SDP in case of an error
  }
}

/**
 * Host ip addresses of this client, as stored by the last {@link discoverHostIps}. Empty until
 * that discovery has resolved, and whenever it found or reported none.
 */
export function getHostIps(): string[] {
  return hostIps;
}

/**
 * Returns the host ip addresses advertised by the host candidates of an SDP, dropping the ones
 * that carry no information for the server, deduplicating across interfaces and capping the
 * result at the maximum number of addresses the Mobius API accepts.
 *
 * @param sdp - Session Description Protocol string.
 */
export function getHostIpsFromSdp(sdp?: string): string[] {
  const candidates = sdp?.match(SDP_HOST_CANDIDATE_REGEX) || [];

  return candidates
    .map((candidate) => candidate.split(' ')[CANDIDATE_ADDRESS_INDEX])
    .filter(
      (address, index, addresses) =>
        !EXCLUDED_HOST_IPS.includes(address) && addresses.indexOf(address) === index
    )
    .slice(0, MAX_HOST_IPS);
}

/**
 * Discovers the host ip addresses of this client for the Mobius payloads that report them.
 *
 * ICE candidates are the only place a browser exposes the addresses of the local interfaces, so
 * a throwaway media connection is negotiated far enough to produce a local offer, and the
 * addresses are read off its host candidates. It is configured like the connection of a call, so
 * that the addresses reported on registration are the ones the first call will offer. The offer
 * is discarded and the connection closed right after, which releases the ports that gathering
 * bound.
 *
 * The addresses are stored for {@link getHostIps} to read when the registration is posted, and
 * are replaced on every discovery, as the interfaces a client holds can change between one
 * registration and the next. Any failure leaves none stored: they are supplementary and must
 * never fail a registration.
 *
 * @param localAudioStream - Microphone stream of the client. Holding it is what grants this
 * origin the media capture permission that makes browsers report the addresses rather than mDNS
 * hostnames, and sending its track is what makes the offer match the one a call produces.
 */
export async function discoverHostIps(localAudioStream: LocalMicrophoneStream): Promise<void> {
  const logContext = {file: CALL_UTILS_FILE, method: 'discoverHostIps'};
  let connection: RoapMediaConnection | undefined;

  hostIps = [];

  try {
    connection = new RoapMediaConnection(
      {
        skipInactiveTransceivers: true,
        iceServers: [],
        iceCandidatesTimeout: ICE_CANDIDATES_TIMEOUT,
        sdpMunging: {
          convertPort9to0: true,
          addContentSlides: false,
          copyClineToSessionLevel: true,
        },
      },
      {
        localTracks: {audio: localAudioStream.outputStream.getAudioTracks()[0]},
        direction: {
          audio: 'sendrecv',
          video: 'inactive',
          screenShareVideo: 'inactive',
        },
      },
      'WebexCallSDK-hostIpDiscovery'
    );

    /*
     * The offer is emitted before initiateOffer() resolves, as the roap state machine preserves
     * the order of the actions it runs once the offer has been created. Only the offer carries an
     * sdp — the same event delivers the OK and error messages of a negotiation this throwaway
     * connection never reaches.
     */
    connection.on(MediaConnectionEventNames.ROAP_MESSAGE_TO_SEND, (event: RoapMessageEvent) => {
      if (event.roapMessage.messageType === 'OFFER') {
        hostIps = getHostIpsFromSdp(event.roapMessage.sdp);
      }
    });

    await connection.initiateOffer();

    log.info(`Discovered ${hostIps.length} host ip(s)`, logContext);
  } catch (error) {
    hostIps = [];
    log.warn(`Host ip discovery failed: ${error}`, logContext);
  } finally {
    connection?.close();
  }
}
