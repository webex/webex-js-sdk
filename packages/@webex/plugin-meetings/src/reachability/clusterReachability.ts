import {Defer} from '@webex/common';

import LoggerProxy from '../common/logs/logger-proxy';
import {convertStunUrlToTurn, convertStunUrlToTurnTls, parseStunUrl, isIpAddress} from './util';
import EventsScope from '../common/events/events-scope';

import {
  CONNECTION_STATE,
  Enum,
  ICE_GATHERING_STATE,
  PROTOCOLS_LIST,
  STUN_GENERIC_URL_REGEX,
} from '../constants';
import {ClusterReachabilityResult, NatType, SubnetDetails, ClusterNode} from './reachability.types';

// data for the Events.resultReady event
export type ResultEventData = {
  protocol: 'udp' | 'tcp' | 'xtls';
  result: 'reachable' | 'unreachable' | 'untested';
  latencyInMilliseconds: number; // amount of time it took to get the ICE candidate
  clientMediaIPs?: string[];
  details?: SubnetDetails[];
};

// data for the Events.clientMediaIpsUpdated event
export type ClientMediaIpsUpdatedEventData = {
  protocol: 'udp' | 'tcp' | 'xtls';
  clientMediaIPs: string[];
};

export type NatTypeUpdatedEventData = {
  natType: NatType;
};

export const Events = {
  resultReady: 'resultReady', // emitted when a cluster is reached successfully using specific protocol
  clientMediaIpsUpdated: 'clientMediaIpsUpdated', // emitted when more public IPs are found after resultReady was already sent for a given protocol
  natTypeUpdated: 'natTypeUpdated', // emitted when NAT type is determined
} as const;

export type Events = Enum<typeof Events>;

/**
 * A class that handles reachability checks for a single cluster.
 * It emits events from Events enum
 */
export class ClusterReachability extends EventsScope {
  // Regex pattern for parsing STUN URLs in ICE candidates
  private static readonly STUN_CANDIDATE_URL_REGEX = /^stun:([^:]+):(\d+)$/;

  private numUdpUrls: number;
  private numTcpUrls: number;
  private numXTlsUrls: number;
  private result: ClusterReachabilityResult;
  private pc?: RTCPeerConnection;
  private defer: Defer; // this defer is resolved once reachability checks for this cluster are completed
  private startTimestamp: number;
  private srflxIceCandidates: RTCIceCandidate[] = [];
  public readonly isVideoMesh: boolean;
  public readonly name;
  public clusterInfo: ClusterNode;
  public readonly reachedSubnets: Set<string> = new Set();
  private reachabilityEnablePerUrlForUdp: boolean;
  private perUrlPeerConnections: Map<string, RTCPeerConnection> = new Map();
  private perUrlResults: Map<
    string,
    {
      protocol: string;
      details: SubnetDetails[];
      latency?: number;
      clientIPs?: string[];
      reachedSubnets: Set<string>;
    }
  > = new Map();

  /**
   * Constructor for ClusterReachability
   * @param {string} name cluster name
   * @param {ClusterNode} clusterInfo information about the media cluster
   * @param {boolean} reachabilityEnablePerUrlForUdp flag to enable per-URL testing for UDP
   */
  constructor(name: string, clusterInfo: ClusterNode, reachabilityEnablePerUrlForUdp = false) {
    super();
    this.name = name;
    this.isVideoMesh = clusterInfo.isVideoMesh;
    this.numUdpUrls = clusterInfo.udp.length;
    this.numTcpUrls = clusterInfo.tcp.length;
    this.numXTlsUrls = clusterInfo.xtls.length;
    this.clusterInfo = clusterInfo;
    this.reachabilityEnablePerUrlForUdp = reachabilityEnablePerUrlForUdp;

    this.pc = this.createPeerConnection(clusterInfo);

    this.defer = new Defer();
    this.result = {
      udp: {
        result: 'untested',
        details: [],
      },
      tcp: {
        result: 'untested',
        details: [],
      },
      xtls: {
        result: 'untested',
        details: [],
      },
    };
  }

