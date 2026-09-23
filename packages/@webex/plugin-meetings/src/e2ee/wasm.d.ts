/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * Raw WebAssembly (WebE2EE) boundary types. These mirror the emscripten-generated MLS engine API
 * exactly (including its snake_case fields); the SDK-facing camelCase shapes live in types.ts.
 */

export interface Transaction {
  id: string;
  type: 'join' | 'update';
}

export interface JoinSuccessResult {
  status: 'join_success';
  epoch: number;
  base_key: Uint8Array;
  index: number;
  index_bits: number;
  sec_code: string;
  sframe_cipher_suite: number;
  sframe_epoch_bits: number;
}

export interface UpdateSuccessResult {
  status: 'update_success';
}

export interface TransactionFailureResult {
  status: 'failure';
  reason:
    | 'timeout'
    | 'join_failure'
    | 'tree_fetch_failure'
    | 'commit_fetch_failure'
    | 'update_override';
}

export type TransactionResult = JoinSuccessResult | UpdateSuccessResult | TransactionFailureResult;

export interface HTTPRequest {
  url: string;
  body: Uint8Array;
  handlerId: number;
}

export interface EpochInfo {
  epoch: number;
  base_key: Uint8Array;
  index: number;
  index_bits: number;
  sec_code: string;
}

export interface RosterMember {
  url: string;
  display_name: string;
  device_type: string;
  validation_result: number;
}

export interface WebE2EEInstance {
  initialize(
    participantId: string,
    deviceUrl: string,
    deviceType: string,
    correlationId: string,
    displayName: string,
    serviceUrl: string
  ): void;

  addX509Credential(privateKey: Uint8Array, certChain: Uint8Array[]): void;
  setTrustAnchors(webexCaRoots: string, domainNameRoots: string, userIdentityRoots: string): void;

  join(): void;
  leave(): void;
  joined(): boolean;
  securityCode(): string;
  sessionSecret(): Uint8Array | null;
  contentKey(): Uint8Array | null;
  contentKeyId(): string;
  roster(): RosterMember[];
  handle(event: Uint8Array): void;
  isLeader(): boolean;
  keepAlive(): void;
  llmConnected(): void;
  setLlmConnectedBeforeJoin(connected: boolean): void;
  setGzipThreshold(threshold: number): void;
  setCoalesceWindow(milliseconds: number): void;
  setJoinTimeout(milliseconds: number): void;
  setPurgeKeysTimeout(milliseconds: number): void;

  setOnNewTransaction(callback: (transaction: Transaction) => void): void;
  setOnCompleteTransaction(callback: (id: string, result: TransactionResult) => void): void;
  setOnHttpRequest(callback: (request: HTTPRequest) => void): void;
  setOnWait(callback: (milliseconds: number, handlerId: number) => void): void;
  setOnGotKey(callback: (epoch: EpochInfo) => void): void;
  setOnUseKey(callback: (epoch: number) => void): void;
  setOnLeader(callback: () => void): void;
  setOnPurgeBefore(callback: (epoch: number) => void): void;
  setOnEvicted(callback: () => void): void;
  setOnAddRoster(callback: (added: RosterMember[]) => void): void;
  setOnRemoveRoster(callback: (removed: string[]) => void): void;
  setOnE2eeVersion(callback: (version: number) => void): void;
  setOnMissingCommit(callback: (mlsEpoch: number, useKeyEpoch: number) => void): void;
  setOnLog(callback: (level: number, message: string) => void): void;

  completeHttpRequest(
    handlerId: number,
    success: boolean,
    body: Uint8Array,
    errorCode: number,
    errorMessage: string
  ): void;
  completeWait(handlerId: number): void;
}

export interface ModuleInstance {
  WebE2EE: new () => WebE2EEInstance;
}

export type ModuleFactory = (moduleOverrides?: {
  locateFile?: (path: string) => string;
}) => Promise<ModuleInstance>;
