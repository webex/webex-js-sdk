import {Defer} from '@webex/common';
import {Address4, Address6} from 'ip-address';

import LoggerProxy from '../common/logs/logger-proxy';
import {convertStunUrlToTurn, convertStunUrlToTurnTls} from './util';
import EventsScope from '../common/events/events-scope';

import {
  CONNECTION_STATE,
  Enum,
  ICE_GATHERING_STATE,
  STUN_GENERIC_URL_REGEX,
  TURN_GENERIC_URL_REGEX,
  PROTOCOLS_LIST,
} from '../constants';
import {ClusterReachabilityResult, NatType, SubnetDetails, ClusterNode} from './reachability.types';

declare global {
  interface RTCIceCandidate {
    url?: string; // currently only supported in Chrome/Edge
  }
}

// data for the Events.resultReady event
export type ResultEventData = {
  protocol: 'udp' | 'tcp' | 'xtls';
  result: 'reachable' | 'unreachable' | 'untested';
  latencyInMilliseconds: number; // amount of time it took to get the ICE candidate
  clientMediaIPs?: string[];
  details: SubnetDetails[];
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
  resultDetailsUpdated: 'resultDetailsUpdated', // emitted when the details of the reachability result are updated
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
  public readonly name: string;

  public clusterInfo: ClusterNode;

  /**
   * Constructor for ClusterReachability
   * @param {string} name cluster name
   * @param {ClusterNode} clusterInfo information about the media cluster
   */
  constructor(name: string, clusterInfo: ClusterNode) {
    super();
    this.name = name;
    this.clusterInfo = clusterInfo;
    this.isVideoMesh = !!clusterInfo.isVideoMesh;
    this.numUdpUrls = Array.isArray(clusterInfo.udp) ? clusterInfo.udp.length : 0;
    this.numTcpUrls = Array.isArray(clusterInfo.tcp) ? clusterInfo.tcp.length : 0;
    this.numXTlsUrls = Array.isArray(clusterInfo.xtls) ? clusterInfo.xtls.length : 0;

    this.defer = new Defer();
    this.result = {
      udp: {
        result: 'untested',
        details: [],
      },
      tcp: {
        result: 'untested',
        details: [],
      },
      xtls: {
        result: 'untested',
        details: [],
      },
    };
    this.startTimestamp = 0;
  }

  public ICE_GATHERING_TIMEOUT = 5000;

  private perUrlProtocols: Set<'udp' | 'tcp' | 'xtls'> = new Set();

  public enablePerUrlMode(protocols: ('udp' | 'tcp' | 'xtls')[] = ['udp']) {
    this.perUrlProtocols = new Set(protocols);
  }

  private buildSingleServerConfig(
    protocol: 'udp' | 'tcp' | 'xtls',
    rawUrl: string
  ): RTCConfiguration {
    let urls = rawUrl;
    if (protocol === 'tcp') {
      urls = convertStunUrlToTurn(rawUrl, 'tcp');
    } else if (protocol === 'xtls') {
      urls = convertStunUrlToTurnTls(rawUrl);
    }
    const entry =
      protocol === 'udp'
        ? {username: '', credential: '', urls: [urls]}
        : {username: 'webexturnreachuser', credential: 'webexturnreachpwd', urls: [urls]};

    return {iceServers: [entry], iceTransportPolicy: 'all', iceCandidatePoolSize: 0};
  }

  // Ensure upsert uses raw host string even if not a literal IP.
  private upsertDetailByHost(protocol: 'udp' | 'tcp' | 'xtls', host: string, port: number) {
    const {details} = this.result[protocol];
    let existing = details.find((subnet) => subnet.serverIp === host && subnet.port === port);
    if (!existing) {
      existing = {
        serverIp: host,
        port,
        'answered-tx': 0,
        'lost-tx': 0,
        latencies: [],
      };
      details.push(existing);
    }

    return existing;
  }

  private parseStunUrl(rawUrl: string): {host?: string; port?: number} {
    const match = rawUrl.match(STUN_GENERIC_URL_REGEX);
    if (match) {
      return {host: match[1], port: Number(match[2])};
    }
    const stripped = rawUrl.replace(/^stun:/i, '').split(';')[0];
    const parts = stripped.split(':');
    if (parts.length >= 2) {
      const port = Number(parts.pop());

      return {host: parts.join(':'), port: Number.isNaN(port) ? undefined : port};
    }

    return {};
  }

  private isLiteralIp(host?: string): boolean {
    if (!host) return false;

    return Address4.isValid(host) || Address6.isValid(host);
  }

  private prePopulateDetails(protocols: ('udp' | 'tcp' | 'xtls')[]) {
    protocols.forEach((protocol) => {
      const urls = this.clusterInfo[protocol] || [];
      urls.forEach((url) => {
        const {host, port} = this.parseStunUrl(url);
        if (!host || port == null) return;
        if (!this.isLiteralIp(host)) return;
        this.upsertDetailByHost(protocol, host, port);
        if (this.result[protocol].result === 'untested') {
          this.result[protocol].result = 'unreachable';
        }
      });
    });
  }

  private async probeSingleUrl(protocol: 'udp' | 'tcp' | 'xtls', rawUrl: string): Promise<void> {
    const {host, port} = this.parseStunUrl(rawUrl);
    if (host && port != null && this.isLiteralIp(host)) {
      this.upsertDetailByHost(protocol, host, port);
    }

    const pc = new RTCPeerConnection(this.buildSingleServerConfig(protocol, rawUrl));
    const startTs = performance.now();
    let answered = false;

    const finalize = (success: boolean) => {
      if (!success && host && port != null) {
        const det = this.result[protocol].details.find(
          (d) => d.serverIp === host && d.port === port
        );
        if (det && det['answered-tx'] === 0) {
          det['lost-tx'] = 1;
          if (this.result[protocol].latencyInMilliseconds !== undefined) {
            this.emit(
              {file: 'clusterReachability', function: 'probeFinalize'},
              Events.resultDetailsUpdated,
              {protocol, ...this.result[protocol]}
            );
          }
        }
      }
      try {
        pc.close();
      } catch (e) {
        // swallow close errors intentionally
      }
    };

    return new Promise((resolve) => {
      const startAsync = async () => {
        const timeoutId = setTimeout(() => {
          finalize(false);
          resolve();
        }, this.ICE_GATHERING_TIMEOUT);

        pc.onicecandidate = (ev) => {
          const c = ev.candidate;
          if (!c) return;

          if (c.type === 'srflx' && protocol === 'udp') {
            if (host && port !== undefined) {
              const latency = Math.round(performance.now() - startTs);
              this.saveResult('udp', latency, (c as any).address, host, port);
              this.determineNatType(c);
              answered = true;
            }
          }

          if (answered) {
            clearTimeout(timeoutId);
            finalize(true);
            resolve();
          }
        };

        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === ICE_GATHERING_STATE.COMPLETE && !answered) {
            clearTimeout(timeoutId);
            finalize(false);
            resolve();
          }
        };

        try {
          pc.createDataChannel('probe');
          const offer = await pc.createOffer({offerToReceiveAudio: true});
          await pc.setLocalDescription(offer);
        } catch (err) {
          clearTimeout(timeoutId);
          finalize(false);
          resolve();
        }
      };
      // kick off async flow
      startAsync();
    });
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
    for (const protocol of PROTOCOLS_LIST) {
      const transport = this.result[protocol];
      if (transport) {
        for (const d of transport.details) {
          if (d['answered-tx'] === 0) d['lost-tx'] = 1;
        }
      }
    }
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
    } else if (!this.pc) {
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
    if (serverIp == null || port == null) return;

    let subnet = result.details.find((s) => s.serverIp === serverIp && s.port === port);
    if (!subnet) {
      if (protocol === 'udp' && this.perUrlProtocols.size === 0) {
        // legacy mode: never add new UDP entries
        return;
      }
      // per-url mode or tcp/xtls: allow create
      subnet = {
        serverIp,
        port,
        'answered-tx': 0,
        'lost-tx': 0,
        latencies: [],
      };
      result.details.push(subnet);
      if (result.result === 'untested') result.result = 'unreachable';
    }

    // LEGACY UDP MODE GUARD:
    // If we already marked one UDP subnet reachable (latency set) in legacy mode,
    // do NOT convert any other (still unanswered) subnet to answered.
    if (
      protocol === 'udp' &&
      this.perUrlProtocols.size === 0 && // legacy (single-PC) mode
      result.latencyInMilliseconds !== undefined && // already have a success
      subnet['answered-tx'] === 0 // this one was still lost
    ) {
      // Ignore this additional successful candidate to keep only first as answered.
      // (Still allow NAT detection elsewhere since determineNatType already ran.)
      return;
    }

    subnet['answered-tx'] = 1;
    subnet['lost-tx'] = 0;
    subnet.latencies = [latency];

    if (result.latencyInMilliseconds === undefined) {
      LoggerProxy.logger.log(
        `Reachability:cluster#saveResult --> Reached ${this.name} over ${protocol}: ${latency}ms`
      );
      result.latencyInMilliseconds = latency;
      result.result = 'reachable';
      if (publicIp) result.clientMediaIPs = [publicIp];
      this.emit({file: 'clusterReachability', function: 'saveResult'}, Events.resultReady, {
        protocol,
        ...result,
      });
    } else {
      this.emit(
        {file: 'clusterReachability', function: 'saveResult'},
        Events.resultDetailsUpdated,
        {protocol, ...result}
      );
      this.addPublicIP(protocol, publicIp);
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
    if (this.perUrlProtocols.size > 0) {
      this.pc.onicecandidate = ({candidate}) => {
        if (!candidate) return;
        const TURN_TLS_PORT = 443;
        const CANDIDATE_TYPES = {
          SERVER_REFLEXIVE: 'srflx',
          RELAY: 'relay',
        };
        const latencyInMilliseconds = this.getElapsedTime();

        let serverIp: string = null;
        let port: number = null;

        if (candidate.url) {
          const stunMatch = candidate.url.match(STUN_GENERIC_URL_REGEX);
          if (stunMatch) {
            const [, host, p] = stunMatch; // prefer-destructuring (no reassignment to array indices)
            serverIp = host;
            port = Number(p);
          } else {
            const turnMatch = candidate.url.match(TURN_GENERIC_URL_REGEX);
            if (turnMatch) {
              const [, , host, p] = turnMatch;
              serverIp = host;
              port = Number(p);
            }
          }
        }

        if (!port && (candidate as any).port) port = (candidate as any).port;
        if (candidate.type === CANDIDATE_TYPES.RELAY && !serverIp && (candidate as any).address) {
          serverIp = (candidate as any).address;
        }

        if (candidate.type === CANDIDATE_TYPES.SERVER_REFLEXIVE) {
          if (!serverIp && this.result.udp.details.length) {
            const first =
              this.result.udp.details.find((d) => d['answered-tx'] === 0) ||
              this.result.udp.details[0];
            if (first) {
              serverIp = first.serverIp;
              port = first.port;
            }
          }
          this.saveResult('udp', latencyInMilliseconds, (candidate as any).address, serverIp, port);
          this.determineNatType(candidate);
        } else if (candidate.type === CANDIDATE_TYPES.RELAY) {
          const protocol = port === TURN_TLS_PORT ? 'xtls' : 'tcp';
          this.saveResult(protocol, latencyInMilliseconds, null, serverIp, port);
        }
      };

      return;
    }

    this.pc.onicecandidate = ({candidate}) => {
      if (!candidate) return;
      const TURN_TLS_PORT = 443;
      const CANDIDATE_TYPES = {SERVER_REFLEXIVE: 'srflx', RELAY: 'relay'};
      const latencyInMilliseconds = this.getElapsedTime();

      let serverIp: string = null;
      let port: number = null;

      if (candidate.url) {
        const match = candidate.url.match(STUN_GENERIC_URL_REGEX);
        if (match) {
          const [, host, p] = match; // prefer-destructuring
          serverIp = host;
          port = Number(p);
        }
      }
      if (!serverIp && (candidate as any).address) serverIp = (candidate as any).address;
      if (!port && (candidate as any).port) port = (candidate as any).port;

      if (candidate.type === CANDIDATE_TYPES.SERVER_REFLEXIVE) {
        this.saveResult('udp', latencyInMilliseconds, (candidate as any).address, serverIp, port);
        this.determineNatType(candidate);
      } else if (candidate.type === CANDIDATE_TYPES.RELAY) {
        const protocol = port === TURN_TLS_PORT ? 'xtls' : 'tcp';
        this.saveResult(protocol, latencyInMilliseconds, null, serverIp, port);
      }
    };
  }

  /**
   * Starts the process of doing UDP and TCP reachability checks on the media cluster.
   * XTLS reachability checking is not supported.
   *
   * @returns {Promise}
   */
  async start(): Promise<ClusterReachabilityResult> {
    const perUrlUdpOnly = this.perUrlProtocols.size === 1 && this.perUrlProtocols.has('udp');

    // Per‑URL UDP multi‑PC mode
    if (perUrlUdpOnly) {
      if (
        (!this.pc || this.pc.connectionState === 'closed') &&
        (this.numTcpUrls > 0 || this.numXTlsUrls > 0)
      ) {
        this.pc = this.createPeerConnection({...this.clusterInfo, udp: []} as ClusterNode);
        if (!this.pc) {
          LoggerProxy.logger.warn(
            'Reachability:ClusterReachability#start --> Unable to create shared peerConnection for tcp/xtls (will still run per-URL UDP probes)'
          );
        }
      }

      const udpUrls = Array.isArray(this.clusterInfo.udp) ? this.clusterInfo.udp : [];
      this.result.udp = {
        result: udpUrls.length ? 'unreachable' : 'untested',
        details: [],
      };

      // Pre-populate literal IP endpoints (udp/tcp/xtls) to keep legacy detail style
      this.prePopulateDetails(['udp', 'tcp', 'xtls']);

      const udpPromises = udpUrls.map((u) => this.probeSingleUrl('udp', u));
      let sharedPcPromise: Promise<any> = Promise.resolve();

      if (this.pc) {
        try {
          const offer = await this.pc.createOffer({offerToReceiveAudio: true});
          this.startTimestamp = performance.now();
          const gatherPromise = this.gatherIceCandidates();
          this.pc.setLocalDescription(offer);
          sharedPcPromise = gatherPromise;
        } catch {
          // ignore
        }
      }

      await Promise.all([...udpPromises, sharedPcPromise]);

      for (const protocol of PROTOCOLS_LIST as ('udp' | 'tcp' | 'xtls')[]) {
        this.emitUnreachableIfNeeded(protocol);
      }

      return this.result;
    }

    if (!this.pc || this.pc.connectionState === 'closed') {
      this.pc = this.createPeerConnection(this.clusterInfo);
      if (!this.pc) return this.result;
    }
    // Initialize each protocol in this.result as saying that nothing is reachable.
    // It will get updated as we go along and successfully gather ICE candidates.
    this.result.udp = {
      result: this.numUdpUrls > 0 ? 'unreachable' : 'untested',
      details: [],
    };
    this.result.tcp = {
      result: this.numTcpUrls > 0 ? 'unreachable' : 'untested',
      details: [],
    };
    this.result.xtls = {
      result: this.numXTlsUrls > 0 ? 'unreachable' : 'untested',
      details: [],
    };

    for (const protocol of PROTOCOLS_LIST) {
      const urls = this.clusterInfo[protocol] || [];
      for (const url of urls) {
        const match = url.match(STUN_GENERIC_URL_REGEX);
        if (match) {
          const [, serverIp, port] = match; // explicit destructuring (prefer-destructuring)
          try {
            if (Address4.isValid(serverIp) || Address6.isValid(serverIp)) {
              this.result[protocol].details.push({
                serverIp,
                port: Number(port),
                'answered-tx': 0,
                'lost-tx': 1, // will flip to 0 if answered
                latencies: [],
              });
            }
          } catch (err) {
            LoggerProxy.logger.error(
              'Reachability:ClusterReachability#start --> IP check failed:',
              err
            );
          }
        }
      }
    }

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

    for (const protocol of PROTOCOLS_LIST as ('udp' | 'tcp' | 'xtls')[]) {
      this.emitUnreachableIfNeeded(protocol);
    }

    return this.result;
  }

  private emitUnreachableIfNeeded(protocol: 'udp' | 'tcp' | 'xtls') {
    const r = this.result[protocol];
    if (!r) return;
    if (r.result === 'unreachable' && r.latencyInMilliseconds === undefined) {
      this.emit(
        {file: 'clusterReachability', function: 'emitUnreachableIfNeeded'},
        Events.resultReady,
        {protocol, ...r}
      );
    }
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
