/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import EventEmitter from 'events';

import LoggerProxy from '../common/logs/logger-proxy';
import type {IWasmLoader} from './WasmLoader';
import type {
  E2eeKey,
  E2eeRosterMember,
  IMlsHttpClient,
  MlsGroupSessionConfig,
  SframeParams,
} from './types';
import type {
  EpochInfo,
  HTTPRequest,
  RosterMember,
  TransactionResult,
  WebE2EEInstance,
} from './wasm';

const DEFAULT_JOIN_TIMEOUT = 180_000;
const DEFAULT_COALESCE_WINDOW = 500;
const DEFAULT_DEVICE_TYPE = 'WEB';

// WASM log levels, indexed by the numeric level the engine emits.
const WASM_LOG_LEVELS = ['', 'FATAL', 'ERROR', 'INFO', 'WARN', 'DEBUG'];

/** Minimal logger the engine needs; defaults to the plugin logger. */
export interface ILogger {
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  debug(...args: any[]): void;
}

/** Timer abstraction, injectable so tests can control scheduling. */
export interface ITimers {
  setTimeout(handler: () => void, milliseconds: number): void;
}

/** Payloads for each event emitted by {@link MlsGroupSession}. */
export interface MlsGroupSessionEventMap {
  joinSuccess: {epoch: number; securityCode: string; sframe: SframeParams; key: E2eeKey};
  joinFailure: {reason: string};
  newKey: E2eeKey;
  useKey: {epoch: number};
  purgeKeys: {epoch: number};
  rosterAdded: E2eeRosterMember[];
  rosterRemoved: {urls: string[]};
  leaderChanged: {isLeader: boolean};
  evicted: void;
  versionNegotiated: {version: number};
  securityCodeChanged: {code: string};
}

export type MlsGroupSessionEvent = keyof MlsGroupSessionEventMap;

const defaultTimers: ITimers = {
  setTimeout: (handler, milliseconds) => {
    setTimeout(handler, milliseconds);
  },
};

/**
 * Pure MLS protocol engine wrapping the WebE2EE WASM module. It has no webex/HTTP/LLM
 * dependencies: all I/O flows through injected collaborators (an {@link IMlsHttpClient} and
 * timers), and all outputs are emitted as typed events. This keeps it unit-testable in isolation.
 */
export default class MlsGroupSession {
  private readonly wasmLoader: IWasmLoader;

  private readonly httpClient: IMlsHttpClient;

  private readonly timers: ITimers;

  private readonly logger: ILogger;

  private readonly emitter = new EventEmitter();

  private e2ee: WebE2EEInstance | null = null;

  private lastSecurityCode = '';

  /**
   * @param {Object} deps
   * @param {IMlsHttpClient} deps.httpClient - Transport for the engine's protocol requests.
   * @param {IWasmLoader} deps.wasmLoader - Loader for the (pre-warmed) WASM module.
   * @param {ITimers} [deps.timers] - Timer abstraction; defaults to global setTimeout.
   * @param {ILogger} [deps.logger] - Logger for WASM log output.
   */
  constructor({
    httpClient,
    wasmLoader,
    timers = defaultTimers,
    logger,
  }: {
    httpClient: IMlsHttpClient;
    wasmLoader: IWasmLoader;
    timers?: ITimers;
    logger?: ILogger;
  }) {
    this.httpClient = httpClient;
    this.wasmLoader = wasmLoader;
    this.timers = timers;
    this.logger = logger ?? LoggerProxy.logger;
  }

  /**
   * Subscribe to an engine event.
   * @param {MlsGroupSessionEvent} event
   * @param {Function} listener
   * @returns {void}
   */
  on<K extends MlsGroupSessionEvent>(
    event: K,
    listener: (payload: MlsGroupSessionEventMap[K]) => void
  ): void {
    this.emitter.on(event, listener as (payload: unknown) => void);
  }

  /**
   * Unsubscribe from an engine event.
   * @param {MlsGroupSessionEvent} event
   * @param {Function} listener
   * @returns {void}
   */
  off<K extends MlsGroupSessionEvent>(
    event: K,
    listener: (payload: MlsGroupSessionEventMap[K]) => void
  ): void {
    this.emitter.off(event, listener as (payload: unknown) => void);
  }

