import {Defer} from '@webex/common';

import LoggerProxy from '../common/logs/logger-proxy';
import {ClusterNode} from './request';
import {convertStunUrlToTurn, convertStunUrlToTurnTls} from './util';
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
   */
  constructor(clusterName: string, clusterInfo: ClusterNode) {
    super();
    this.clusterName = clusterName;
    this.numUdpUrls = clusterInfo.udp.length;
    this.numTcpUrls = clusterInfo.tcp.length;
    this.numXTlsUrls = clusterInfo.xtls.length;

    this.pc = this.createPeerConnection(clusterInfo);

    this.defer = new Defer();
    this.result = {
      udp: {
        result: 'untested',
      },
      tcp: {
        result: 'untested',
      },
      xtls: {
        result: 'untested',
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
        this.closePeerConnection();
        this.defer.resolve();
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
   * @returns {void}
   */
  private saveResult(
    protocol: Protocol,
    latency: number,
    publicIp?: string | null,
    serverIp?: string | null
  ) {
    const result = this.result[protocol];

    if (result.latencyInMilliseconds === undefined) {
      LoggerProxy.logger.log(
        // @ts-ignore
        `Reachability:ReachabilityPeerConnection#saveResult --> Successfully reached ${this.clusterName} over ${protocol}: ${latency}ms`
      );
      result.latencyInMilliseconds = latency;
      result.result = 'reachable';
      if (publicIp) {
        result.clientMediaIPs = [publicIp];
      }

      this.emit(
        {
          file: 'reachabilityPeerConnection',
          function: 'saveResult',
        },
        ReachabilityPeerConnectionEvents.resultReady,
        {
          protocol,
          ...result,
        }
      );
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

      if (e.candidate) {
        if (e.candidate.type === CANDIDATE_TYPES.SERVER_REFLEXIVE) {
          let serverIp = null;
          if ('url' in e.candidate) {
            const stunServerUrlRegex = /stun:([\d.]+):\d+/;

            const match = (e.candidate as any).url.match(stunServerUrlRegex);
            serverIp = match && match[1];
          }

          this.saveResult('udp', latencyInMilliseconds, e.candidate.address, serverIp);

          this.determineNatTypeForSrflxCandidate(e.candidate);
        }

        if (e.candidate.type === CANDIDATE_TYPES.RELAY) {
          const protocol = e.candidate.port === TURN_TLS_PORT ? 'xtls' : 'tcp';
          this.saveResult(protocol, latencyInMilliseconds, null, e.candidate.address);
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
    this.result.udp = {
      result: this.numUdpUrls > 0 ? 'unreachable' : 'untested',
    };
    this.result.tcp = {
      result: this.numTcpUrls > 0 ? 'unreachable' : 'untested',
    };
    this.result.xtls = {
      result: this.numXTlsUrls > 0 ? 'unreachable' : 'untested',
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
