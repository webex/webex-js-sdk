import {ClusterNode} from './request';
import EventsScope from '../common/events/events-scope';
import LoggerProxy from '../common/logs/logger-proxy';

import {Enum} from '../constants';
import {
  ClusterReachabilityResult,
  NatType,
  ReachabilityPeerConnectionEvents,
  SubnetDetail,
} from './reachability.types';
import {ReachabilityPeerConnection} from './reachabilityPeerConnection';
import {parseIceServerUrl} from './util';

// data for the Events.resultReady event
export type ResultEventData = {
  protocol: 'udp' | 'tcp' | 'xtls';
  result: 'reachable' | 'unreachable' | 'untested';
  latencyInMilliseconds: number; // amount of time it took to get the ICE candidate
  clientMediaIPs?: string[];
  details?: SubnetDetail[];
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
  resultReady: 'resultReady', // emitted when a reachability result is available for a specific protocol (reachable or unreachable)
  clientMediaIpsUpdated: 'clientMediaIpsUpdated', // emitted when more public IPs are found after resultReady was already sent for a given protocol
  natTypeUpdated: 'natTypeUpdated', // emitted when NAT type is determined
} as const;

export type Events = Enum<typeof Events>;

/**
 * A class that handles reachability checks for a single cluster.
 * Creates and orchestrates ReachabilityPeerConnection instance(s).
 * Listens to events and emits them to consumers.
 *
 * When enablePerUdpUrlReachability is true:
 *   - Creates one ReachabilityPeerConnection for each UDP URL
 *   - Creates one ReachabilityPeerConnection for all TCP and TLS URLs together
 * Otherwise:
 *   - Creates a single ReachabilityPeerConnection for all URLs
 */
export class ClusterReachability extends EventsScope {
  private reachabilityPeerConnection: ReachabilityPeerConnection | null = null;
  private reachabilityPeerConnectionsForUdp: ReachabilityPeerConnection[] = [];

  public readonly isVideoMesh: boolean;
  public readonly name;
  public readonly reachedSubnets: Set<string> = new Set();

  // Store original cluster URLs for getAllClustersInfo()
  private readonly clusterUrls: {udp: string[]; tcp: string[]; xtls: string[]};

  private enablePerUdpUrlReachability: boolean;
  private udpResultEmitted = false;
  private udpResultsReceived = 0;

  /**
   * Constructor for ClusterReachability
   * @param {string} name cluster name
   * @param {ClusterNode} clusterInfo information about the media cluster
   * @param {boolean} enablePerUdpUrlReachability whether to create separate peer connections per UDP URL
   */
  constructor(name: string, clusterInfo: ClusterNode, enablePerUdpUrlReachability = false) {
    super();
    this.name = name;
    this.isVideoMesh = clusterInfo.isVideoMesh;
    this.enablePerUdpUrlReachability = enablePerUdpUrlReachability;

    // Store original URLs for later retrieval
    this.clusterUrls = {
      udp: clusterInfo.udp || [],
      tcp: clusterInfo.tcp || [],
      xtls: clusterInfo.xtls || [],
    };

    if (this.enablePerUdpUrlReachability) {
      this.initializePerUdpUrlReachabilityCheck(clusterInfo);
    } else {
      this.initializeSingleReachabilityPeerConnection(clusterInfo);
    }
  }

  /**
   * Initializes a single ReachabilityPeerConnection for all protocols
   * @param {ClusterNode} clusterInfo information about the media cluster
   * @returns {void}
   */
  private initializeSingleReachabilityPeerConnection(clusterInfo: ClusterNode) {
    this.reachabilityPeerConnection = new ReachabilityPeerConnection(this.name, clusterInfo);
    this.setupReachabilityPeerConnectionEventListeners(this.reachabilityPeerConnection);
  }

