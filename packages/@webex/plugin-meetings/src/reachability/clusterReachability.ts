import LoggerProxy from '../common/logs/logger-proxy';
import {ClusterNode} from './request';
import EventsScope from '../common/events/events-scope';

import {Enum} from '../constants';
import {ClusterReachabilityResult, NatType} from './reachability.types';
import {
  ReachabilityPeerConnection,
  ReachabilityPeerConnectionEvents,
} from './reachabilityPeerConnection';

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
 * Creates and orchestrates a ReachabilityPeerConnection instance.
 * Listens to events and emits them to consumers.
 */
export class ClusterReachability extends EventsScope {
  private reachabilityPeerConnection: ReachabilityPeerConnection;
  public readonly isVideoMesh: boolean;
  public readonly name;
  public readonly reachedSubnets: Set<string> = new Set();

  /**
   * Constructor for ClusterReachability
   * @param {string} name cluster name
   * @param {ClusterNode} clusterInfo information about the media cluster
   */
  constructor(name: string, clusterInfo: ClusterNode) {
    super();
    this.name = name;
    this.isVideoMesh = clusterInfo.isVideoMesh;

    this.reachabilityPeerConnection = new ReachabilityPeerConnection(clusterInfo, name);

    this.reachabilityPeerConnection.on(ReachabilityPeerConnectionEvents.resultReady, (data) => {
      this.emit(
        {
          file: 'clusterReachability',
          function: 'onResultReady',
        },
        Events.resultReady,
        data
      );
    });

    this.reachabilityPeerConnection.on(
      ReachabilityPeerConnectionEvents.clientMediaIpsUpdated,
      (data) => {
        this.emit(
          {
            file: 'clusterReachability',
            function: 'onClientMediaIpsUpdated',
          },
          Events.clientMediaIpsUpdated,
          data
        );
      }
    );

    this.reachabilityPeerConnection.on(ReachabilityPeerConnectionEvents.natTypeUpdated, (data) => {
      this.emit(
        {
          file: 'clusterReachability',
          function: 'onNatTypeUpdated',
        },
        Events.natTypeUpdated,
        data
      );
    });

    this.reachabilityPeerConnection.on(ReachabilityPeerConnectionEvents.reachedSubnets, (data) => {
      data.subnets.forEach((subnet) => {
        this.reachedSubnets.add(subnet);
      });
    });
  }

  /**
   * @returns {ClusterReachabilityResult} reachability result for this cluster
   */
  getResult(): ClusterReachabilityResult {
    return this.reachabilityPeerConnection.getResult();
  }

  /**
   * Starts the process of doing UDP, TCP, and XTLS reachability checks on the media cluster.
   * @returns {Promise<ClusterReachabilityResult>}
   */
  async start(): Promise<ClusterReachabilityResult> {
    await this.reachabilityPeerConnection.start();

    return this.getResult();
  }

  /**
   * Aborts the cluster reachability checks
   * @returns {void}
   */
  public abort() {
    this.reachabilityPeerConnection.abort();
  }
}
