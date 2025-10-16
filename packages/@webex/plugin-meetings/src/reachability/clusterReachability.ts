import {Defer} from '@webex/common';

import LoggerProxy from '../common/logs/logger-proxy';
import {ClusterNode} from './request';
import {
  convertStunUrlToTurn,
  convertStunUrlToTurnTls,
  isIpAddress,
  parseIceServerUrl,
} from './util';
import EventsScope from '../common/events/events-scope';

import {CONNECTION_STATE, Enum, ICE_GATHERING_STATE, PROTOCOLS_LIST} from '../constants';
import {ClusterReachabilityResult, NatType, SubnetDetails} from './reachability.types';

// data for the Events.resultReady event
export type ResultEventData = {
  protocol: 'udp' | 'tcp' | 'xtls';
  result: 'reachable' | 'unreachable' | 'untested';
  latencyInMilliseconds: number; // amount of time it took to get the ICE candidate
  clientMediaIPs?: string[];
  details: SubnetDetails[];
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
 * Class to handle individual URL reachability checking for any protocol
 */
class SubnetReachabilityChecker {
  private pc: RTCPeerConnection;
  private defer: Defer = new Defer();
  private resolved = false;
  private url: string;
  private onResult: (serverIp: string, port: number, latency: number, publicIp: string) => void;
  private getElapsedTime: () => number;

  /**
   * Constructor for SubnetReachabilityChecker
   * @param {string} url - The STUN/TURN URL to test for reachability
   * @param {Function} onResult - Callback function invoked when a successful ICE candidate is received
   * @param {Function} getElapsedTime - Function that returns elapsed time in milliseconds since test started
   */
  constructor(
    url: string,
    onResult: (serverIp: string, port: number, latency: number, publicIp: string) => void,
    getElapsedTime: () => number
  ) {
    this.url = url;
    this.onResult = onResult;
    this.getElapsedTime = getElapsedTime;

    this.pc = new RTCPeerConnection({
      iceServers: [{username: '', credential: '', urls: [url]}],
      iceCandidatePoolSize: 0,
      iceTransportPolicy: 'all',
    });
    this.setupListeners();
  }

  /**
   * Sets up event listeners for ICE candidate and gathering state changes
   * Processes srflx candidates and resolves when gathering is complete
   * @returns {void}
   */
  private setupListeners() {
    this.pc.onicecandidate = (e) => {
      if (e.candidate && e.candidate.type === 'srflx') {
        const latency = this.getElapsedTime();
        const parsed = parseIceServerUrl(this.url);
        if (parsed && isIpAddress(parsed.host)) {
          this.onResult(parsed.host, parsed.port, latency, e.candidate.address);
        }
      }
    };

    this.pc.onicegatheringstatechange = () => {
      if (this.pc.iceGatheringState === ICE_GATHERING_STATE.COMPLETE) {
        this.close();
      }
    };
  }

  /**
   * Starts the reachability check by creating an offer and triggering ICE gathering
   * Includes a 3-second timeout to prevent hanging on unreachable URLs
   * @returns {Promise<void>} Promise that resolves when check completes or times out
   */
  async start(): Promise<void> {
    const offer = await this.pc.createOffer({offerToReceiveAudio: true});
    this.pc.setLocalDescription(offer);

    // Add timeout to prevent hanging on unreachable subnets
    const timeoutMs = 3000;
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        this.close();
        resolve();
      }, timeoutMs);
    });

    await Promise.race([this.defer.promise, timeoutPromise]);
  }

  /**
   * Closes the peer connection and cleans up resources
   * Ensures cleanup happens only once and resolves the defer promise
   * @returns {void}
   */
  close() {
    if (!this.resolved) {
      this.resolved = true;
      this.pc.onicecandidate = null;
      this.pc.onicegatheringstatechange = null;
      this.pc.close();
      this.defer.resolve();
    }
  }
}

/**
 * A class that handles reachability checks for a single cluster.
 * It emits events from Events enum
 */
export class ClusterReachability extends EventsScope {
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
  public readonly reachedSubnets: Set<string> = new Set();
  private enablePerUrlUdpTesting: boolean;
  public readonly clusterInfo: ClusterNode;
  private perUrlCheckers: SubnetReachabilityChecker[] = [];
  private udpStandardModeFirstCandidateProcessed = false; // Track if first UDP candidate processed in standard mode

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
    this.enablePerUrlUdpTesting = reachabilityEnablePerUrlForUdp;

    this.pc = this.createPeerConnection(clusterInfo);

    this.defer = new Defer();