  /**
   * Initializes per-URL UDP reachability checks:
   * - One ReachabilityPeerConnection per UDP URL
   * - One ReachabilityPeerConnection for all TCP and TLS URLs together
   * @param {ClusterNode} clusterInfo information about the media cluster
   * @returns {void}
   */
  private initializePerUdpUrlReachabilityCheck(clusterInfo: ClusterNode) {
    LoggerProxy.logger.log(
      `ClusterReachability#initializePerUdpUrlReachabilityCheck --> cluster: ${this.name}, performing per-URL UDP reachability for ${clusterInfo.udp.length} URLs`
    );

    // Create one ReachabilityPeerConnection for each UDP URL
    // enablePerUdpUrlReachability=true enables subnet details tracking
    clusterInfo.udp.forEach((udpUrl) => {
      const singleUdpClusterInfo: ClusterNode = {
        isVideoMesh: clusterInfo.isVideoMesh,
        udp: [udpUrl],
        tcp: [],
        xtls: [],
      };
      const rpc = new ReachabilityPeerConnection(this.name, singleUdpClusterInfo, true);
      this.setupReachabilityPeerConnectionEventListeners(rpc, true);
      this.reachabilityPeerConnectionsForUdp.push(rpc);
    });

    // Create one ReachabilityPeerConnection for all TCP and TLS URLs together
    if (clusterInfo.tcp.length > 0 || clusterInfo.xtls.length > 0) {
      const tcpTlsClusterInfo: ClusterNode = {
        isVideoMesh: clusterInfo.isVideoMesh,
        udp: [],
        tcp: clusterInfo.tcp,
        xtls: clusterInfo.xtls,
      };
      this.reachabilityPeerConnection = new ReachabilityPeerConnection(
        this.name,
        tcpTlsClusterInfo,
        true
      );
      this.setupReachabilityPeerConnectionEventListeners(this.reachabilityPeerConnection);
    }
  }

  /**
   * Sets up event listeners for a ReachabilityPeerConnection instance
   * @param {ReachabilityPeerConnection} rpc the ReachabilityPeerConnection instance
   * @param {boolean} isUdpPerUrl whether this is a per-URL UDP instance
   * @returns {void}
   */
  private setupReachabilityPeerConnectionEventListeners(
    rpc: ReachabilityPeerConnection,
    isUdpPerUrl = false
  ) {
    rpc.on(ReachabilityPeerConnectionEvents.resultReady, (data) => {
      // For per-URL UDP instances, only handle UDP events
      if (isUdpPerUrl) {
        if (data.protocol !== 'udp') return;

        // Track completion of per-URL instances
        this.udpResultsReceived += 1;

        // Emit aggregated result on first reachable OR when all instances complete
        const allInstancesComplete =
          this.udpResultsReceived === this.reachabilityPeerConnectionsForUdp.length;

        if (!this.udpResultEmitted && (data.result === 'reachable' || allInstancesComplete)) {
          this.udpResultEmitted = true;

          const aggregated = this.aggregateUdpResults();

          this.emit(
            {
              file: 'clusterReachability',
              function: 'setupReachabilityPeerConnectionEventListeners',
            },
            Events.resultReady,
            {
              protocol: 'udp',
              ...aggregated,
            }
          );
        }

        return;
      }

      this.emit(
        {
          file: 'clusterReachability',
          function: 'setupReachabilityPeerConnectionEventListeners',
        },
        Events.resultReady,
        data
      );
    });

    rpc.on(ReachabilityPeerConnectionEvents.clientMediaIpsUpdated, (data) => {
      this.emit(
        {
          file: 'clusterReachability',
          function: 'setupReachabilityPeerConnectionEventListeners',
        },
        Events.clientMediaIpsUpdated,
        data
      );
    });

    rpc.on(ReachabilityPeerConnectionEvents.natTypeUpdated, (data) => {
      this.emit(
        {
          file: 'clusterReachability',
          function: 'setupReachabilityPeerConnectionEventListeners',
        },
        Events.natTypeUpdated,
        data
      );
    });

    rpc.on(ReachabilityPeerConnectionEvents.reachedSubnets, (data) => {
      data.subnets.forEach((subnet: string) => {
        this.reachedSubnets.add(subnet);
      });
    });
  }

