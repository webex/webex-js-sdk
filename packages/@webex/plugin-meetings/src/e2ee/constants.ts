/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

/** LLM/Mercury events carrying MLS protocol messages, forwarded to the MLS engine. */
export const MEDIA_ENCRYPTION_MERCURY_EVENTS = [
  'event:media_encryption.leader_nominated',
  'event:media_encryption.welcome',
  'event:media_encryption.annotated_welcome',
  'event:media_encryption.multi_welcome',
  'event:media_encryption.group_update',
  'event:media_encryption.annotated_commit',
  'event:media_encryption.large_group_update',
  'event:media_encryption.use_key',
  'event:media_encryption.join_request',
  'event:media_encryption.leave_request',
  'event:media_encryption.join_failure',
  'event:media_encryption.leader_changed',
  'event:media_encryption.message_segment',
];

/** Webex service names resolved from the service catalog. */
export const MEDIA_ENCRYPTION_SERVICE = 'media-encryption';

/** MLS roster device type identifying a backend media service. */
export const MEDIA_SERVICE_DEVICE_TYPE = 'MEDIA_SERVICE';

/** MLS group join timeout in milliseconds. Copied from UCF's E2EE default. */
export const DEFAULT_JOIN_TIMEOUT = 180_000;

/** MLS commit coalescing window in milliseconds. Copied from UCF's E2EE default. */
export const DEFAULT_COALESCE_WINDOW = 500;

/* The WASM module that contains the libe2ee + mlspp libraries with a WebE2EE wrapper around them, required for joining MLS group for E2EE meetings.
 * The version is in the filename as it is important that JS-SDK implementation of MLS class matches the WASM module version.
 */
export const E2EE_WASM_ASSET = 'e2ee-0.0.1.wasm';

/** Locus join-request device capability advertising support for large (1K) E2EE meetings. */
export const E2EE_1K_SUPPORTED = 'E2EE_1K_SUPPORTED';