    // Initialize result with prefilled details for each protocol
    // Details are pre-populated with IP addresses from STUN URLs, marked as unreachable
    const createProtocolResult = (protocol: 'udp' | 'tcp' | 'xtls') => {
      const urls = this.clusterInfo[protocol] || [];
      const details: SubnetDetails[] = [];
      const seenIpPorts = new Set<string>();

      urls.forEach((url) => {
        const parsed = parseIceServerUrl(url);
        if (parsed && isIpAddress(parsed.host)) {
          const key = `${parsed.host}:${parsed.port}`;
          if (!seenIpPorts.has(key)) {
            seenIpPorts.add(key);
            details.push({
              port: parsed.port,
              'answered-tx': 0,
              'lost-tx': 1,
              latencies: [],
              serverIp: parsed.host,
            });
          }
        }
      });

      return {
        result: 'untested' as const,
        details,
      };
    };

    this.result = {
      udp: createProtocolResult('udp'),
      tcp: createProtocolResult('tcp'),
      xtls: createProtocolResult('xtls'),
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
   * Helper method to emit resultReady event with consistent structure
   * @param {string} protocol - The protocol being tested ('udp', 'tcp', or 'xtls')
   * @param {string} functionName - The name of the calling function for logging
   * @returns {void}
   */
  private emitResultReadyEvent(protocol: 'udp' | 'tcp' | 'xtls', functionName: string): void {
    const result = this.result[protocol];

    if (result.result === 'unreachable' && result.details.length > 0) {
      const eventData: ResultEventData = {
        protocol,
        result: 'unreachable',
        latencyInMilliseconds: 0,
        details: result.details,
      };

      this.emit(
        {
          file: 'clusterReachability',
          function: functionName,
        },
        Events.resultReady,
        eventData
      );
    } else if (result.result === 'reachable' && result.details.length > 0) {
      const eventData: ResultEventData = {
        protocol,
        result: 'reachable',
        latencyInMilliseconds: result.latencyInMilliseconds || 0,
        clientMediaIPs: result.clientMediaIPs,
        details: result.details,
      };

      this.emit(
        {
          file: 'clusterReachability',
          function: functionName,
        },
        Events.resultReady,
        eventData
      );
    }
  }

  /**
   * Extract server IP and port from ICE candidate URL
   * @param {RTCIceCandidate} candidate - The ICE candidate
   * @returns {{serverIp: (string|null), port: (number|null)}} Extracted server info
   */
  private extractServerInfoFromCandidate(candidate: RTCIceCandidate): {
    serverIp: string | null;
    port: number | null;
  } {
    let serverIp = null;
    let port = null;

    if ('url' in candidate) {
      const candidateUrl = (candidate as any).url;
      const parsed = parseIceServerUrl(candidateUrl);
      if (parsed?.host && parsed?.port) {
        serverIp = parsed.host;
        port = parsed.port;
      }
    }

    return {serverIp, port};
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

    // Clean up per-URL checkers
    this.perUrlCheckers.forEach((checker) => checker.close());
    this.perUrlCheckers = [];

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
        // Emit results for unreachable protocols with prefilled details
        PROTOCOLS_LIST.forEach((protocol) => {
          this.emitResultReadyEvent(protocol, 'registerIceGatheringStateChangeListener');
        });

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

    // Update details if we have server info
    if (serverIp && port) {
      const {details} = this.result[protocol];
      const existingDetail = details.find(
        (d: SubnetDetails) => d.serverIp === serverIp && d.port === port
      );

      if (existingDetail) {
        // Only update if this is a prefilled unreachable entry (answered-tx === 0)
        // If already reachable (answered-tx === 1), don't update to preserve first latency
        if (existingDetail['answered-tx'] === 0) {
          existingDetail['answered-tx'] = 1;
          existingDetail['lost-tx'] = 0;
          existingDetail.latencies = [latency];
        }
      } else {
        // Add new entry for domains that resolved to IPs
        details.push({
          port,
          'answered-tx': 1,
          'lost-tx': 0,
          latencies: [latency],
          serverIp,
        });
      }
    }

    if (result.latencyInMilliseconds === undefined) {
      LoggerProxy.logger.log(
        // @ts-ignore
        `Reachability:index#saveResult --> Successfully reached ${this.name} over ${protocol}: ${latency}ms`
      );
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

      const latencyInMilliseconds = this.getElapsedTime();

      if (!e.candidate) {
        return;
      }

      if (e.candidate.type === CANDIDATE_TYPES.SERVER_REFLEXIVE) {
        if (!this.enablePerUrlUdpTesting && this.udpStandardModeFirstCandidateProcessed) {
          this.addPublicIP('udp', e.candidate.address);
          this.determineNatType(e.candidate);

          return;
        }

        let {serverIp, port} = this.extractServerInfoFromCandidate(e.candidate);

        // Fallback: Use first prefilled entry if URL extraction failed
        // In standard mode (not per-URL), we don't know which server responded,
        // so we mark the first one as reachable
        if (!serverIp && this.result.udp.details.length > 0) {
          const firstDetail = this.result.udp.details[0];
          serverIp = firstDetail.serverIp;
          port = firstDetail.port;
        }

        this.saveResult('udp', latencyInMilliseconds, e.candidate.address, serverIp, port);

        // Mark that we've processed the first candidate in standard mode
        if (!this.enablePerUrlUdpTesting) {
          this.udpStandardModeFirstCandidateProcessed = true;
        }

        this.determineNatType(e.candidate);
      }

      // Handle TCP/XTLS (relay) candidates
      if (e.candidate.type === CANDIDATE_TYPES.RELAY) {
        const protocol = e.candidate.port === TURN_TLS_PORT ? 'xtls' : 'tcp';

        let {serverIp, port: serverPort} = this.extractServerInfoFromCandidate(e.candidate);

        if (serverIp && !isIpAddress(serverIp)) {
          serverIp = e.candidate.address;
          serverPort = e.candidate.port;
        }

        // Fallback: Use relay address if URL extraction failed
        if (!serverIp) {
          serverIp = e.candidate.address;
          serverPort = e.candidate.port;
        }

        // For TCP with prefilled IP entries, check if this matches any prefilled entry
        if (protocol === 'tcp') {
          const unreachableDetails = this.result[protocol].details.filter(
            (d: SubnetDetails) => d['answered-tx'] === 0
          );

          if (unreachableDetails.length > 0) {
            // Mark all prefilled TCP entries as reachable (conservative approach)
            unreachableDetails.forEach((detail: SubnetDetails) => {
              this.saveResult(protocol, latencyInMilliseconds, null, detail.serverIp, detail.port);
            });
          } else {
            // No prefilled entries, create new one with relay IP
            this.saveResult(protocol, latencyInMilliseconds, null, serverIp, serverPort);
          }
        } else {
          // For XTLS, always create new entry with the relay IP (since URLs are domain names, no prefilled entries)
          this.saveResult(protocol, latencyInMilliseconds, null, serverIp, serverPort);
        }
      }
    };
  }

  /**
   * Starts the process of doing UDP and TCP reachability checks on the media cluster.
   * XTLS reachability checking is not supported.
   *
   * @returns {Promise}
   */
  async start(): Promise<ClusterReachabilityResult> {
    if (!this.pc && !this.enablePerUrlUdpTesting) {
      LoggerProxy.logger.warn(
        `Reachability:ClusterReachability#start --> Error: peerConnection is undefined`
      );

      return this.result;
    }

    // Initialize this.result as saying that nothing is reachable.
    // It will get updated as we go along and successfully gather ICE candidates.
    this.result.udp.result = this.numUdpUrls > 0 ? 'unreachable' : 'untested';
    this.result.tcp.result = this.numTcpUrls > 0 ? 'unreachable' : 'untested';
    this.result.xtls.result = this.numXTlsUrls > 0 ? 'unreachable' : 'untested';

    this.startTimestamp = performance.now();

    try {
      // Test each UDP URL individually when per-URL testing is enabled
      if (this.enablePerUrlUdpTesting) {
        const udpPromises = this.clusterInfo.udp.map((url) => {
          const checker = new SubnetReachabilityChecker(
            url,
            (serverIp, port, latency, publicIp) => {
              this.saveResult('udp', latency, publicIp, serverIp, port);
            },
            () => this.getElapsedTime()
          );

          this.perUrlCheckers.push(checker);

          return checker.start();
        });

        await Promise.all(udpPromises);

        // After all per-URL UDP tests complete, emit results with prefilled details
        // This ensures unreachable subnets are reported even if no ICE candidates were received
        this.emitResultReadyEvent('udp', 'start');
      }

      // Always test TCP/XTLS normally, and UDP if per-URL is disabled
      if (!this.enablePerUrlUdpTesting || this.numTcpUrls > 0 || this.numXTlsUrls > 0) {
        const offer = await this.pc.createOffer({offerToReceiveAudio: true});

        // Set up the state change listeners before triggering the ICE gathering
        const gatherIceCandidatePromise = this.gatherIceCandidates();

        // not awaiting the next call on purpose, because we're not sending the offer anywhere and there won't be any answer
        // we just need to make this call to trigger the ICE gathering process
        this.pc.setLocalDescription(offer);

        await gatherIceCandidatePromise;
      }
    } catch (error) {
      LoggerProxy.logger.warn(`Reachability:ClusterReachability#start --> Error: `, error);
    }

    return this.result;
  }

  /**
   * Starts the process of gathering ICE candidates
   *
   * @returns {Promise<void>} A promise that resolves when reachability checks for this cluster are completed or timeout is reached
   */
  private gatherIceCandidates(): Promise<void> {
    this.registerIceGatheringStateChangeListener();
    this.registerIceCandidateListener();
    // This block added to avoid timeout issue faced, can remove later
    // Add timeout to prevent indefinite waiting when ICE gathering hangs
    // This commonly happens when UDP is blocked by firewall
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        // Emit results for unreachable protocols with prefilled details before timeout
        PROTOCOLS_LIST.forEach((protocol) => {
          this.emitResultReadyEvent(protocol, 'gatherIceCandidates-timeout');
        });

        this.closePeerConnection();
        resolve();
      }, 5000);
    });

    return Promise.race([this.defer.promise, timeoutPromise]);
  }
}
