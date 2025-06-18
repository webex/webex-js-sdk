import {Defer} from '@webex/common';

import LoggerProxy from '../common/logs/logger-proxy';
import {ClusterNode} from './request';
import {
  convertStunUrlToTurn,
  convertStunUrlToTurnTls,
  isDomainName,
  constructSubnetKey,
} from './util';
import EventsScope from '../common/events/events-scope';

import {CONNECTION_STATE, Enum, ICE_GATHERING_STATE} from '../constants';
import {ClusterReachabilityResult, NatType} from './reachability.types';

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

  public clusterInfo: ClusterNode;
  public subnets: Map<
    string,
    {
      serverIps?: string;
      port?: number;
      protocol?: string;
      reachable?: boolean;
      'answered-tx'?: number;
      'lost-tx'?: number;
      latencies: number[];
    }
  > = new Map();

  /**
   * Constructor for ClusterReachability
   * @param {string} name cluster name
   * @param {ClusterNode} clusterInfo information about the media cluster
   */
  constructor(name: string, clusterInfo: ClusterNode) {
    super();
    this.name = name;
    this.clusterInfo = clusterInfo;
    this.isVideoMesh = clusterInfo.isVideoMesh;
    this.numUdpUrls = clusterInfo.udp.length;
    this.numTcpUrls = clusterInfo.tcp.length;
    this.numXTlsUrls = clusterInfo.xtls.length;

    this.pc = this.createPeerConnection(clusterInfo);

    this.defer = new Defer();
    this.result = {
      udp: {
        result: 'untested',
        latencyInMilliseconds: undefined,
        clientMediaIPs: [],
        minLatency: undefined,
        domainNames: [], // Initialize domainNames as an empty array
        details: [], // Initialize details as an empty array
      },
      tcp: {
        result: 'untested',
        latencyInMilliseconds: undefined,
        clientMediaIPs: [],
        minLatency: undefined,
        domainNames: [], // Initialize domainNames as an empty array
        details: [], // Initialize details as an empty array
      },
      xtls: {
        result: 'untested',
        latencyInMilliseconds: undefined,
        clientMediaIPs: [],
        minLatency: undefined,
        domainNames: [], // Initialize domainNames as an empty array
        details: [], // Initialize details as an empty array
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

    if (this.pc.connectionState !== CLOSED) {
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
   * @param {number|null} [port]
   * @returns {void}
   */
  private saveResult(
    protocol: 'udp' | 'tcp' | 'xtls',
    latency: number,
    publicIp?: string | null,
    serverIp?: string | null,
    port?: number | null
  ) {
    const result = this.result[protocol];

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

    if (serverIp && port) {
      const subnetKey = constructSubnetKey(serverIp, port, protocol);
      const subnet = this.subnets.get(subnetKey);

      if (subnet) {
        subnet.reachable = true;
        subnet['answered-tx'] = 1;
        subnet['lost-tx'] = 0;
        subnet.latencies.push(latency);

        // Replace domain name with resolved IP for all protocols, if applicable
        const isDomain = isDomainName(subnet.serverIps || '');
        if (isDomain && serverIp !== subnet.serverIps) {
          LoggerProxy.logger.log(
            `Reachability:index#saveResult --> Replacing domain name ${subnet.serverIps} with resolved IP ${serverIp}`
          );
          subnet.serverIps = serverIp;
        }
      } else {
        // Add a new subnet to the map
        const isDomain = isDomainName(serverIp || '');
        LoggerProxy.logger.log(
          `Reachability:index#saveResult --> Adding new subnet: serverIp=${serverIp}, isDomain=${isDomain}`
        );

        this.subnets.set(subnetKey, {
          serverIps: serverIp,
          port,
          protocol,
          reachable: false, // Retain domain name for failures
          'answered-tx': 0,
          'lost-tx': 1,
          latencies: [],
        });
      }
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

      if (e.candidate) {
        if (e.candidate.type === CANDIDATE_TYPES.SERVER_REFLEXIVE) {
          let serverIp = null;
          let port = null;
          if ('url' in e.candidate) {
            // const stunServerUrlRegex = /stun:([\d.]+):(\d+)/;
            const stunServerUrlRegex = /stun:([\w-.]+|\[[\dA-Fa-f:.]+\]):(\d+)/;

            const match = (e.candidate as any).url.match(stunServerUrlRegex);
            if (match) {
              const [, extractedServerIp, portString] = match; // Destructure match array
              serverIp = extractedServerIp;
              port = Number(portString); // Convert port to a number if it exists
            }
          }

          this.saveResult('udp', latencyInMilliseconds, e.candidate.address, serverIp, port);

          this.determineNatType(e.candidate);
        }

        if (e.candidate.type === CANDIDATE_TYPES.RELAY) {
          const protocol = e.candidate.port === TURN_TLS_PORT ? 'xtls' : 'tcp';
          this.saveResult(
            protocol,
            latencyInMilliseconds,
            e.candidate.relatedAddress,
            e.candidate.address,
            e.candidate.port
          );
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
  /**
   * Starts the process of doing UDP, TCP, and XTLS reachability checks on the media cluster.
   *
   * @returns {Promise<ClusterReachabilityResult>} The reachability result for this cluster.
   */
  async start(): Promise<ClusterReachabilityResult> {
    if (!this.pc) {
      LoggerProxy.logger.warn(
        `Reachability:ClusterReachability#start --> Error: peerConnection is undefined`
      );

      return this.result;
    }

    // Prepopulate subnets with all subnets (both domain names and IPs)
    const protocols: Array<'udp' | 'tcp' | 'xtls'> = ['udp', 'tcp', 'xtls'];

    protocols.forEach((protocol) => {
      const subnets = this.clusterInfo[protocol]
        .map((url) => {
          // const match = url.match(/stun:([\w-.]+):(\d+)/); // Match domain name or IP and port
          const stunServerUrlRegex = /stun:([\w-.]+|\[[\dA-Fa-f:.]+\]):(\d+)/;
          const match = url.match(stunServerUrlRegex);
          if (match) {
            return {
              serverIps: match[1],
              port: Number(match[2]),
              protocol,
              reachable: false,
              'answered-tx': 0,
              'lost-tx': 1,
              latencies: [],
            };
          }

          return null;
        })
        .filter(Boolean);

      subnets.forEach((subnet) => {
        const subnetKey = constructSubnetKey(subnet.serverIps, subnet.port, subnet.protocol);
        this.subnets.set(subnetKey, subnet);
      });
    });

    LoggerProxy.logger.log(
      `Reachability:ClusterReachability#start --> Prepopulated subnets: `,
      Array.from(this.subnets.values())
    );

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
    this.registerIceGatheringStateChangeListener();
    this.registerIceCandidateListener();

    return this.defer.promise;
  }
}
