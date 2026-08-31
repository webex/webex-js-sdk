import type {ClientEvent} from '../metrics.types';
import type {PermissionEnrichmentPolicy} from './types';

export const CAMERA_AND_MICROPHONE_PERMISSION_EVENTS = new Set<ClientEvent['name']>([
  'client.call.initiated',
  'client.media.capabilities',
  'client.ice.end',
  'client.locus.join.request',
  'client.locus.join.response',
  'client.media-engine.ready',
]);

export const MEDIA_TX_PERMISSION_EVENTS = new Set<ClientEvent['name']>([
  'client.media.tx.start',
  'client.media.tx.stop',
]);

export const CONTENT_SHARE_PERMISSION_EVENTS = new Set<ClientEvent['name']>([
  'client.share.initiated',
  'client.share.floor-grant.request',
  'client.share.floor-granted.local',
]);

export const FINAL_PERMISSION_EVENTS = new Set<ClientEvent['name']>([
  'client.call.leave',
  'client.call.remote-ended',
  'client.call.aborted',
]);

export const NO_PERMISSION_ENRICHMENT: PermissionEnrichmentPolicy = {
  resources: [],
  terminal: false,
};
