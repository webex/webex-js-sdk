import {Defer} from '@webex/common';

import LoggerProxy from '../common/logs/logger-proxy';
import {ClusterNode} from './request';
import {convertStunUrlToTurn, convertStunUrlToTurnTls} from './util';

import {CONNECTION_STATE, ICE_GATHERING_STATE} from '../constants';

const DEFAULT_TIMEOUT = 3000;
const VIDEO_MESH_TIMEOUT = 1000;

// result for a specific transport protocol (like udp or tcp)
export type TransportResult = {
  result: 'reachable' | 'unreachable' | 'untested';
  latencyInMilliseconds?: number; // amount of time it took to get the first ICE candidate
  clientMediaIPs?: string[];
};

// reachability result for a specific media cluster
export type ClusterReachabilityResult = {
  udp: TransportResult;
  tcp: TransportResult;
  xtls: TransportResult;
};

/**
 * A class that handles reachability checks for a single cluster.
 */
export class ClusterReachability {
  private numUdpUrls: number;
  private numTcpUrls: number;
  private numXTlsUrls: number;
  private result: ClusterReachabilityResult;
  private pc?: RTCPeerConnection;
  private defer: Defer; // this defer is resolved once reachability checks for this cluster are completed
  private startTimestamp: number | undefined;
  public readonly isVideoMesh: boolean;
  public readonly name;

  /**
   * Constructor for ClusterReachability
   * @param {string} name cluster name
   * @param {ClusterNode} clusterInfo information about the media cluster
   */
  constructor(name: string, clusterInfo: ClusterNode) {
    this.name = name;
    this.isVideoMesh = clusterInfo.isVideoMesh;
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
   * @returns {Number} Milliseconds
   */
  private getElapsedTime() {
    return Math.round(performance.now() - (this.startTimestamp || 0));
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

      return new RTCPeerConnection(config);
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
   * Adds public IP (client media IPs)
   * @param {string} protocol
   * @param {string} publicIP
   * @returns {void}
   */
  private addPublicIP(protocol: 'udp' | 'tcp', publicIP?: string | null) {
    const result = this.result[protocol];

    if (publicIP) {
      if (result.clientMediaIPs) {
        if (!result.clientMediaIPs.includes(publicIP)) {
          result.clientMediaIPs.push(publicIP);
        }
      } else {
        result.clientMediaIPs = [publicIP];
      }
    }
  }

  /**
   * Registers a listener for the iceGatheringStateChange event
   *
   * @returns {void}
   */
  private registerIceGatheringStateChangeListener() {
    if (this.pc) {
      this.pc.onicegatheringstatechange = () => {
        const {COMPLETE} = ICE_GATHERING_STATE;

        if (this.pc?.iceConnectionState === COMPLETE) {
          this.closePeerConnection();
          this.finishReachabilityCheck();
        }
      };
    }
  }

  /**
   * Checks if we have the results for all the protocols (UDP and TCP)
   *
   * @returns {boolean} true if we have all results, false otherwise
   */
  private haveWeGotAllResults(): boolean {
    return (['udp', 'tcp', 'xtls'] as const).every(
      (protocol) =>
        this.result[protocol].result === 'reachable' || this.result[protocol].result === 'untested'
    );
  }

  /**
   * Stores the latency in the result for the given protocol and marks it as reachable
   *
   * @param {string} protocol
   * @param {number} latency
   * @returns {void}
   */
  private storeLatencyResult(protocol: 'udp' | 'tcp' | 'xtls', latency: number) {
    const result = this.result[protocol];

    if (result.latencyInMilliseconds === undefined) {
      LoggerProxy.logger.log(
        // @ts-ignore
        `Reachability:index#storeLatencyResult --> Successfully reached ${this.name} over ${protocol}: ${latency}ms`
      );
      result.latencyInMilliseconds = latency;
      result.result = 'reachable';
    }
  }

  /**
   * Registers a listener for the icecandidate event
   *
   * @returns {void}
   */
  private registerIceCandidateListener() {
    if (this.pc) {
      this.pc.onicecandidate = (e) => {
        const TURN_TLS_PORT = 443;
        const CANDIDATE_TYPES = {
          SERVER_REFLEXIVE: 'srflx',
          RELAY: 'relay',
        };

        if (e.candidate) {
          if (e.candidate.type === CANDIDATE_TYPES.SERVER_REFLEXIVE) {
            this.storeLatencyResult('udp', this.getElapsedTime());
            this.addPublicIP('udp', e.candidate.address);
          }

          if (e.candidate.type === CANDIDATE_TYPES.RELAY) {
            const protocol = e.candidate.port === TURN_TLS_PORT ? 'xtls' : 'tcp';
            this.storeLatencyResult(protocol, this.getElapsedTime());
            // we don't add public IP for TCP, because in the case of relay candidates
            // e.candidate.address is the TURN server address, not the client's public IP
          }

          if (this.haveWeGotAllResults()) {
            this.closePeerConnection();
            this.finishReachabilityCheck();
          }
        }
      };
    }
  }

  /**
   * Starts the process of doing UDP and TCP reachability checks on the media cluster.
   * XTLS reachability checking is not supported.
   *
   * @returns {Promise}
   */
  async start(): Promise<ClusterReachabilityResult> {
    if (!this.pc) {
      LoggerProxy.logger.warn(
        `Reachability:ClusterReachability#start --> Error: peerConnection is undefined`
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

      // not awaiting the next call on purpose, because we're not sending the offer anywhere and there won't be any answer
      // we just need to make this call to trigger the ICE gathering process
      this.pc.setLocalDescription(offer);

      await this.gatherIceCandidates();
    } catch (error) {
      LoggerProxy.logger.warn(`Reachability:ClusterReachability#start --> Error: `, error);
    }

    return this.result;
  }

  /**
   * Starts the process of gathering ICE candidates
   *
   * @returns {Promise} promise that's resolved once reachability checks for this cluster are completed or timeout is reached
   */
  private gatherIceCandidates() {
    const timeout = this.isVideoMesh ? VIDEO_MESH_TIMEOUT : DEFAULT_TIMEOUT;

    this.registerIceGatheringStateChangeListener();
    this.registerIceCandidateListener();

    // Set maximum timeout
    setTimeout(() => {
      const {CLOSED} = CONNECTION_STATE;

      // Close any open peerConnections
      if (this.pc?.connectionState !== CLOSED) {
        this.closePeerConnection();
        this.finishReachabilityCheck();
      }
    }, timeout);

    return this.defer.promise;
  }
}
