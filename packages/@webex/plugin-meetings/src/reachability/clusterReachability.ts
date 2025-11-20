import {Defer} from '@webex/common';

import LoggerProxy from '../common/logs/logger-proxy';
import {ClusterNode} from './request';
import {convertStunUrlToTurn, convertStunUrlToTurnTls} from './util';
import EventsScope from '../common/events/events-scope';

import {CONNECTION_STATE, Enum, ICE_GATHERING_STATE} from '../constants';
import {ClusterReachabilityResult, NatType, TransportResult} from './reachability.types';

/**
 * Processes an ICE candidate and updates the result with candidate information.
 * Handles IP deduplication and latency tracking.
 *
 * @param {TransportResult} result - The protocol result object to update (e.g., result.udp)
 * @param {number} latency - Latency in milliseconds
 * @param {string|null} [publicIp] - Public IP address from ICE candidate
 * @param {string|null} [serverIp] - Server IP address (subnet)
 * @param {Set<string>} [reachedSubnets] - Optional set to track reached subnets
 * @returns {boolean} true if a new IP was added, false otherwise
 */
function processIceCandidateResult(
  result: TransportResult,
  latency: number,
  publicIp?: string | null,
  serverIp?: string | null,
  reachedSubnets?: Set<string>
): boolean {
  let newIpAdded = false;

  if (result.latencyInMilliseconds === undefined) {
    // First result for this protocol - store latency and mark as reachable
    result.latencyInMilliseconds = latency;
    result.result = 'reachable';
    if (publicIp) {
      result.clientMediaIPs = [publicIp];
      newIpAdded = true;
    }
  } else if (publicIp) {
    // Already have a result - just add new IPs (deduplicated)
    if (result.clientMediaIPs) {
      if (!result.clientMediaIPs.includes(publicIp)) {
        result.clientMediaIPs.push(publicIp);
        newIpAdded = true;
      }
    } else {
      result.clientMediaIPs = [publicIp];
      newIpAdded = true;
    }
  }

  // Track reached subnets
  if (serverIp && reachedSubnets) {
    reachedSubnets.add(serverIp);
  }

  return newIpAdded;
}

