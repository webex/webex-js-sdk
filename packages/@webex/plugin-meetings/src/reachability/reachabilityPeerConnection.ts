import {Defer} from '@webex/common';

import LoggerProxy from '../common/logs/logger-proxy';
import {ClusterNode} from './request';
import {
  convertStunUrlToTurn,
  convertStunUrlToTurnTls,
  prepopulateSubnetDetails,
  parseIceServerUrl,
} from './util';
import EventsScope from '../common/events/events-scope';

import {CONNECTION_STATE, ICE_GATHERING_STATE} from '../constants';
import {
  ClusterReachabilityResult,
  NatType,
  Protocol,
  ReachabilityPeerConnectionEvents,
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

  /**
   * Constructor for ReachabilityPeerConnection
   * @param {string} clusterName name of the cluster
   * @param {ClusterNode} clusterInfo information about the media cluster
   * @param {boolean} [enablePerUdpUrlReachability=false] whether per-URL reachability mode is enabled.
   *        When true, subnet details are tracked for all protocols.
   *        When false, no details are tracked (only reachability result).
   */
  constructor(clusterName: string, clusterInfo: ClusterNode, enablePerUdpUrlReachability = false) {
    super();
    this.clusterName = clusterName;
    this.numUdpUrls = clusterInfo.udp.length;
    this.numTcpUrls = clusterInfo.tcp.length;
    this.numXTlsUrls = clusterInfo.xtls.length;

    this.pc = this.createPeerConnection(clusterInfo);

    this.defer = new Defer();

    // Pre-populate subnet details only when enablePerUdpUrlReachability is true
    // Always include domain names for UDP to ensure we have entries even when unreachable
    this.result = {
      udp: {
        result: 'untested',
        details: enablePerUdpUrlReachability
          ? prepopulateSubnetDetails(clusterInfo.udp, true)
          : undefined,
      },
      tcp: {
        result: 'untested',
        details: enablePerUdpUrlReachability
          ? prepopulateSubnetDetails(clusterInfo.tcp)
          : undefined,
      },
      xtls: {
        result: 'untested',
        details: enablePerUdpUrlReachability
          ? prepopulateSubnetDetails(clusterInfo.xtls)
          : undefined,
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
        this.emitResultsForAllProtocols();
        this.closePeerConnection();
        this.defer.resolve();
      }
    };
  }

  /**
   * Emits resultReady events for all protocols that have URLs.
   * @returns {void}
   */
  private emitResultsForAllProtocols(): void {
    const protocols: Protocol[] = ['udp', 'tcp', 'xtls'];
    protocols.forEach((protocol) => {
      const result = this.result[protocol];
      if (result.result === 'untested') {
        return;
      }
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
    });
  }

  /**
   * Saves the latency in the result for the given protocol and marks it as reachable.
   * @param {Protocol} protocol - the protocol
   * @param {number} latency - the latency
   * @param {string} [publicIp] - the public IP
   * @param {string} [serverIp] - the server IP
   * @param {number} [serverPort] - the server port
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
   * Updates subnet detail for a specific server IP and port.
   * @param {Protocol} protocol - the protocol
   * @param {string} serverIp - the server IP
   * @param {number} port - the port
   * @param {number} latency - the latency
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

    // Find existing detail entry matching this server IP and port
    let existingDetail = details.find((d) => d.serverIp === serverIp && d.port === port);

    // If not found and this is per-URL mode with a single URL,
    // match the only entry (could be a domain name entry)
    if (!existingDetail && details.length === 1) {
      const onlyDetail = details[0];
      if (onlyDetail.port === port && onlyDetail.answeredTx === 0) {
        existingDetail = onlyDetail;
      }
    }

    if (existingDetail) {
      // Only update if this is still marked as unreachable (first response wins)
      if (existingDetail.answeredTx === 0) {
        existingDetail.answeredTx = 1;
        existingDetail.lostTx = 0;
        existingDetail.latencies = [latency];
      }
    } else {
      // Add new entry for resolved IPs (for cases where we couldn't match)
      details.push({
        serverIp,
        port,
        answeredTx: 1,
        lostTx: 0,
        latencies: [latency],
      });
    }
  }

  /**
   * Determines NAT type by analyzing server reflexive candidate patterns.
   * @param {RTCIceCandidate} candidate - the ICE candidate
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
   * Registers a listener for the icecandidate event.
   * @returns {void}
   */
  private registerIceCandidateListener() {
    this.pc.onicecandidate = (e) => {
      const TURN_TLS_PORT = 443;
      const CANDIDATE_TYPES = {
        SERVER_REFLEXIVE: 'srflx',
        RELAY: 'relay',
      };
      if (!e.candidate) {
        return;
      }

      const latencyInMilliseconds = this.getElapsedTime();

      if (e.candidate.type === CANDIDATE_TYPES.SERVER_REFLEXIVE) {
        // Extract server info from candidate URL (if available)
        const candidateWithUrl = e.candidate as RTCIceCandidate & {url?: string};
        const {host: serverIp, port: serverPort} = candidateWithUrl.url
          ? parseIceServerUrl(candidateWithUrl.url)
          : {host: undefined, port: undefined};

        const isPerUrlMode = this.numUdpUrls === 1;
        if (isPerUrlMode || this.result.udp.result !== 'reachable') {
          this.saveResult('udp', latencyInMilliseconds, e.candidate.address, serverIp, serverPort);
        } else {
          this.addPublicIp('udp', e.candidate.address);
        }

        this.determineNatTypeForSrflxCandidate(e.candidate);
      } else if (e.candidate.type === CANDIDATE_TYPES.RELAY) {
        const protocol: Protocol = e.candidate.port === TURN_TLS_PORT ? 'xtls' : 'tcp';

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
    // Preserve existing details (pre-populated or undefined based on enableSubnetDetails flag).
    this.result.udp = {
      result: this.numUdpUrls > 0 ? 'unreachable' : 'untested',
      details: this.result.udp.details,
    };
    this.result.tcp = {
      result: this.numTcpUrls > 0 ? 'unreachable' : 'untested',
      details: this.result.tcp.details,
    };
    this.result.xtls = {
      result: this.numXTlsUrls > 0 ? 'unreachable' : 'untested',
      details: this.result.xtls.details,
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
