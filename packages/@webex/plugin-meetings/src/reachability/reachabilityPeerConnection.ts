import {Defer} from '@webex/common';

import LoggerProxy from '../common/logs/logger-proxy';
import {ClusterNode} from './request';
import {
  convertStunUrlToTurn,
  convertStunUrlToTurnTls,
  parseIceServerUrl,
  isIpAddress,
  prepopulateSubnetDetails,
} from './util';
import EventsScope from '../common/events/events-scope';

import {CONNECTION_STATE, ICE_GATHERING_STATE} from '../constants';
import {
  ClusterReachabilityResult,
  NatType,
  Protocol,
  ReachabilityPeerConnectionEvents,
  SubnetDetail,
} from './reachability.types';

/**
 * A class to handle RTCPeerConnection lifecycle and ICE candidate gathering for reachability checks.
 * It will do all the work like PeerConnection lifecycle, candidate processing, result management, and event emission.
 */
export class ReachabilityPeerConnection extends EventsScope {
  public numUdpUrls: number;
  public numTcpUrls: number;
  public numXTlsUrls: number;
  private pc: RTCPeerConnection | null;
  private defer: Defer;
  private startTimestamp: number;
  private srflxIceCandidates: RTCIceCandidate[] = [];
  private clusterName: string;
  private result: ClusterReachabilityResult;
  private emittedSubnets: Set<string> = new Set();
  private udpFirstCandidateProcessed = false; // Track if first UDP candidate processed in standard mode

  /**
   * Constructor for ReachabilityPeerConnection
   * @param {string} clusterName name of the cluster
   * @param {ClusterNode} clusterInfo information about the media cluster
   */
  constructor(clusterName: string, clusterInfo: ClusterNode) {
    super();
    this.clusterName = clusterName;
    this.numUdpUrls = clusterInfo.udp.length;
    this.numTcpUrls = clusterInfo.tcp.length;
    this.numXTlsUrls = clusterInfo.xtls.length;

    this.pc = this.createPeerConnection(clusterInfo);

    this.defer = new Defer();

    // Pre-populate subnet details from each protocol's own URLs (which have IP addresses)
    // Each protocol only shows subnets from its own input URLs
    const udpSubnetDetails = prepopulateSubnetDetails(clusterInfo.udp);
    const tcpSubnetDetails = prepopulateSubnetDetails(clusterInfo.tcp);
    const xtlsSubnetDetails = prepopulateSubnetDetails(clusterInfo.xtls);

    this.result = {
      udp: {
        result: 'untested',
        details: udpSubnetDetails,
      },
      tcp: {
        result: 'untested',
        details: tcpSubnetDetails,
      },
      xtls: {
        result: 'untested',
        details: xtlsSubnetDetails,
      },
    };
  }

  /**
   * Gets total elapsed time, can be called only after start() is called
   * @returns {number} Milliseconds
   */
  private getElapsedTime() {
    return Math.round(performance.now() - this.startTimestamp);
  }