  /**
   * @param {MlsGroupSessionEvent} event
   * @param {*} [payload]
   * @returns {void}
   */
  private emitEvent<K extends MlsGroupSessionEvent>(
    event: K,
    payload?: MlsGroupSessionEventMap[K]
  ): void {
    this.emitter.emit(event, payload);
  }

  /**
   * Loads the WASM module, instantiates the engine, wires its callbacks, and applies credentials,
   * trust anchors and timeouts. Must be called before {@link join}.
   * @param {MlsGroupSessionConfig} config
   * @returns {Promise<void>}
   */
  async initialize(config: MlsGroupSessionConfig): Promise<void> {
    const module = await this.wasmLoader.get();

    this.e2ee = new module.WebE2EE();
    this.setupCallbacks();

    this.e2ee.initialize(
      config.participantId,
      config.deviceUrl,
      config.deviceType || DEFAULT_DEVICE_TYPE,
      config.correlationId,
      config.displayName,
      config.serviceUrl
    );

    if (config.credentials) {
      const {privateKey} = config.credentials;
      const certChain = config.credentials.certChain.map((cert) => new Uint8Array(cert));

      this.e2ee.addX509Credential(privateKey, certChain);
    }

    if (config.trustAnchors) {
      this.e2ee.setTrustAnchors(
        config.trustAnchors.webexCaRoots || '',
        config.trustAnchors.domainNameRoots || '',
        config.trustAnchors.userIdentityRoots || ''
      );
    }

    this.e2ee.setJoinTimeout(config.joinTimeout ?? DEFAULT_JOIN_TIMEOUT);
    this.e2ee.setCoalesceWindow(config.coalesceWindow ?? DEFAULT_COALESCE_WINDOW);
  }

  /**
   * @returns {void}
   */
  private setupCallbacks(): void {
    const {e2ee} = this;

    if (!e2ee) {
      return;
    }

    e2ee.setOnCompleteTransaction((_id, result: TransactionResult) => {
      if (result.status === 'join_success') {
        this.lastSecurityCode = result.sec_code;
        this.emitEvent('joinSuccess', {
          epoch: result.epoch,
          securityCode: result.sec_code,
          sframe: {
            cipherSuite: result.sframe_cipher_suite,
            epochBits: result.sframe_epoch_bits,
          },
          key: {
            epoch: result.epoch,
            baseKey: new Uint8Array(result.base_key),
            index: result.index,
            indexBits: result.index_bits,
            canEncrypt: false,
          },
        });
      } else if (result.status === 'failure') {
        this.emitEvent('joinFailure', {reason: result.reason});
      }
    });

    e2ee.setOnHttpRequest((request: HTTPRequest) => {
      this.httpClient
        .request(request.url, new Uint8Array(request.body))
        .then((response) => {
          this.e2ee?.completeHttpRequest(request.handlerId, true, new Uint8Array(response), 0, '');
        })
        .catch((error) => {
          this.e2ee?.completeHttpRequest(
            request.handlerId,
            false,
            new Uint8Array(0),
            error?.code || 0,
            error?.message || 'Request failed'
          );
        });
    });

    e2ee.setOnWait((milliseconds, handlerId) => {
      this.timers.setTimeout(() => {
        this.e2ee?.completeWait(handlerId);
      }, milliseconds);
    });

    e2ee.setOnGotKey((epoch: EpochInfo) => {
      this.emitEvent('newKey', {
        epoch: epoch.epoch,
        baseKey: new Uint8Array(epoch.base_key),
        index: epoch.index,
        indexBits: epoch.index_bits,
        canEncrypt: false,
      });
    });

    e2ee.setOnUseKey((epoch: number) => {
      this.emitEvent('useKey', {epoch});
      this.emitSecurityCodeIfChanged();
    });

    e2ee.setOnPurgeBefore((epoch: number) => {
      this.emitEvent('purgeKeys', {epoch});
    });

    e2ee.setOnLeader(() => {
      this.emitEvent('leaderChanged', {isLeader: true});
    });

    e2ee.setOnAddRoster((added: RosterMember[]) => {
      this.emitEvent('rosterAdded', added.map(MlsGroupSession.toRosterMember));
      this.emitSecurityCodeIfChanged();
    });

    e2ee.setOnRemoveRoster((removed: string[]) => {
      this.emitEvent('rosterRemoved', {urls: removed});
      this.emitSecurityCodeIfChanged();
    });

    e2ee.setOnEvicted(() => {
      this.emitEvent('evicted');
    });

    e2ee.setOnE2eeVersion((version: number) => {
      this.emitEvent('versionNegotiated', {version});
    });

    e2ee.setOnMissingCommit((mlsEpoch, useKeyEpoch) => {
      this.logger.warn(
        `MlsGroupSession --> missing commit (mlsEpoch=${mlsEpoch}, useKeyEpoch=${useKeyEpoch})`
      );
    });

    e2ee.setOnLog((level: number, message: string) => {
      const label = WASM_LOG_LEVELS[level] ?? '';

      switch (level) {
        case 1:
        case 2:
          this.logger.error(`[E2EE ${label}] ${message}`);
          break;
        case 4:
          this.logger.warn(`[E2EE ${label}] ${message}`);
          break;
        case 5:
          this.logger.debug(`[E2EE ${label}] ${message}`);
          break;
        default:
          this.logger.info(`[E2EE ${label}] ${message}`);
      }
    });
  }