  /**
   * Gets total elapsed time, can be called only after start() is called
   * @returns {Number} Milliseconds
   */
  private getElapsedTime() {
    return Math.round(performance.now() - this.startTimestamp);
  }

  /**
   * Prefills all URLs as unreachable initially for analytics tracking
   * Successful domain entries are cleaned up later, keeping only failed attempts
   * @returns {void}
   */
  private prepopulateUnreachableDetails() {
    if (this.reachabilityEnablePerUrlForUdp) {
      return; // Skip in per-URL mode
    }

    PROTOCOLS_LIST.forEach((protocol: 'udp' | 'tcp' | 'xtls') => {
      const urls = this.clusterInfo[protocol] || [];

      // Only prefill IP addresses as unreachable initially
      // Domain names will be added during testing only if they succeed
      urls.forEach((url) => {
        try {
          // Parse STUN URLs manually since they don't work with standard URL constructor
          // Format: stun:hostname:port or stun:ip:port
          let hostname = '';
          let port = '';

          // Use the comprehensive STUN URL regex for parsing
          const stunMatch = url.match(STUN_GENERIC_URL_REGEX);
          if (stunMatch) {
            const [, , host, portStr] = stunMatch; // destructure: [full, protocol, host, port]
            hostname = host;
            port = portStr;
          } else {
            // Fallback to standard URL parsing for other protocols
            try {
              const parsed = new URL(url);
              hostname = parsed.hostname;
              port = parsed.port;
            } catch {
              // Skip malformed URLs
              return;
            }
          }

          // Skip URLs without explicit ports - we can't make assumptions about default ports
          if (!port) {
            return; // Skip this URL entirely if no port is specified
          }

          // Only prefill if hostname is an IP address (IPv4 or IPv6)
          if (!isIpAddress(hostname)) {
            return; // Skip domain names - they'll be added only if successful during testing
          }

          // Adjust ports for TCP/XTLS since they use TURN protocol with different ports
          let actualPort = parseInt(port, 10);
          if (protocol === 'xtls') {
            actualPort = 443; // XTLS always uses port 443 (TURN_TLS_PORT)
          }
          // TCP uses the original port from STUN URL

          // Prefill only IP addresses as unreachable initially
          const entry = {
            port: actualPort,
            'answered-tx': 0,
            'lost-tx': 1,
            latencies: [],
            serverIp: hostname, // IP address only
          };
          this.result[protocol].details!.push(entry);
        } catch (e) {
          // Ignore malformed URLs
        }
      });
    });
  }

  /**
   * Generate peerConnection config settings
   * @param {ClusterNode} cluster
   * @returns {RTCConfiguration} peerConnectionConfig
   */
  private buildPeerConnectionConfig(cluster: ClusterNode): RTCConfiguration {
    const udpIceServers = cluster.udp.map((url) => ({
      username: '',
      credential: '',
      urls: [url],
    }));

    // STUN servers are contacted only using UDP, so in order to test TCP reachability
    // we pretend that Linus is a TURN server, because we can explicitly say "transport=tcp" in TURN urls.
    // We then check for relay candidates to know if TURN-TCP worked (see registerIceCandidateListener()).
    const tcpIceServers = cluster.tcp.map((urlString: string) => {
      return {
        username: 'webexturnreachuser',
        credential: 'webexturnreachpwd',
        urls: [convertStunUrlToTurn(urlString, 'tcp')],
      };
    });

    const turnTlsIceServers = cluster.xtls.map((urlString: string) => {
      return {
        username: 'webexturnreachuser',
        credential: 'webexturnreachpwd',
        urls: [convertStunUrlToTurnTls(urlString)],
      };
    });

    return {
      iceServers: [...udpIceServers, ...tcpIceServers, ...turnTlsIceServers],
      iceCandidatePoolSize: 0,
      iceTransportPolicy: 'all',
    };
  }

  /**
   * Creates an RTCPeerConnection
   * @param {ClusterNode} clusterInfo information about the media cluster
   * @returns {RTCPeerConnection} peerConnection
   */
  private createPeerConnection(clusterInfo: ClusterNode) {
    try {
      const config = this.buildPeerConnectionConfig(clusterInfo);

      const peerConnection = new RTCPeerConnection(config);

      return peerConnection;
    } catch (peerConnectionError) {
      LoggerProxy.logger.warn(
        `Reachability:index#createPeerConnection --> Error creating peerConnection:`,
        peerConnectionError
      );

      return undefined;
    }
  }

