import type {
  ClientEvent,
  ClientEventPayload,
  PrivacyAndSecurityPermissionResource,
} from '../metrics.types';

export type PermissionEnrichmentPolicy = {
  resources: readonly PrivacyAndSecurityPermissionResource[];
  terminal: boolean;
};

export type PermissionEnrichmentRule = {
  events: ReadonlySet<ClientEvent['name']>;
  resolve: (payload?: ClientEventPayload) => PermissionEnrichmentPolicy;
};

export type PermissionEnrichmentContext = {
  name: ClientEvent['name'];
  payload?: ClientEventPayload;
  scope: string;
};