  /**
   * @returns {void}
   */
  private emitSecurityCodeIfChanged(): void {
    const code = this.getSecurityCode();

    if (code && code !== this.lastSecurityCode) {
      this.lastSecurityCode = code;
      this.emitEvent('securityCodeChanged', {code});
    }
  }

  /**
   * Starts the MLS join.
   * @returns {void}
   */
  join(): void {
    this.assertInitialized().join();
  }

  /**
   * Leaves the MLS group.
   * @returns {void}
   */
  leave(): void {
    this.assertInitialized().leave();
  }

  /**
   * Forwards an incoming MLS protocol event (from the signaling channel) to the engine.
   * @param {Uint8Array} eventData
   * @returns {void}
   */
  handleEvent(eventData: Uint8Array): void {
    this.assertInitialized().handle(new Uint8Array(eventData));
  }

  /**
   * Tells the engine whether the signaling channel was already connected before join.
   * @param {boolean} connected
   * @returns {void}
   */
  setLlmConnectedBeforeJoin(connected: boolean): void {
    this.assertInitialized().setLlmConnectedBeforeJoin(connected);
  }

  /**
   * Notifies the engine that the signaling channel is now connected.
   * @returns {void}
   */
  notifyLlmConnected(): void {
    this.assertInitialized().llmConnected();
  }

  /**
   * Sends an engine keep-alive.
   * @returns {void}
   */
  keepAlive(): void {
    this.assertInitialized().keepAlive();
  }

  /**
   * @returns {string} the current security code, or '' if not initialized.
   */
  getSecurityCode(): string {
    return this.e2ee ? this.e2ee.securityCode() : '';
  }

  /**
   * @returns {E2eeRosterMember[]} the current MLS roster, or [] if not initialized.
   */
  getRoster(): E2eeRosterMember[] {
    return this.e2ee ? this.e2ee.roster().map(MlsGroupSession.toRosterMember) : [];
  }

  /**
   * @returns {boolean} whether this client is the group leader.
   */
  isLeader(): boolean {
    return this.e2ee ? this.e2ee.isLeader() : false;
  }

  /**
   * @returns {WebE2EEInstance}
   */
  private assertInitialized(): WebE2EEInstance {
    if (!this.e2ee) {
      throw new Error('MlsGroupSession not initialized');
    }

    return this.e2ee;
  }

  /**
   * @param {RosterMember} member - raw WASM roster member.
   * @returns {E2eeRosterMember}
   */
  private static toRosterMember(member: RosterMember): E2eeRosterMember {
    return {
      url: member.url,
      displayName: member.display_name,
      deviceType: member.device_type,
      validationResult: member.validation_result,
    };
  }
}
