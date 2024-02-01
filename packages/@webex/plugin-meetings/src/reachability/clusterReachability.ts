import {Defer} from '@webex/common';

import LoggerProxy from '../common/logs/logger-proxy';
import {ClusterNode} from './request';

import {ICE_GATHERING_STATE, CONNECTION_STATE} from '../constants';

const DEFAULT_TIMEOUT = 3000;
const VIDEO_MESH_TIMEOUT = 1000;

// result for a specific transport protocol (like udp or tcp)
export type TransportResult = {
  reachable?: 'true' | 'false'; // string not boolean, because it's sent to the backend like that
  latencyInMilliseconds?: string;
  clientMediaIPs?: string[];
  untested?: 'true'; // string not boolean, because it's sent to the backend like that
};

// reachability result for a specifc media cluster
export type ReachabilityResult = {
  udp: TransportResult;
  tcp: TransportResult;
  xtls: {
    untested: 'true';
  };
};

/* eslint-disable require-jsdoc */ // todo bazyl
/**
 * A class that handles reachability checks for a single cluster.
 */
export class ClusterReachability {
  private numUdpUrls: number;
  private numTcpUrls: number;
  private result: ReachabilityResult;
  private pc?: RTCPeerConnection;
  private defer: Defer; // this defer is resolved once reachability checks for this cluster are completed
  private startTimestamp: number;
  public readonly isVideoMesh: boolean;
  public readonly name;

  constructor(name: string, clusterInfo: ClusterNode) {
    this.name = name;
    this.isVideoMesh = clusterInfo.isVideoMesh;
    this.numUdpUrls = clusterInfo.udp.length;
    this.numTcpUrls = clusterInfo.tcp.length;

    this.pc = this.createPeerConnection(clusterInfo);

    this.defer = new Defer();
    this.result = {
      udp: {
        untested: 'true',
      },
      tcp: {
        untested: 'true',
      },
      xtls: {
        untested: 'true',
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
   * Generate peerConnection config settings
   * @param {ClusterNode} cluster
   * @returns {RTCConfiguration} peerConnectionConfig
   */
  // eslint-disable-next-line class-methods-use-this
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
      // urlString looks like this: "stun:external-media91.public.wjfkm-a-10.prod.infra.webex.com:5004"
      // and we need it to be like this: "turn:external-media91.public.wjfkm-a-10.prod.infra.webex.com:5004?transport=tcp"
      const url = new URL(urlString);

      url.protocol = 'turn:';
      url.searchParams.append('transport', 'tcp');

      return {
        username: 'webexturnreachuser',
        credential: 'webexturnreachpwd',
        urls: [url.toString()],
      };
    });

    return {
      iceServers: [...udpIceServers, ...tcpIceServers],
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
      LoggerProxy.logger.log(
        `Reachability:index#createPeerConnection --> Error creating peerConnection: ${peerConnectionError}`
      );

      return undefined;
    }
  }

  getResult() {
    return this.result;
  }

  isUnreachable(protocol: 'udp' | 'tcp') {
    if (protocol === 'udp') {
      return this.numUdpUrls > 0 && this.result.udp.reachable !== 'true';
    }

    return this.numTcpUrls > 0 && this.result.tcp.reachable !== 'true';
  }

  private closePeerConnection() {
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.onicegatheringstatechange = null;
      this.pc.close();
    }
  }

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
    const {CLOSED} = CONNECTION_STATE;

    if (this.pc?.connectionState === CLOSED) {
      LoggerProxy.logger.log(
        `Reachability:index#addPublicIP --> Attempting to set publicIP of ${publicIP} on closed peerConnection.`
      );
    }

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

  private registerIceGatheringStateChangeListener() {
    this.pc.onicegatheringstatechange = () => {
      const {COMPLETE} = ICE_GATHERING_STATE;

      if (this.pc.iceConnectionState === COMPLETE) {
        this.closePeerConnection();
        this.finishReachabilityCheck();
      }
    };
  }

  private haveWeGotAllResults(): boolean {
    const expecting = {
      udp: this.numUdpUrls > 0,
      tcp: this.numTcpUrls > 0,
    };

    const gotResult = {
      udp: this.result.udp.reachable === 'true',
      tcp: this.result.tcp.reachable === 'true',
    };

    return ['udp', 'tcp'].every((protocol) => expecting[protocol] === gotResult[protocol]);
  }

  private storeLatencyResult(protocol: 'udp' | 'tcp', latency: number) {
    const result = this.result[protocol];

    if (result.latencyInMilliseconds === undefined) {
      LoggerProxy.logger.log(
        // @ts-ignore
        `Reachability:index#storeLatencyResult --> Successfully reached ${this.name} over ${protocol}: ${latency}ms`
      );
      result.latencyInMilliseconds = latency.toString();
      result.reachable = 'true';
    }
  }

  private registerIceCandidateListener() {
    this.pc.onicecandidate = (e) => {
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
          this.storeLatencyResult('tcp', this.getElapsedTime());
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

  /**
   * Starts the process of doing reachability checks on the media cluster.
   *
   * @returns {Promise}
   */
  async start(): Promise<ReachabilityResult> {
    if (!this.pc) {
      LoggerProxy.logger.warn(
        `Reachability:ClusterReachability#start --> Error: peerConnection is undefined`
      );

      return this.result;
    }

    // Initialize this.result as saying that nothing is reachable.
    // It will get updated as we go along and successfully gather ICE candidates.
    this.result = {
      udp: {
        reachable: this.numUdpUrls > 0 ? 'false' : undefined,
        untested: this.numUdpUrls === 0 ? 'true' : undefined,
      },
      tcp: {
        reachable: this.numTcpUrls > 0 ? 'false' : undefined,
        untested: this.numTcpUrls === 0 ? 'true' : undefined,
      },
      xtls: {
        untested: 'true',
      },
    };

    try {
      const offer = await this.pc.createOffer({offerToReceiveAudio: true});

      this.startTimestamp = performance.now();

      this.pc.setLocalDescription(offer); // not awaiting on purpose

      await this.gatherIceCandidates();
    } catch (error) {
      LoggerProxy.logger.warn(`Reachability:ClusterReachability#start --> Error: `, error);
    }

    return this.result;
  }

  /**
   * @returns {Promise}
   */
  private gatherIceCandidates() {
    const timeout = this.isVideoMesh ? VIDEO_MESH_TIMEOUT : DEFAULT_TIMEOUT;

    this.registerIceGatheringStateChangeListener();
    this.registerIceCandidateListener();

    // Set maximum timeout
    setTimeout(() => {
      const {CLOSED} = CONNECTION_STATE;

      // Close any open peerConnections
      if (this.pc.connectionState !== CLOSED) {
        this.closePeerConnection();
        this.finishReachabilityCheck();
      }
    }, timeout);

    return this.defer.promise;
  }
}