  /**
   * Generate peerConnection config settings
   * @param {ClusterNode} cluster
   * @returns {RTCConfiguration} peerConnectionConfig
   */
  private static buildPeerConnectionConfig(cluster: ClusterNode): RTCConfiguration {
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
   * @returns {RTCPeerConnection|null} peerConnection
   */
  private createPeerConnection(clusterInfo: ClusterNode): RTCPeerConnection | null {
    try {
      const config = ReachabilityPeerConnection.buildPeerConnectionConfig(clusterInfo);

      const peerConnection = new RTCPeerConnection(config);

      return peerConnection;
    } catch (peerConnectionError) {
      LoggerProxy.logger.warn(
        `Reachability:ReachabilityPeerConnection#createPeerConnection --> Error creating peerConnection:`,
        peerConnectionError
      );

      return null;
    }
  }

  /**
   * @returns {ClusterReachabilityResult} reachability result for this instance
   */
  getResult() {
    return this.result;
  }

  /**
   * Closes the peerConnection
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

    if (this.pc && this.pc.connectionState !== CLOSED) {
      // Emit results for all protocols before closing (important for timeout scenarios)
      this.emitResultsForAllProtocols();
      this.closePeerConnection();
      this.finishReachabilityCheck();
    }
  }

  /**
   * Adds public IP (client media IPs)
   * @param {string} protocol
   * @param {string} publicIp
   * @returns {void}
   */
  private addPublicIp(protocol: Protocol, publicIp?: string | null) {
    if (!publicIp) {
      return;
    }

    const result = this.result[protocol];
    let ipAdded = false;

    if (result.clientMediaIPs) {
      if (!result.clientMediaIPs.includes(publicIp)) {
        result.clientMediaIPs.push(publicIp);
        ipAdded = true;
      }
    } else {
      result.clientMediaIPs = [publicIp];
      ipAdded = true;
    }

    if (ipAdded) {
      this.emit(
        {
          file: 'reachabilityPeerConnection',
          function: 'addPublicIp',
        },
        ReachabilityPeerConnectionEvents.clientMediaIpsUpdated,
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
        // Emit resultReady for all protocols when ICE gathering completes
        // This ensures all subnet details are populated before emitting
        this.emitResultsForAllProtocols();
        this.closePeerConnection();
        this.defer.resolve();
      }
    };
  }

  /**
   * Emits resultReady events for all protocols that have results
   * Called when ICE gathering completes to ensure all subnet details are included
   * @returns {void}
   */
  private emitResultsForAllProtocols(): void {
    const protocols: Protocol[] = ['udp', 'tcp', 'xtls'];
    protocols.forEach((protocol) => {
      const result = this.result[protocol];
      // Only emit if we haven't already emitted for this protocol
      // (result will be 'reachable' or 'unreachable', not 'untested')
      if (result.result !== 'untested') {
        this.emit(
          {
            file: 'reachabilityPeerConnection',
            function: 'emitResultsForAllProtocols',
          },
          ReachabilityPeerConnectionEvents.resultReady,
          {
            protocol,
            ...result,
          }
        );
      }
    });
  }

  /**
   * Saves the latency in the result for the given protocol and marks it as reachable,
   * updates subnet details, and adds public IPs.
   * Note: resultReady event is emitted when ICE gathering completes, not here.
   *
   * @param {string} protocol
   * @param {number} latency
   * @param {string|null} [publicIp]
   * @param {string|null} [serverIp]
   * @param {number} [serverPort]
   * @returns {void}
   */
  private saveResult(
    protocol: Protocol,
    latency: number,
    publicIp?: string | null,
    serverIp?: string | null,
    serverPort?: number
  ) {
    const result = this.result[protocol];

    // Update subnet details if we have server info
    if (serverIp && serverPort) {
      this.updateSubnetDetail(protocol, serverIp, serverPort, latency);
    }

    if (result.latencyInMilliseconds === undefined) {
      LoggerProxy.logger.log(
        // @ts-ignore
        `Reachability:ReachabilityPeerConnection#saveResult --> Successfully reached ${
          this.clusterName
        } over ${protocol}: ${latency}ms, serverIp=${serverIp || 'unknown'}`
      );
      result.latencyInMilliseconds = latency;
      result.result = 'reachable';
      if (publicIp) {
        result.clientMediaIPs = [publicIp];
      }
      // Note: resultReady event is emitted when ICE gathering completes in emitResultsForAllProtocols()
    } else {
      this.addPublicIp(protocol, publicIp);
    }

    if (serverIp) {
      if (!this.emittedSubnets.has(serverIp)) {
        this.emittedSubnets.add(serverIp);
        this.emit(
          {
            file: 'reachabilityPeerConnection',
            function: 'saveResult',
          },
          ReachabilityPeerConnectionEvents.reachedSubnets,
          {
            subnets: [serverIp],
          }
        );
      }
    }
  }

  /**
   * Updates subnet detail for a specific server IP and port
   * Marks it as reachable (answeredTx=1, lostTx=0) and adds latency
   * @param {Protocol} protocol - the protocol (udp, tcp, xtls)
   * @param {string} serverIp - the server IP address
   * @param {number} port - the server port
   * @param {number} latency - the latency in milliseconds
   * @returns {void}
   */
  private updateSubnetDetail(
    protocol: Protocol,
    serverIp: string,
    port: number,
    latency: number
  ): void {
    const {details} = this.result[protocol];
    if (!details) {
      return;
    }

    const existingDetail = details.find((d) => d.serverIp === serverIp && d.port === port);
    if (existingDetail) {
      // Only update if this is still marked as unreachable (first response wins)
      if (existingDetail.answeredTx === 0) {
        existingDetail.answeredTx = 1;
        existingDetail.lostTx = 0;
        existingDetail.latencies = [latency];
      }
    } else {
      // Add new entry for servers that weren't pre-populated (e.g., resolved domain names)
      details.push({
        serverIp,
        port,
        answeredTx: 1,
        lostTx: 0,
        latencies: [latency],
      });
    }

    // Update minLatency
    this.updateMinLatency(protocol);
  }

  /**
   * Calculates and updates minLatency for a protocol based on reachable subnets
   * @param {Protocol} protocol - the protocol to update
   * @returns {void}
   */
  private updateMinLatency(protocol: Protocol): void {
    const {details} = this.result[protocol];
    if (!details || details.length === 0) {
      return;
    }

    const reachableLatencies = details
      .filter((d) => d.answeredTx === 1 && d.latencies.length > 0)
      .map((d) => Math.min(...d.latencies));

    if (reachableLatencies.length > 0) {
      this.result[protocol].minLatency = Math.min(...reachableLatencies);
    }
  }

  /**
   * Determines NAT type by analyzing server reflexive candidate patterns
   * @param {RTCIceCandidate} candidate server reflexive candidate
   * @returns {void}
   */
  private determineNatTypeForSrflxCandidate(candidate: RTCIceCandidate) {
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
              file: 'reachabilityPeerConnection',
              function: 'determineNatTypeForSrflxCandidate',
            },
            ReachabilityPeerConnectionEvents.natTypeUpdated,
            {
              natType: NatType.SymmetricNat,
            }
          );
        }
      });
    }
  }

  /**
   * Extracts port from a STUN/TURN URL
   * @param {string} url - the URL to extract port from
   * @returns {number | null} the port or null
   */
  private extractPortFromUrl(url: string): number | null {
    try {
      const parsedUrl = new URL(url);
      const port = parseInt(parsedUrl.port, 10);

      return Number.isNaN(port) ? null : port;
    } catch {
      return null;
    }
  }

  /**
   * Registers a listener for the icecandidate event
   *
   * @returns {void}
   */
  private registerIceCandidateListener() {
    this.pc.onicecandidate = (e) => {
      const CANDIDATE_TYPES = {
        SERVER_REFLEXIVE: 'srflx',
        RELAY: 'relay',
      };

      const latencyInMilliseconds = this.getElapsedTime();

      if (e.candidate) {
        if (e.candidate.type === CANDIDATE_TYPES.SERVER_REFLEXIVE) {
          // In standard WebRTC mode (not per-URL), we may receive multiple srflx candidates
          // but we only need to mark ONE pre-populated entry as reachable (the first one)
          // For subsequent candidates, just collect public IPs for NAT detection
          if (this.udpFirstCandidateProcessed) {
            this.addPublicIp('udp', e.candidate.address);
            this.determineNatTypeForSrflxCandidate(e.candidate);

            return;
          }

          let serverIp: string | null = null;
          let serverPort: number | null = null;

          if ('url' in e.candidate) {
            const candidateUrl = (e.candidate as any).url;
            const parsed = parseIceServerUrl(candidateUrl);
            if (parsed.host && parsed.port && isIpAddress(parsed.host)) {
              serverIp = parsed.host;
              serverPort = parsed.port;
            }
          }

          // Fallback: Use first pre-populated entry if URL extraction failed
          // In standard mode (not per-URL), we don't know which server responded,
          // so we mark the first one as reachable
          if (!serverIp && this.result.udp.details && this.result.udp.details.length > 0) {
            const firstDetail = this.result.udp.details[0];
            serverIp = firstDetail.serverIp;
            serverPort = firstDetail.port;
          }

          this.saveResult('udp', latencyInMilliseconds, e.candidate.address, serverIp, serverPort);

          // Mark that we've processed the first candidate
          this.udpFirstCandidateProcessed = true;

          this.determineNatTypeForSrflxCandidate(e.candidate);
        }

        if (e.candidate.type === CANDIDATE_TYPES.RELAY) {
          const TURN_TLS_PORT = 443;

          // For relay candidates, extract server info from the URL if available
          let serverIp: string | null = null;
          let serverPort: number | null = null;
          let isIpAddressFromUrl = false;
          let urlParsed = false;

          if ('url' in e.candidate) {
            const candidateUrl = (e.candidate as any).url;
            const parsed = parseIceServerUrl(candidateUrl);
            if (parsed.host && parsed.port) {
              serverIp = parsed.host;
              serverPort = parsed.port;
              isIpAddressFromUrl = isIpAddress(parsed.host);
              urlParsed = true;
            }
          }

          // Determine protocol first, before fallback handling
          let protocol: Protocol = 'tcp';
          if ('relayProtocol' in e.candidate) {
            const relayProto = (e.candidate as any).relayProtocol;
            if (relayProto === 'tls') {
              protocol = 'xtls';
            }
          } else if ('url' in e.candidate) {
            // Fallback: check URL scheme (turns: indicates TLS)
            const candidateUrl = (e.candidate as any).url;
            if (candidateUrl && candidateUrl.startsWith('turns:')) {
              protocol = 'xtls';
            }
          } else if (e.candidate.port === TURN_TLS_PORT) {
            // Legacy fallback: use port 443 to detect TLS (for browsers without url property)
            protocol = 'xtls';
          }

          // For XTLS, always use port 443 regardless of the relay candidate's ephemeral port
          if (protocol === 'xtls') {
            serverPort = TURN_TLS_PORT;
          }

          // Fallback for TCP only: use relatedAddress/address if URL parsing didn't work
          // For XTLS, we don't use these fallbacks because they're not the server's IP
          // (relatedAddress is client's srflx address, address is allocated relay address)
          if (protocol === 'tcp' && !urlParsed) {
            if (e.candidate.relatedAddress) {
              serverIp = e.candidate.relatedAddress;
            } else if (e.candidate.address) {
              serverIp = e.candidate.address;
            }
            if (!serverPort && e.candidate.relatedPort) {
              serverPort = e.candidate.relatedPort;
            }
          }

          // For XTLS, if URL gives a domain name (not IP), use e.candidate.address as serverIp
          // This is the relay address allocated by the TURN server, which is typically the server's public IP
          if (protocol === 'xtls' && !isIpAddressFromUrl) {
            if (e.candidate.address) {
              serverIp = e.candidate.address;
            }
          }

          // For XTLS, mark all pre-populated entries as reachable since we can't determine
          // which specific server responded (URLs use domain names, not IPs)
          // Only process if we have unreachable entries to avoid adding duplicate entries
          if (protocol === 'xtls') {
            const unreachableXtlsDetails = this.result.xtls.details.filter(
              (d: SubnetDetail) => d.answeredTx === 0
            );

            if (unreachableXtlsDetails.length > 0) {
              unreachableXtlsDetails.forEach((detail: SubnetDetail) => {
                this.saveResult(
                  protocol,
                  latencyInMilliseconds,
                  null,
                  detail.serverIp,
                  detail.port
                );
              });

              // Skip adding new entries - we only use pre-populated entries for XTLS
              return;
            }

            // No pre-populated entries - add new entry with the relay address
            // (XTLS URLs use domain names, so we use the relay address as serverIp)
          }

          // For TCP, mark all pre-populated entries as reachable (conservative approach)
          // since we can't reliably determine which specific server responded from the relay candidate
          if (protocol === 'tcp') {
            const unreachableTcpDetails = this.result.tcp.details.filter(
              (d: SubnetDetail) => d.answeredTx === 0
            );

            if (unreachableTcpDetails.length > 0) {
              unreachableTcpDetails.forEach((detail: SubnetDetail) => {
                this.saveResult(
                  protocol,
                  latencyInMilliseconds,
                  null,
                  detail.serverIp,
                  detail.port
                );
              });

              // Skip adding new entries - we only use pre-populated entries for TCP
              return;
            }

            // If no pre-populated entries exist, but we have already processed a TCP candidate, skip
            if (this.result.tcp.result === 'reachable') {
              return;
            }

            // For TCP without pre-populated entries and no IP from URL, use relay address as fallback
            // (TCP URLs normally have IPs, but this handles edge cases)
            if (!isIpAddressFromUrl) {
              if (e.candidate.relatedAddress) {
                serverIp = e.candidate.relatedAddress;
              } else if (e.candidate.address) {
                serverIp = e.candidate.address;
              }
            }
          }

          // Only add subnet detail if we have a valid server IP
          if (serverIp && isIpAddress(serverIp)) {
            this.saveResult(protocol, latencyInMilliseconds, null, serverIp, serverPort);
          } else {
            // Mark as reachable without adding subnet details
            const result = this.result[protocol];
            if (result.latencyInMilliseconds === undefined) {
              LoggerProxy.logger.log(
                // @ts-ignore
                `Reachability:ReachabilityPeerConnection#saveResult --> Successfully reached ${this.clusterName} over ${protocol}: ${latencyInMilliseconds}ms, serverIp=unavailable`
              );
              result.latencyInMilliseconds = latencyInMilliseconds;
              result.result = 'reachable';
            }
          }
        }
      }
    };
  }

  /**
   * Starts the process of doing UDP, TCP, and XTLS reachability checks.
   * @returns {Promise<ClusterReachabilityResult>}
   */
  async start(): Promise<ClusterReachabilityResult> {
    if (!this.pc) {
      LoggerProxy.logger.warn(
        `Reachability:ReachabilityPeerConnection#start --> Error: peerConnection is undefined`
      );

      return this.result;
    }

    // Initialize this.result as saying that nothing is reachable.
    // It will get updated as we go along and successfully gather ICE candidates.
    // Preserve the pre-populated details array.
    this.result.udp = {
      result: this.numUdpUrls > 0 ? 'unreachable' : 'untested',
      details: this.result.udp.details || [],
    };
    this.result.tcp = {
      result: this.numTcpUrls > 0 ? 'unreachable' : 'untested',
      details: this.result.tcp.details || [],
    };
    this.result.xtls = {
      result: this.numXTlsUrls > 0 ? 'unreachable' : 'untested',
      details: this.result.xtls.details || [],
    };

    try {
      const offer = await this.pc.createOffer({offerToReceiveAudio: true});

      this.startTimestamp = performance.now();

      // Set up the state change listeners before triggering the ICE gathering
      const gatherIceCandidatePromise = this.gatherIceCandidates();

      // not awaiting the next call on purpose, because we're not sending the offer anywhere and there won't be any answer
      // we just need to make this call to trigger the ICE gathering process
      this.pc.setLocalDescription(offer);

      await gatherIceCandidatePromise;
    } catch (error) {
      LoggerProxy.logger.warn(`Reachability:ReachabilityPeerConnection#start --> Error: `, error);
    }

    return this.result;
  }

  /**
   * Starts the process of gathering ICE candidates
   * @returns {Promise} promise that's resolved once reachability checks are completed or timeout is reached
   */
  private gatherIceCandidates() {
    this.registerIceGatheringStateChangeListener();
    this.registerIceCandidateListener();

    return this.defer.promise;
  }
}