  /**
   * @returns {ClusterReachabilityResult} reachability result for this cluster
   */
  getResult() {
    return this.result;
  }

  /**
   * Closes the peerConnection
   *
   * @returns {void}
   */
  private closePeerConnection() {
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.onicegatheringstatechange = null;
      this.pc.close();
    }
  }

  /**
   * Removes domain name entries that were successfully reached
   * Keeps only failed domain attempts and all IP entries for analytics
   */
  /**
   * Resolves the defer, indicating that reachability checks for this cluster are completed
   *
   * @returns {void}
   */
  private finishReachabilityCheck() {
    this.defer.resolve();
  }

  /**
   * Aborts the cluster reachability checks by closing the peer connection
   *
   * @returns {void}
   */
  public abort() {
    const {CLOSED} = CONNECTION_STATE;

    // Abort any per-URL peer connections
    this.perUrlPeerConnections.forEach((pc) => {
      if (pc.connectionState !== CLOSED) {
        pc.close();
      }
    });
    this.perUrlPeerConnections.clear();
    this.perUrlResults.clear();

    if (this.pc && this.pc.connectionState !== CLOSED) {
      this.closePeerConnection();
      this.finishReachabilityCheck();
    }
  }

  /**
   * Adds public IP (client media IPs)
   * @param {string} protocol
   * @param {string} publicIP
   * @returns {void}
   */
  private addPublicIP(protocol: 'udp' | 'tcp' | 'xtls', publicIP?: string | null) {
    const result = this.result[protocol];

    if (publicIP) {
      let ipAdded = false;

      if (result.clientMediaIPs) {
        if (!result.clientMediaIPs.includes(publicIP)) {
          result.clientMediaIPs.push(publicIP);
          ipAdded = true;
        }
      } else {
        result.clientMediaIPs = [publicIP];
        ipAdded = true;
      }

      if (ipAdded)
        this.emit(
          {
            file: 'clusterReachability',
            function: 'addPublicIP',
          },
          Events.clientMediaIpsUpdated,
          {
            protocol,
            clientMediaIPs: result.clientMediaIPs,
          }
        );
    }
  }

  /**
   * Registers a listener for the iceGatheringStateChange event
   *
   * @returns {void}
   */
  private registerIceGatheringStateChangeListener() {
    this.pc.onicegatheringstatechange = () => {
      if (this.pc.iceGatheringState === ICE_GATHERING_STATE.COMPLETE) {
        this.closePeerConnection();
        this.finishReachabilityCheck();
      }
    };
  }

  /**
   * Saves the latency in the result for the given protocol and marks it as reachable,
   * emits the "resultReady" event if this is the first result for that protocol,
   * emits the "clientMediaIpsUpdated" event if we already had a result and only found
   * a new client IP
   *
   * @param {string} protocol
   * @param {number} latency
   * @param {string|null} [publicIp]
   * @param {string|null} [serverIp]
   * @param {number} [port]
   * @returns {void}
   */
  private saveResult(
    protocol: 'udp' | 'tcp' | 'xtls',
    latency: number,
    publicIp?: string | null,
    serverIp?: string | null,
    port?: number
  ) {
    const result = this.result[protocol];
    const isFirstSuccess = result.latencyInMilliseconds === undefined;

    // Skip if UDP already reachable in standard mode
    if (
      !this.reachabilityEnablePerUrlForUdp &&
      protocol === 'udp' &&
      result.result === 'reachable'
    ) {
      this.addPublicIP(protocol, publicIp);
      if (serverIp) this.reachedSubnets.add(serverIp);

      return;
    }

    // Add or update subnet details
    if (serverIp && port) {
      if (!result.details) result.details = [];

      // Find detail by BOTH serverIp AND port
      const detail = result.details.find((d) => d.serverIp === serverIp && d.port === port);
      if (detail && detail['answered-tx'] === 0) {
        // Update prefilled unreachable entry
        detail['answered-tx'] = 1;
        detail['lost-tx'] = 0;
        detail.latencies = [latency];
      } else if (!detail) {
        // Create new entry
        result.details.push({
          port,
          'answered-tx': 1,
          'lost-tx': 0,
          latencies: [latency],
          serverIp,
        });
      }
    }

    // Mark protocol as reachable and emit event (skip per-URL UDP mode)
    if (isFirstSuccess && !(this.reachabilityEnablePerUrlForUdp && protocol === 'udp')) {
      result.latencyInMilliseconds = latency;
      result.result = 'reachable';
      if (publicIp) {
        result.clientMediaIPs = [publicIp];
      }

      this.emit(
        {
          file: 'clusterReachability',
          function: 'saveResult',
        },
        Events.resultReady,
        {
          protocol,
          ...result,
        }
      );
    } else {
      this.addPublicIP(protocol, publicIp);
    }

    if (serverIp) {
      this.reachedSubnets.add(serverIp);
    }
  }

  /**
   * Determines NAT Type.
   *
   * @param {RTCIceCandidate} candidate
   * @returns {void}
   */
  private determineNatType(candidate: RTCIceCandidate) {
    this.srflxIceCandidates.push(candidate);

    if (this.srflxIceCandidates.length > 1) {
      const portsFound: Record<string, Set<number>> = {};

      this.srflxIceCandidates.forEach((c) => {
        const key = `${c.address}:${c.relatedPort}`;
        if (!portsFound[key]) {
          portsFound[key] = new Set();
        }
        portsFound[key].add(c.port);
      });

      Object.entries(portsFound).forEach(([, ports]) => {
        if (ports.size > 1) {
          // Found candidates with the same address and relatedPort, but different ports
          this.emit(
            {
              file: 'clusterReachability',
              function: 'determineNatType',
            },
            Events.natTypeUpdated,
            {
              natType: NatType.SymmetricNat,
            }
          );
        }
      });
    }
  }

  /**
   * Registers a listener for the icecandidate event
   *
   * @returns {void}
   */
  private registerIceCandidateListener() {
    this.pc.onicecandidate = (e) => {
      const TURN_TLS_PORT = 443;
      const CANDIDATE_TYPES = {
        SERVER_REFLEXIVE: 'srflx',
        RELAY: 'relay',
      };
      if (!e.candidate) return;

      const latencyInMilliseconds = this.getElapsedTime();

      if (e.candidate.type === CANDIDATE_TYPES.SERVER_REFLEXIVE) {
        // Extract server IP from candidate URL or use fallback
        let serverIp = null;
        let candidatePort = null;

        if ((e.candidate as any).url) {
          const match = (e.candidate as any).url.match(
            ClusterReachability.STUN_CANDIDATE_URL_REGEX
          );
          if (match) {
            const [, host, portStr] = match; // destructure: [full, host, port]
            serverIp = host;
            candidatePort = parseInt(portStr, 10);
          }
        }

        // If we can't extract server IP from candidate URL, try to intelligently match
        if (!serverIp && this.result.udp.details?.length > 0) {
          // In standard mode, we have prefilled entries - try to find best match
          if (!this.reachabilityEnablePerUrlForUdp) {
            // Try to find an unreachable entry that could match this candidate
            const unreachableEntries = this.result.udp.details.filter(
              (d) => d['answered-tx'] === 0
            );

            if (unreachableEntries.length > 0) {
              // Use the first unreachable entry as fallback
              serverIp = unreachableEntries[0].serverIp;
            }
          }
        }

        if (!this.reachabilityEnablePerUrlForUdp) {
          // For UDP, we need the actual STUN port, not the candidate's relatedPort
          let stunPort;
          if ((e.candidate as any).url) {
            const match = (e.candidate as any).url.match(
              ClusterReachability.STUN_CANDIDATE_URL_REGEX
            );
            if (match) {
              const [, , portStr] = match; // destructure: [full, host, port]
              stunPort = parseInt(portStr, 10);
            }
          }

          // If we can't get port from candidate URL, try to find matching prefilled entry
          if (!stunPort && serverIp && this.result.udp.details?.length > 0) {
            const matchingEntry = this.result.udp.details.find(
              (d) => d.serverIp === serverIp && d['answered-tx'] === 0
            );
            if (matchingEntry) {
              stunPort = matchingEntry.port;
            }
          }

          this.saveResult('udp', latencyInMilliseconds, e.candidate.address, serverIp, stunPort);
        }

        if (serverIp) this.reachedSubnets.add(serverIp);
        this.determineNatType(e.candidate);
      }

      if (e.candidate.type === CANDIDATE_TYPES.RELAY) {
        const protocol = e.candidate.port === TURN_TLS_PORT ? 'xtls' : 'tcp';
        this.saveResult(
          protocol,
          latencyInMilliseconds,
          null,
          e.candidate.address,
          e.candidate.port
        );
      }
    };
  }

  /**
   * Starts the process of doing UDP and TCP reachability checks on the media cluster.
   *
   * @returns {Promise}
   */
  async start(): Promise<ClusterReachabilityResult> {
    // Initialize protocols as unreachable/untested based on URL availability
    this.result.udp = {
      result: this.numUdpUrls > 0 ? 'unreachable' : 'untested',
      details: [],
    };
    this.result.tcp = {
      result: this.numTcpUrls > 0 ? 'unreachable' : 'untested',
      details: [],
    };
    this.result.xtls = {
      result: this.numXTlsUrls > 0 ? 'unreachable' : 'untested',
      details: [],
    };

    // Populate unreachable details AFTER initializing empty arrays
    this.prepopulateUnreachableDetails();

    this.startTimestamp = performance.now();

    if (this.reachabilityEnablePerUrlForUdp) {
      // Per-URL mode for UDP: Test each UDP URL individually for granular results
      if (this.clusterInfo.udp.length > 0) {
        const udpPromises = this.clusterInfo.udp.map((url) => this.testSingleUrl('udp', url));
        await Promise.all(udpPromises);

        // Process UDP per-URL results
        this.processPerUrlResults();
      }
    }

    // Standard mode for TCP/XTLS (always) and UDP (when per-URL is disabled)
    const needsStandardMode =
      (!this.reachabilityEnablePerUrlForUdp && this.clusterInfo.udp.length > 0) ||
      this.clusterInfo.tcp.length > 0 ||
      this.clusterInfo.xtls.length > 0;

    if (needsStandardMode && this.pc) {
      try {
        const offer = await this.pc.createOffer({offerToReceiveAudio: true});

        // Set up the state change listeners before triggering the ICE gathering
        const gatherIceCandidatePromise = this.gatherIceCandidates();

        // not awaiting the next call on purpose, because we're not sending the offer anywhere and there won't be any answer
        // we just need to make this call to trigger the ICE gathering process
        this.pc.setLocalDescription(offer);

        await gatherIceCandidatePromise;
      } catch (error) {
        LoggerProxy.logger.warn(`Reachability:ClusterReachability#start --> Error: `, error);
      }
    }

    return this.result;
  }

  /**
   * Tests a single URL for reachability in per-URL mode
   * @param {string} protocol - The protocol to test (currently only 'udp')
   * @param {string} url - The URL to test
   * @returns {Promise<void>} Promise that resolves when testing is complete
   */
  private async testSingleUrl(protocol: 'udp', url: string): Promise<void> {
    const {host, port} = parseStunUrl(url);
    if (!host || !port) {
      return Promise.resolve(); // Explicit return for early exit
    }

    const urlKey = `${protocol}-${url}`;
    const details = isIpAddress(host)
      ? [{port, 'answered-tx': 0, 'lost-tx': 1, latencies: [], serverIp: host}]
      : [];

    this.perUrlResults.set(urlKey, {protocol, details, reachedSubnets: new Set()});

    return new Promise((resolve) => {
      const pc = new RTCPeerConnection({
        iceServers: [{username: '', credential: '', urls: [url]}],
        iceCandidatePoolSize: 0,
        iceTransportPolicy: 'all',
      });

      pc.onicecandidate = (e) => this.handlePerUrlIceCandidate(e, urlKey);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === ICE_GATHERING_STATE.COMPLETE) {
          pc.close();
          resolve();
        }
      };

      this.perUrlPeerConnections.set(urlKey, pc);

      pc.createOffer({offerToReceiveAudio: true})
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => resolve());

      setTimeout(resolve, 5000);
    });
  }

  private handlePerUrlIceCandidate(e: RTCPeerConnectionIceEvent, urlKey: string) {
    if (!e.candidate || e.candidate.type !== 'srflx') return;

    const result = this.perUrlResults.get(urlKey);
    if (!result) return;

    const latency = this.getElapsedTime();

    if (!result.latency) result.latency = latency;

    // Track client IP
    if (e.candidate.address) {
      if (!result.clientIPs) result.clientIPs = [];
      if (!result.clientIPs.includes(e.candidate.address)) {
        result.clientIPs.push(e.candidate.address);
      }
    }

    // Extract port from the actual STUN URL in the urlKey, not from candidate
    const urlMatch = urlKey.match(/^udp-stun:[^:]+:(\d+)$/);
    let port;
    if (urlMatch) {
      const [, portStr] = urlMatch; // destructure: [full, port]
      port = parseInt(portStr, 10);
    }
    if (!port) return;

    let serverIp = null;
    if ((e.candidate as any).url) {
      const match = (e.candidate as any).url.match(ClusterReachability.STUN_CANDIDATE_URL_REGEX);
      if (match) {
        const [, host] = match; // destructure: [full, host, port]
        serverIp = host;
      }
    }
    if (!serverIp && result.details.length > 0) {
      const unreachable = result.details.find((d) => d['answered-tx'] === 0);
      if (unreachable) serverIp = unreachable.serverIp;
    }

    if (serverIp) {
      result.reachedSubnets.add(serverIp);
      if (!result.details) result.details = [];

      const detail = result.details.find((d) => d.serverIp === serverIp && d.port === port);
      if (detail && detail['answered-tx'] === 0) {
        detail['answered-tx'] = 1;
        detail['lost-tx'] = 0;
        detail.latencies = [latency];
      } else if (!detail) {
        result.details.push({
          port,
          'answered-tx': 1,
          'lost-tx': 0,
          latencies: [latency],
          serverIp,
        });
      }
    }
  }

  private processPerUrlResults() {
    if (!this.reachabilityEnablePerUrlForUdp) {
      return;
    }

    const combined = {details: [], latency: undefined, clientIPs: []};

    this.perUrlResults.forEach((urlResult) => {
      if (urlResult.protocol !== 'udp') return;

      urlResult.reachedSubnets.forEach((subnet) => this.reachedSubnets.add(subnet));
      combined.details.push(...urlResult.details);

      if (urlResult.latency && (!combined.latency || urlResult.latency < combined.latency)) {
        combined.latency = urlResult.latency;
      }

      if (urlResult.clientIPs) {
        urlResult.clientIPs.forEach((ip) => {
          if (!combined.clientIPs.includes(ip)) combined.clientIPs.push(ip);
        });
      }
    });

    const udpResult = this.result.udp;
    udpResult.details = combined.details;

    if (combined.latency) {
      // Calculate minimum latency from successful entries
      const allLatencies = combined.details
        .filter((d) => d['answered-tx'] > 0)
        .flatMap((d) => d.latencies);
      const minLatency = allLatencies.length > 0 ? Math.min(...allLatencies) : combined.latency;

      udpResult.result = 'reachable';
      udpResult.latencyInMilliseconds = minLatency;
      udpResult.clientMediaIPs = combined.clientIPs;
    }

    this.emit({file: 'clusterReachability', function: 'processPerUrlResults'}, Events.resultReady, {
      protocol: 'udp',
      result: udpResult.result,
      latencyInMilliseconds: udpResult.latencyInMilliseconds || 0,
      clientMediaIPs: udpResult.clientMediaIPs,
      details: udpResult.details,
    });
  }

  /**
   * Starts the process of gathering ICE candidates
   *
   * @returns {Promise} promise that's resolved once reachability checks for this cluster are completed or timeout is reached
   */
  private gatherIceCandidates() {
    this.registerIceGatheringStateChangeListener();
    this.registerIceCandidateListener();

    return this.defer.promise;
  }
}
