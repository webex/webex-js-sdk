import {HTTP_METHODS} from '../../common/types';
import log from '../../Logger';
import {METHODS, MOBIUS_SOCKET_MAPPER_FILE} from '../constants';
import {MOBIUS_SOCKET_MESSAGE_TYPE} from './constants';

/**
 * Derives the Mobius Socket message type from the URI and HTTP method.
 * Uses both the URI path pattern and the HTTP method to disambiguate operations
 * that share the same endpoint (e.g., PATCH vs DELETE on calls/{callId}).
 *
 * @param uri - The request URI
 * @param httpMethodType - The HTTP method used for the request
 * @returns The socket message type based on the URI pattern and HTTP method
 *
 * @example
 * deriveMobiusSocketMessageType('/api/v1/calling/web/device', HTTP_METHODS.POST)
 * // returns 'register'
 *
 * deriveMobiusSocketMessageType('/api/v1/calling/web/devices/abc123/calls/xyz789', HTTP_METHODS.PATCH)
 * // returns 'call_state'
 *
 * deriveMobiusSocketMessageType('/api/v1/calling/web/devices/abc123/calls/xyz789', HTTP_METHODS.DELETE)
 * // returns 'call_delete'
 */
// eslint-disable-next-line import/prefer-default-export
export function deriveMobiusSocketMessageType(
  uri?: string,
  httpMethodType?: HTTP_METHODS
): MOBIUS_SOCKET_MESSAGE_TYPE {
  const logContext = {
    file: MOBIUS_SOCKET_MAPPER_FILE,
    method: METHODS.DERIVE_MOBIUS_SOCKET_MESSAGE_TYPE,
  };

  if (!uri) {
    log.warn('Cannot derive Mobius socket message type: uri is empty', logContext);

    return MOBIUS_SOCKET_MESSAGE_TYPE.UNKNOWN;
  }

  // --- Supplementary services: .../services/{service}/{action} ---
  if (uri.includes('/services')) {
    if (uri.includes('/callhold/hold')) {
      return MOBIUS_SOCKET_MESSAGE_TYPE.CALL_HOLD;
    }
    if (uri.includes('/callhold/resume')) {
      return MOBIUS_SOCKET_MESSAGE_TYPE.CALL_RESUME;
    }
    if (uri.includes('/calltransfer/commit')) {
      return MOBIUS_SOCKET_MESSAGE_TYPE.CALL_TRANSFER;
    }

    log.warn(
      `Unrecognized supplementary service uri - uri: ${uri}, httpMethod: ${httpMethodType}`,
      logContext
    );

    return MOBIUS_SOCKET_MESSAGE_TYPE.UNKNOWN;
  }

  // --- Call sub-resource actions (checked before bare calls/{callId}) ---

  // Call media: .../calls/{callId}/media
  if (uri.includes('/calls/') && uri.includes('/media')) {
    return MOBIUS_SOCKET_MESSAGE_TYPE.CALL_MEDIA;
  }

  // Call status: .../calls/{callId}/status
  if (uri.includes('/calls/') && uri.includes('/status')) {
    return MOBIUS_SOCKET_MESSAGE_TYPE.CALL_STATUS;
  }

  // Call state or delete: .../calls/{callId}  (PATCH → state, DELETE → delete)
  if (uri.match(/\/calls\/[^/]+$/)) {
    if (httpMethodType === HTTP_METHODS.PATCH) {
      return MOBIUS_SOCKET_MESSAGE_TYPE.CALL_STATE;
    }
    if (httpMethodType === HTTP_METHODS.DELETE) {
      return MOBIUS_SOCKET_MESSAGE_TYPE.CALL_DELETE;
    }

    log.warn(
      `Unrecognized httpMethod for calls/{callId} - uri: ${uri}, httpMethod: ${httpMethodType}`,
      logContext
    );

    return MOBIUS_SOCKET_MESSAGE_TYPE.UNKNOWN;
  }

  // Call setup: .../devices/{deviceId}/call  (singular)
  if (uri.endsWith('/call')) {
    return MOBIUS_SOCKET_MESSAGE_TYPE.CALL_SETUP;
  }

  // --- Device-level operations ---

  // Device keepalive: .../devices/{deviceId}/status  (no /calls/ in path)
  if (!uri.includes('/calls/') && uri.endsWith('/status')) {
    return MOBIUS_SOCKET_MESSAGE_TYPE.DEVICE_STATUS;
  }

  // Device registration: .../calling/web/device  (singular)
  if (uri.endsWith('/device')) {
    return MOBIUS_SOCKET_MESSAGE_TYPE.REGISTER;
  }

  // Device unregister or get: .../devices/{deviceId}  (DELETE → unregister, GET → device_get)
  if (uri.match(/\/devices\/[^/?]+$/) && !uri.includes('/calls')) {
    if (httpMethodType === HTTP_METHODS.DELETE) {
      return MOBIUS_SOCKET_MESSAGE_TYPE.UNREGISTER;
    }
    if (httpMethodType === HTTP_METHODS.GET) {
      return MOBIUS_SOCKET_MESSAGE_TYPE.DEVICE_GET;
    }

    log.warn(
      `Unrecognized httpMethod for devices/{deviceId} - uri: ${uri}, httpMethod: ${httpMethodType}`,
      logContext
    );

    return MOBIUS_SOCKET_MESSAGE_TYPE.UNKNOWN;
  }

  // Device list: .../devices  or  .../devices?userid=...
  if (uri.includes('/devices') && !uri.match(/\/devices\/[^/?]+/)) {
    return MOBIUS_SOCKET_MESSAGE_TYPE.DEVICE_LIST;
  }

  log.warn(
    `Unrecognized uri pattern for Mobius socket - uri: ${uri}, httpMethod: ${httpMethodType}`,
    logContext
  );

  return MOBIUS_SOCKET_MESSAGE_TYPE.UNKNOWN;
}

export const isSupplementaryServiceMessageType = (type: MOBIUS_SOCKET_MESSAGE_TYPE): boolean =>
  [
    MOBIUS_SOCKET_MESSAGE_TYPE.CALL_HOLD,
    MOBIUS_SOCKET_MESSAGE_TYPE.CALL_RESUME,
    MOBIUS_SOCKET_MESSAGE_TYPE.CALL_TRANSFER,
  ].includes(type);
