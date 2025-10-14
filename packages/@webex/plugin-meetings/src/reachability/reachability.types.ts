import {IP_VERSION} from '../constants';

// Common type to represent the result for each subnet IP address
type CommonSubnetProperties = {
  port: number; // Port used for the test
  'answered-tx': number; // 1 if reachable, 0 otherwise
  'lost-tx': number; // 1 if unreachable, 0 otherwise
  latencies: number[]; // latency for subnet IP address
};

// Type to represent the result for each subnet IP address (local use)
export type SubnetDetails = CommonSubnetProperties & {
  serverIp: string;
};

// This is the type that matches what backend expects us to send to them
export type SubnetDetailsForBackend = CommonSubnetProperties & {
  serverIps: string;
};

// result for a specific transport protocol (like udp or tcp)
export type TransportResult = {
  result: 'reachable' | 'unreachable' | 'untested';
  latencyInMilliseconds?: number; // amount of time it took to get the first ICE candidate
  clientMediaIPs?: string[];
  details: SubnetDetails[];
};

export enum NatType {
  Unknown = 'unknown',
  SymmetricNat = 'symmetric-nat',
}

// reachability result for a specific media cluster
export type ClusterReachabilityResult = {
  udp: TransportResult;
  tcp: TransportResult;
  xtls: TransportResult;
};

export type ReachabilityMetrics = {
  reachability_public_udp_success: number;
  reachability_public_udp_failed: number;
  reachability_public_tcp_success: number;
  reachability_public_tcp_failed: number;
  reachability_public_xtls_success: number;
  reachability_public_xtls_failed: number;
  reachability_vmn_udp_success: number;
  reachability_vmn_udp_failed: number;
  reachability_vmn_tcp_success: number;
  reachability_vmn_tcp_failed: number;
  reachability_vmn_xtls_success: number;
  reachability_vmn_xtls_failed: number;
  natType: NatType;
};

/**
 * This is the type that matches what backend expects us to send to them. It is a bit weird, because
 * it uses strings instead of booleans and numbers, but that's what they require.
 */
export type TransportResultForBackend = {
  clientMediaIPs?: string[];
  latencyInMilliseconds?: string; // amount of time it took to get the first ICE candidate
  reachable?: 'true' | 'false';
  details?: SubnetDetailsForBackend[];
  minLatency?: number;
  untested?: 'true';
};

export type ReachabilityResultForBackend = {
  udp: TransportResultForBackend;
  tcp: TransportResultForBackend;
  xtls: TransportResultForBackend;
};

// This is the type used when sending reachability results to the backend, with an optional isVideoMesh flag
export type ClusterBackendResult = ReachabilityResultForBackend & {isVideoMesh?: boolean};

// this is the type that is required by the backend when we send them reachability results
export type ReachabilityResultsForBackend = Record<string, ReachabilityResultForBackend>;

// this is the type used by Reachability class internally and stored in local storage
export type ReachabilityResults = Record<
  string,
  ClusterReachabilityResult & {
    isVideoMesh?: boolean;
  }
>;

export type ReachabilityReportV0 = ReachabilityResultsForBackend;

export type ReachabilityReportV1 = {
  version: 1;
  result: {
    usedDiscoveryOptions: {
      'early-call-min-clusters': number;
      // there are more options, but we don't support them yet
    };
    metrics: {
      'total-duration-ms': number;
      // there are more metrics, but we don't support them yet
    };
    tests: Record<string, ReachabilityResultForBackend>;
  };
};

export interface ClientMediaPreferences {
  ipver: IP_VERSION;
  joinCookie: any;
  preferTranscoding: boolean;
  reachability?: ReachabilityReportV1; // only present when using Orpheus API version 1
}

/* Orpheus API supports more triggers, but we don't use them yet */
export type GetClustersTrigger = 'startup' | 'early-call/no-min-reached';

export interface ClusterNode {
  isVideoMesh: boolean;
  udp: string[];
  tcp: string[];
  xtls: string[];
}

// This is the type used to get the cluster URLs.
// Will be used to return the URLs(IPs and domain names with ports) grouped by cluster and protocol.
export type ClusterUrls = Record<string, ClusterNode>;
