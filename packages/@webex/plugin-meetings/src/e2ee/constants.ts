/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {CapabilityState, WebCapabilities} from '@webex/web-capabilities';

/**
 * E2EE can only be enabled when requested and WebAssembly is available in this browser.
 * @param {boolean} configured - Whether the SDK's E2EE config is enabled.
 * @returns {boolean} whether E2EE can run in this browser.
 */
export const isE2eeEnabledAndSupported = (configured: boolean): boolean =>
  configured && WebCapabilities.supportsWasm() === CapabilityState.CAPABLE;

/** LLM mercury events carrying MLS protocol messages, forwarded to the engine. */
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

/** LLM lifecycle event fired when the signaling channel connects. */
export const LLM_ONLINE_EVENT = 'online';

/** Webex service names resolved from the service catalog. */
export const MEDIA_ENCRYPTION_SERVICE = 'media-encryption';

/** MLS roster device type identifying a media service (breaks zero-trust). */
export const MEDIA_SERVICE_DEVICE_TYPE = 'MEDIA_SERVICE';

/** URL of the e2ee WASM binary, served by the host app (the `.js` loader URL is derived from it). */
export const E2EE_WASM_URL = '/wasm/e2ee.wasm';

/** Locus join-request device capability advertising support for large (1K) E2EE meetings. */
export const E2EE_1K_SUPPORTED = 'E2EE_1K_SUPPORTED';