// data for the Events.resultReady event
export type ResultEventData = {
  protocol: 'udp' | 'tcp' | 'xtls';
  result: 'reachable' | 'unreachable' | 'untested';
  latencyInMilliseconds: number; // amount of time it took to get the ICE candidate
  clientMediaIPs?: string[];
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
 * Handles RTCPeerConnection lifecycle and ICE candidate gathering for reachability checks.
 * Does ALL the work: PeerConnection lifecycle, candidate processing, result management, and event emission.
 */
class ReachabilityPeerConnection extends EventsScope {
  public numUdpUrls: number;
  public numTcpUrls: number;
  public numXTlsUrls: number;
  private pc?: RTCPeerConnection;
  private defer: Defer;
  private startTimestamp: number;
  private srflxIceCandidates: RTCIceCandidate[] = [];
  private clusterName: string;
  private result: ClusterReachabilityResult;
  private reachedSubnets: Set<string> = new Set();

  /**
   * Constructor for ReachabilityPeerConnection
   * @param {ClusterNode} clusterInfo information about the media cluster
   * @param {string} clusterName name of the cluster
   */
  constructor(clusterInfo: ClusterNode, clusterName: string) {
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
   * @returns {RTCPeerConnection|undefined} peerConnection
   */
  private createPeerConnection(clusterInfo: ClusterNode) {
    try {
      const config = ReachabilityPeerConnection.buildPeerConnectionConfig(clusterInfo);

      const peerConnection = new RTCPeerConnection(config);

      return peerConnection;
    } catch (peerConnectionError) {
      LoggerProxy.logger.warn(
        `Reachability:ReachabilityPeerConnection#createPeerConnection --> Error creating peerConnection:`,
        peerConnectionError
      );

      return undefined;
    }
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
   * Registers a listener for the iceGatheringStateChange event
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
   * Determines NAT Type.
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
              file: 'reachabilityPeerConnection',
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

      if (e.candidate) {
        if (e.candidate.type === CANDIDATE_TYPES.SERVER_REFLEXIVE) {
          let serverIp = null;
          if ('url' in e.candidate) {
            const stunServerUrlRegex = /stun:([\d.]+):\d+/;

            const match = (e.candidate as any).url.match(stunServerUrlRegex);
            if (match) {
              // eslint-disable-next-line prefer-destructuring
              serverIp = match[1];
            }
          }

          this.saveResult('udp', latencyInMilliseconds, e.candidate.address, serverIp);

          this.determineNatType(e.candidate);
        }

        if (e.candidate.type === CANDIDATE_TYPES.RELAY) {
          const protocol = e.candidate.port === TURN_TLS_PORT ? 'xtls' : 'tcp';
          this.saveResult(protocol, latencyInMilliseconds, null, e.candidate.address);
        }
      }
    };
  }

  /**
   * Saves the latency in the result for the given protocol and marks it as reachable,
   * emits the "resultReady" event if this is the first result for that protocol,
   * emits the "clientMediaIpsUpdated" event if we already had a result and only found
   * a new client IP
   * @param {string} protocol
   * @param {number} latency
   * @param {string|null} [publicIp]
   * @param {string|null} [serverIp]
   * @returns {void}
   */
  private saveResult(
    protocol: 'udp' | 'tcp' | 'xtls',
    latency: number,
    publicIp?: string | null,
    serverIp?: string | null
  ) {
    const result = this.result[protocol];
    const isFirstResult = result.latencyInMilliseconds === undefined;

    const newIpAdded = processIceCandidateResult(
      result,
      latency,
      publicIp,
      serverIp,
      this.reachedSubnets
    );

    if (serverIp) {
      this.emit(
        {
          file: 'reachabilityPeerConnection',
          function: 'saveResult',
        },
        'reachedSubnets',
        {
          subnets: [serverIp],
        }
      );
    }

    if (isFirstResult) {
      LoggerProxy.logger.log(
        // @ts-ignore
        `Reachability:ReachabilityPeerConnection#saveResult --> Successfully reached ${this.clusterName} over ${protocol}: ${latency}ms`
      );
      this.emit(
        {
          file: 'reachabilityPeerConnection',
          function: 'saveResult',
        },
        Events.resultReady,
        {
          protocol,
          result: result.result,
          latencyInMilliseconds: result.latencyInMilliseconds,
          ...(result.clientMediaIPs && {clientMediaIPs: result.clientMediaIPs}),
        }
      );
    } else if (newIpAdded) {
      this.emit(
        {
          file: 'reachabilityPeerConnection',
          function: 'saveResult',
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
   * Starts the process of gathering ICE candidates
   * @returns {Promise} promise that's resolved once reachability checks are completed or timeout is reached
   */
  private gatherIceCandidates() {
    this.registerIceGatheringStateChangeListener();
    this.registerIceCandidateListener();

    return this.defer.promise;
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
   * Aborts the cluster reachability checks by closing the peer connection
   * @returns {void}
   */
  public abort() {
    const {CLOSED} = CONNECTION_STATE;

    if (this.pc && this.pc.connectionState !== CLOSED) {
      this.closePeerConnection();
      this.defer.resolve();
    }
  }
}

/**
 * A class that handles reachability checks for a single cluster.
 * Creates and orchestrates a ReachabilityPeerConnection instance.
 * Listens to events and emits them to consumers.
 */
export class ClusterReachability extends EventsScope {
  private reachabilityPeerConnection?: ReachabilityPeerConnection;
  public readonly isVideoMesh: boolean;
  public readonly name;
  public readonly reachedSubnets: Set<string> = new Set();
  private result: ClusterReachabilityResult;

  /**
   * Constructor for ClusterReachability
   * @param {string} name cluster name
   * @param {ClusterNode} clusterInfo information about the media cluster
   */
  constructor(name: string, clusterInfo: ClusterNode) {
    super();
    this.name = name;
    this.isVideoMesh = clusterInfo.isVideoMesh;
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

    this.reachabilityPeerConnection = new ReachabilityPeerConnection(clusterInfo, name);

    this.reachabilityPeerConnection.on('resultReady', (data) => {
      const {protocol, ...resultData} = data;
      this.result[protocol] = resultData;
      this.emit(
        {
          file: 'clusterReachability',
          function: 'onResultReady',
        },
        Events.resultReady,
        data
      );
    });

    this.reachabilityPeerConnection.on('clientMediaIpsUpdated', (data) => {
      const {protocol, clientMediaIPs} = data;
      this.result[protocol].clientMediaIPs = clientMediaIPs;
      this.emit(
        {
          file: 'clusterReachability',
          function: 'onClientMediaIpsUpdated',
        },
        Events.clientMediaIpsUpdated,
        data
      );
    });

    this.reachabilityPeerConnection.on('natTypeUpdated', (data) => {
      this.emit(
        {
          file: 'clusterReachability',
          function: 'onNatTypeUpdated',
        },
        Events.natTypeUpdated,
        data
      );
    });

    this.reachabilityPeerConnection.on('reachedSubnets', (data) => {
      data.subnets.forEach((subnet) => {
        this.reachedSubnets.add(subnet);
      });
    });
  }

  /**
   * @returns {ClusterReachabilityResult} reachability result for this cluster
   */
  getResult() {
    return this.result;
  }

  /**
   * Starts the process of doing UDP, TCP, and XTLS reachability checks on the media cluster.
   * @returns {Promise<ClusterReachabilityResult>}
   */
  async start(): Promise<ClusterReachabilityResult> {
    const pc = this.reachabilityPeerConnection;
    if (!pc) {
      LoggerProxy.logger.warn(
        `Reachability:ClusterReachability#start --> Error: reachabilityPeerConnection is undefined`
      );

      return this.result;
    }

    // Initialize result based on URL availability
    this.result.udp = {
      result: pc.numUdpUrls > 0 ? 'unreachable' : 'untested',
    };
    this.result.tcp = {
      result: pc.numTcpUrls > 0 ? 'unreachable' : 'untested',
    };
    this.result.xtls = {
      result: pc.numXTlsUrls > 0 ? 'unreachable' : 'untested',
    };

    await pc.start();

    return this.result;
  }

  /**
   * Aborts the cluster reachability checks
   * @returns {void}
   */
  public abort() {
    if (this.reachabilityPeerConnection) {
      this.reachabilityPeerConnection.abort();
    }
  }
}