  /**
   * Gets the aggregated reachability result for this cluster.
   * @returns {ClusterReachabilityResult} reachability result for this cluster
   */
  getResult(): ClusterReachabilityResult {
    if (!this.enablePerUdpUrlReachability) {
      return (
        this.reachabilityPeerConnection?.getResult() ?? {
          udp: {result: 'untested'},
          tcp: {result: 'untested'},
          xtls: {result: 'untested'},
        }
      );
    }

    const result: ClusterReachabilityResult = {
      udp: {result: 'untested'},
      tcp: {result: 'untested'},
      xtls: {result: 'untested'},
    };

    // Aggregate UDP results from all per-URL instances
    result.udp = this.aggregateUdpResults();

    // Get TCP and TLS results from the main peer connection
    if (this.reachabilityPeerConnection) {
      const mainResult = this.reachabilityPeerConnection.getResult();
      result.tcp = mainResult.tcp;
      result.xtls = mainResult.xtls;
    }

    return result;
  }

  /**
   * Aggregates UDP results from all per-URL instances.
   * @returns {TransportResult} aggregated UDP result with details from all instances
   */
  private aggregateUdpResults(): ClusterReachabilityResult['udp'] {
    const allDetails: SubnetDetail[] = [];
    let bestResult: ClusterReachabilityResult['udp'] | null = null;
    let hasUnreachable = false;

    for (const rpc of this.reachabilityPeerConnectionsForUdp) {
      const {udp} = rpc.getResult();

      if (udp.details) {
        allDetails.push(...udp.details);
      }

      if (udp.result === 'reachable') {
        if (!bestResult || udp.latencyInMilliseconds < bestResult.latencyInMilliseconds) {
          bestResult = udp;
        }
      } else if (udp.result === 'unreachable') {
        hasUnreachable = true;
      }
    }

    if (bestResult) {
      return {...bestResult, details: allDetails};
    }

    return {
      result: hasUnreachable ? 'unreachable' : 'untested',
      details: allDetails,
    };
  }

  /**
   * Starts the process of doing UDP, TCP, and XTLS reachability checks on the media cluster.
   * @returns {Promise<ClusterReachabilityResult>}
   */
  async start(): Promise<ClusterReachabilityResult> {
    const startPromises: Promise<ClusterReachabilityResult>[] = [];

    this.reachabilityPeerConnectionsForUdp.forEach((rpc) => {
      startPromises.push(rpc.start());
    });

    if (this.reachabilityPeerConnection) {
      startPromises.push(this.reachabilityPeerConnection.start());
    }

    await Promise.all(startPromises);

    return this.getResult();
  }

  /**
   * Aborts the cluster reachability checks
   * @returns {void}
   */
  public abort() {
    this.reachabilityPeerConnectionsForUdp.forEach((rpc) => rpc.abort());
    this.reachabilityPeerConnection?.abort();
  }

  /**
   * Gets the parsed cluster URLs as "host:port" strings.
   * This always returns the URLs regardless of enablePerUdpUrlReachability flag.
   * @returns {Object} Object with udp, tcp, xtls arrays of "host:port" strings
   */
  public getClusterUrls(): {udp: string[]; tcp: string[]; xtls: string[]} {
    const parseUrls = (urls: string[]): string[] => {
      const result: string[] = [];
      const seen = new Set<string>();

      urls.forEach((url) => {
        const {host, port} = parseIceServerUrl(url);
        if (host && port) {
          const hostPort = `${host}:${port}`;
          if (!seen.has(hostPort)) {
            seen.add(hostPort);
            result.push(hostPort);
          }
        }
      });

      return result;
    };

    return {
      udp: parseUrls(this.clusterUrls.udp),
      tcp: parseUrls(this.clusterUrls.tcp),
      xtls: parseUrls(this.clusterUrls.xtls),
    };
  }
}
