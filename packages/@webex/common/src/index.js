/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

// Core utilities
export {default as base64} from './base64';
export {default as isBuffer} from './isBuffer';
export {default as cappedDebounce} from './capped-debounce';
export {default as checkRequired} from './check-required';
export {default as Defer} from './defer';
export {default as makeStateDataType} from './make-state-datatype';
export {default as make} from './template-container';
export {default as patterns} from './patterns';
export {default as resolveWith} from './resolve-with';
export {default as retry} from './retry';
export {default as tap} from './tap';
export {default as Exception} from './exception';
export {default as deprecated} from './deprecated';
export {default as inBrowser} from './in-browser';

// Event handling utilities
export {proxyEvents, transferEvents, WebexEventEmitter} from './events';
export {createEventEnvelope, ensureMyIdIsAvailable} from './event-envelope';

// State management
export {WebexCollection as Collection} from './collection';
export {WebexState} from './state';

// Legacy decorators (maintained for backward compatibility)
export {default as oneFlight} from './one-flight';
export {default as whileInFlight} from './while-in-flight';

// Constants and utilities
export {
  deviceType,
  hydraTypes,
  SDK_EVENT,
  INTERNAL_US_CLUSTER_NAME,
  INTERNAL_US_INTEGRATION_CLUSTER_NAME,
} from './constants';

export {default as BrowserDetection, getBrowserSerial} from './browser-detection';

// UUID utilities
export {
  buildHydraMembershipId,
  buildHydraMessageId,
  buildHydraOrgId,
  buildHydraPersonId,
  buildHydraRoomId,
  getHydraRoomType,
  getHydraClusterString,
  getHydraFiles,
  constructHydraId,
  deconstructHydraId,
} from './uuid-utils';
