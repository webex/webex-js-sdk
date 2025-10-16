import {Defer} from '@webex/common';

import LoggerProxy from '../common/logs/logger-proxy';
import {ClusterNode} from './request';
import {convertStunUrlToTurn, convertStunUrlToTurnTls, isIpAddress, parseStunUrl} from './util';
import EventsScope from '../common/events/events-scope';

import {
  CONNECTION_STATE,
  Enum,
  ICE_CANDIDATE_TYPES,
  ICE_GATHERING_STATE,
  PROTOCOLS_LIST,
  TURN_TLS_PORT,
  WEBEX_TURN_CREDENTIAL,
  WEBEX_TURN_USERNAME,
} from '../constants';
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
  private resolved: boolean = false;
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
      iceServers: [{ username: '', credential: '', urls: [url] }],
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
        const parsed = parseStunUrl(this.url);
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
    const timeoutMs = 3000; // 3 seconds, matching DEFAULT_TIMEOUT from index.ts
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
  private result: ClusterReachabilityResult; // Will include details array
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
  private udpStandardModeFirstCandidateProcessed: boolean = false; // Track if first UDP candidate processed in standard mode

  /**
   * Constructor for ClusterReachability
   * @param {string} name cluster name
   * @param {ClusterNode} clusterInfo information about the media cluster
   * @param {boolean} reachabilityEnablePerUrlForUdp flag to enable per-URL testing for UDP
   */
  constructor(name: string, clusterInfo: ClusterNode, reachabilityEnablePerUrlForUdp: boolean = false) {
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
    // Prefill details with IP addresses marked as unreachable
    this.prefillSubnetDetails();
  }

  /**
   * Prefill details arrays with IP addresses from STUN URLs, marked as unreachable
   * Only process IP addresses, skip domain names
   * @returns {void}
   */
  private prefillSubnetDetails() {
    PROTOCOLS_LIST.forEach(protocol => {
      const urls = this.clusterInfo[protocol] || [];
      
      urls.forEach((url) => {
        const parsed = parseStunUrl(url);
        if (parsed && isIpAddress(parsed.host)) {
          // Check if we already have this IP:port combination
          const existingDetail = this.result[protocol].details.find(
            (d: SubnetDetails) => d.serverIp === parsed.host && d.port === parsed.port
          );
          
          if (!existingDetail) {
            const detail: SubnetDetails = {
              port: parsed.port,
              'answered-tx': 0,
              'lost-tx': 1,
              latencies: [],
              serverIp: parsed.host,
            };
            this.result[protocol].details.push(detail);
          }
        }
      });
    });
  }

  /**
   * Update prefilled details when connection succeeds
   * @param {'udp' | 'tcp' | 'xtls'} protocol
   * @param {string} serverIp
   * @param {number} port - The port number for the connection
   * @param {number} latency
   * @returns {void}
   */
  private updateDetails(protocol: 'udp' | 'tcp' | 'xtls', serverIp: string, port: number, latency: number) {
    const details = this.result[protocol].details;
    
    
    // Find existing detail entry by serverIp and port
    const existingDetail = details.find((d: SubnetDetails) => d.serverIp === serverIp && d.port === port);
    
    if (existingDetail) {
      // Only update if this is a prefilled unreachable entry (answered-tx === 0)
      // If already reachable (answered-tx === 1), don't update to preserve first latency
      if (existingDetail['answered-tx'] === 0) {
        existingDetail['answered-tx'] = 1;
        existingDetail['lost-tx'] = 0;
        existingDetail.latencies = [latency];
      } else {
        LoggerProxy.logger.log(`clusterReachability.ts#updateDetails --> Skipped update for ${serverIp}:${port} (already reachable)`);
      }
    } else {
      // Add new entry for domains that resolved to IPs
      const newDetail: SubnetDetails = {
        port,
        'answered-tx': 1,
        'lost-tx': 0,
        latencies: [latency],
        serverIp: serverIp,
      };
      details.push(newDetail);
    }
  }

  /**
   * Gets total elapsed time, can be called only after start() is called
   * @returns {Number} Milliseconds
   */
  private getElapsedTime() {
    return Math.round(performance.now() - this.startTimestamp);
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
        username: WEBEX_TURN_USERNAME,
        credential: WEBEX_TURN_CREDENTIAL,
        urls: [convertStunUrlToTurn(urlString, 'tcp')],
      };
    });

    const turnTlsIceServers = cluster.xtls.map((urlString: string) => {
      return {
        username: WEBEX_TURN_USERNAME,
        credential: WEBEX_TURN_CREDENTIAL,
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
    this.perUrlCheckers.forEach(checker => checker.close());
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
        PROTOCOLS_LIST.forEach(protocol => {
          const result = this.result[protocol];
          // If protocol was never marked as reachable but has prefilled details, emit as unreachable
          if (result.result === 'unreachable' && result.details.length > 0) {
            result.result = 'unreachable';
            
            const eventData: ResultEventData = {
              protocol,
              result: 'unreachable',
              latencyInMilliseconds: 0,
              details: result.details,
            };
            
            this.emit(
              {
                file: 'clusterReachability',
                function: 'registerIceGatheringStateChangeListener',
              },
              Events.resultReady,
              eventData
            );
          }
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
      this.updateDetails(protocol, serverIp, port, latency);
    }

    const isFirstSuccess = result.latencyInMilliseconds === undefined;

    if (isFirstSuccess) {
      LoggerProxy.logger.log(
        // @ts-ignore
        `Reachability:index#saveResult --> Successfully reached ${this.name} over ${protocol}: ${latency}ms`
      );
      result.latencyInMilliseconds = latency;
      result.result = 'reachable';
      if (publicIp) {
        result.clientMediaIPs = [publicIp];
      }

      // Explicitly pass all properties instead of spreading to ensure details array is included
      const eventData: ResultEventData = {
        protocol,
        result: result.result,
        latencyInMilliseconds: result.latencyInMilliseconds,
        clientMediaIPs: result.clientMediaIPs,
        details: result.details, // Explicitly include details
      };

      this.emit(
        {
          file: 'clusterReachability',
          function: 'saveResult',
        },
        Events.resultReady,
        eventData
      );
      
    } else {
      // For subsequent candidates, collect public IPs but don't update latency
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
      const latencyInMilliseconds = this.getElapsedTime();

      if (e.candidate) {
        if (e.candidate.type === ICE_CANDIDATE_TYPES.SERVER_REFLEXIVE) {
          // In standard mode (not per-URL), only process the FIRST UDP candidate
          // All other responding subnets remain as prefilled unreachable entries
          if (!this.enablePerUrlUdpTesting && this.udpStandardModeFirstCandidateProcessed) {
            // Still collect public IPs for subsequent candidates
            this.addPublicIP('udp', e.candidate.address);
            this.determineNatType(e.candidate);
            return; // Don't process this candidate for subnet details
          }
          
          let serverIp = null;
          let port = null;
          
          // Try to extract server IP and port from candidate URL
          if ('url' in e.candidate) {
            const candidateUrl = (e.candidate as any).url;
            const parsed = parseStunUrl(candidateUrl);
            if (parsed.host && parsed.port) {
              serverIp = parsed.host;
              port = parsed.port;
            }
          }
          
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

        if (e.candidate.type === ICE_CANDIDATE_TYPES.RELAY) {
          const protocol = e.candidate.port === TURN_TLS_PORT ? 'xtls' : 'tcp';
          
          // For TCP/XTLS relay candidates, we need to determine the server IP and port
          let serverIp = null;
          let serverPort = null;
          
          // Try to extract from candidate URL first
          if ('url' in e.candidate) {
            const candidateUrl = (e.candidate as any).url;
            const parsed = parseStunUrl(candidateUrl);
            if (parsed.host && parsed.port && isIpAddress(parsed.host)) {
              // URL contains an IP address (typical for TCP)
              serverIp = parsed.host;
              serverPort = parsed.port;
            } else if (parsed.host && !isIpAddress(parsed.host)) {
              // URL contains domain name (typical for XTLS)
              // Use the relay address from candidate as the actual reached IP
              serverIp = e.candidate.address;
              serverPort = e.candidate.port;
            }
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

      return this.getResult();
    }

    // Initialize this.result as saying that nothing is reachable.
    // It will get updated as we go along and successfully gather ICE candidates.
    this.result.udp.result = this.numUdpUrls > 0 ? 'unreachable' : 'untested';
    this.result.tcp.result = this.numTcpUrls > 0 ? 'unreachable' : 'untested';
    this.result.xtls.result = this.numXTlsUrls > 0 ? 'unreachable' : 'untested';

    this.startTimestamp = performance.now();

    try {
      // Check for per-URL UDP testing (method handles its own enablement check)
      await this.checkPerUrlReachability();
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

    return this.getResult();
  }

  /**
   * Test each subnet URL individually when per-URL for any protocol testing is enabled
   * Uses SubnetReachabilityChecker for individual protocol's URL checking
   * Emits resultReady events after all per-URL tests complete
   * Note: Only UDP supports per-URL mode as of now - TCP/XTLS use standard batch testing
   * @returns {Promise<void>} Promise that resolves when all per-URL UDP tests complete
   */
  private async checkPerUrlReachability() {
    // Only proceed if UDP per-URL testing is specifically enabled
    if (!this.enablePerUrlUdpTesting) {
      return;
    }

    const udpPromises = this.clusterInfo.udp.map(url => {
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
    const udpResult = this.result.udp;
    if (udpResult.result === 'unreachable' && udpResult.details.length > 0) {
      // Emit unreachable result with prefilled details
      
      const eventData: ResultEventData = {
        protocol: 'udp',
        result: 'unreachable',
        latencyInMilliseconds: 0,
        details: udpResult.details,
      };
      
      this.emit(
        {
          file: 'clusterReachability',
          function: 'checkPerUrlReachability',
        },
        Events.resultReady,
        eventData
      );
    } else if (udpResult.result === 'reachable' && udpResult.details.length > 0) {
      // Some subnets were reachable - emit the mixed results
      
      const eventData: ResultEventData = {
        protocol: 'udp',
        result: 'reachable',
        latencyInMilliseconds: udpResult.latencyInMilliseconds || 0,
        clientMediaIPs: udpResult.clientMediaIPs,
        details: udpResult.details,
      };
      
      this.emit(
        {
          file: 'clusterReachability',
          function: 'checkPerUrlReachability',
        },
        Events.resultReady,
        eventData
      );
    }
  }

  /**
   * Starts the process of gathering ICE candidates for reachability checks
   * Registers listeners and implements a 5-second timeout to handle hung ICE gathering
   * Emits unreachable results with prefilled details when timeout is reached
   * @returns {Promise<void>} Promise that resolves when reachability checks complete or timeout is reached
   */
  private gatherIceCandidates(): Promise<void> {
    this.registerIceGatheringStateChangeListener();
    this.registerIceCandidateListener();

    // This block added to avoid timeout issue faced, can remove later
    // Add timeout to prevent indefinite waiting when ICE gathering hangs
    // This commonly happens when UDP is blocked by firewall
    const GATHERING_TIMEOUT_MS = 5000; // 5 seconds for ICE gathering
    
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        
        // Emit results for unreachable protocols with prefilled details before timeout
        PROTOCOLS_LIST.forEach(protocol => {
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
                function: 'gatherIceCandidates-timeout',
              },
              Events.resultReady,
              eventData
            );
          }
        });
        
        this.closePeerConnection();
        resolve();
      }, GATHERING_TIMEOUT_MS);
    });

    return Promise.race([this.defer.promise, timeoutPromise]);
  }
}
