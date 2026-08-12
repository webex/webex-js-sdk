import {isEqual} from 'lodash';

import {
  ClientEvent,
  ClientEventPayload,
  PrivacyAndSecurityPermission,
  PrivacyAndSecurityPermissionProvider,
  PrivacyAndSecurityPermissionResource,
  PrivacyAndSecurityPermissionState,
} from './metrics.types';

type PermissionEnrichmentPolicy = {
  resources: readonly PrivacyAndSecurityPermissionResource[];
  terminal: boolean;
};

type PermissionEnrichmentRule = {
  events: ReadonlySet<ClientEvent['name']>;
  resolve: (payload?: ClientEventPayload) => PermissionEnrichmentPolicy;
};

type PermissionEnrichmentContext = {
  name: ClientEvent['name'];
  payload?: ClientEventPayload;
  scope: string;
};

const CAMERA_AND_MICROPHONE_PERMISSION_EVENTS = new Set<ClientEvent['name']>([
  'client.call.initiated',
  'client.media.capabilities',
  'client.ice.end',
  'client.locus.join.request',
  'client.locus.join.response',
  'client.media-engine.ready',
]);

const MEDIA_TX_PERMISSION_EVENTS = new Set<ClientEvent['name']>([
  'client.media.tx.start',
  'client.media.tx.stop',
]);

const CONTENT_SHARE_PERMISSION_EVENTS = new Set<ClientEvent['name']>([
  'client.share.initiated',
  'client.share.floor-grant.request',
  'client.share.floor-granted.local',
]);

const FINAL_PERMISSION_EVENTS = new Set<ClientEvent['name']>([
  'client.call.leave',
  'client.call.remote-ended',
  'client.call.aborted',
]);

const isSamePermissionState = (
  current?: PrivacyAndSecurityPermissionState,
  previous?: PrivacyAndSecurityPermissionState
): boolean => isEqual(current, previous);

const resolveMediaResources = (
  payload?: ClientEventPayload
): PrivacyAndSecurityPermissionResource[] => {
  switch (payload?.mediaType) {
    case 'audio':
      return ['microphone'];
    case 'video':
      return ['camera'];
    case 'share':
      return ['contentShare'];
    default:
      return [];
  }
};

const createNonOverlappingPermissionEnrichmentRules = (
  rules: readonly PermissionEnrichmentRule[]
): readonly PermissionEnrichmentRule[] => {
  const registeredEvents = new Set<ClientEvent['name']>();

  rules.forEach(({events}) => {
    events.forEach((event) => {
      if (registeredEvents.has(event)) {
        throw new Error(`Permission enrichment event is registered more than once: ${event}`);
      }

      registeredEvents.add(event);
    });
  });

  return rules;
};

const PERMISSION_ENRICHMENT_RULES = createNonOverlappingPermissionEnrichmentRules([
  {
    events: CAMERA_AND_MICROPHONE_PERMISSION_EVENTS,
    resolve: () => ({resources: ['camera', 'microphone'], terminal: false}),
  },
  {
    events: MEDIA_TX_PERMISSION_EVENTS,
    resolve: (payload) => ({resources: resolveMediaResources(payload), terminal: false}),
  },
  {
    events: CONTENT_SHARE_PERMISSION_EVENTS,
    resolve: (payload) => ({
      resources: payload?.mediaType === 'share' ? ['contentShare'] : [],
      terminal: false,
    }),
  },
  {
    events: FINAL_PERMISSION_EVENTS,
    resolve: () => ({resources: ['camera', 'microphone', 'contentShare'], terminal: true}),
  },
] satisfies readonly PermissionEnrichmentRule[]);

const NO_PERMISSION_ENRICHMENT: PermissionEnrichmentPolicy = {
  resources: [],
  terminal: false,
};

const resolvePermissionEnrichmentPolicy = (
  name: ClientEvent['name'],
  payload?: ClientEventPayload
): PermissionEnrichmentPolicy =>
  PERMISSION_ENRICHMENT_RULES.find(({events}) => events.has(name))?.resolve(payload) ??
  NO_PERMISSION_ENRICHMENT;

const projectPrivacyAndSecurityPermission = (
  permission: PrivacyAndSecurityPermission,
  resources: readonly PrivacyAndSecurityPermissionResource[]
): PrivacyAndSecurityPermission | undefined => {
  const projectedPermission: PrivacyAndSecurityPermission = {
    ...(resources.includes('camera') && permission.camera ? {camera: {...permission.camera}} : {}),
    ...(resources.includes('microphone') && permission.microphone
      ? {microphone: {...permission.microphone}}
      : {}),
    ...(resources.includes('contentShare') && permission.contentShare
      ? {contentShare: {...permission.contentShare}}
      : {}),
  };

  return Object.keys(projectedPermission).length > 0 ? projectedPermission : undefined;
};

const getChangedPermission = (
  current: PrivacyAndSecurityPermission,
  previous: PrivacyAndSecurityPermission
): PrivacyAndSecurityPermission | undefined => {
  const changedPermission: PrivacyAndSecurityPermission = {
    ...(current.camera && !isSamePermissionState(current.camera, previous.camera)
      ? {camera: {...current.camera}}
      : {}),
    ...(current.microphone && !isSamePermissionState(current.microphone, previous.microphone)
      ? {microphone: {...current.microphone}}
      : {}),
    ...(current.contentShare && !isSamePermissionState(current.contentShare, previous.contentShare)
      ? {contentShare: {...current.contentShare}}
      : {}),
  };

  return Object.keys(changedPermission).length > 0 ? changedPermission : undefined;
};

/**
 * Enriches eligible client events with relevant browser permission changes.
 */
export default class PrivacyAndSecurityPermissionEnricher {
  private provider?: PrivacyAndSecurityPermissionProvider;

  private lastReported = new Map<string, PrivacyAndSecurityPermission>();

  private readonly onProviderError: (error: unknown) => void;

  /**
   * Creates a permission enricher.
   * @param {Function} onProviderError permission provider error handler
   */
  constructor(onProviderError: (error: unknown) => void) {
    this.onProviderError = onProviderError;
  }

  /**
   * Registers the provider for the latest browser permission state.
   * @param {PrivacyAndSecurityPermissionProvider} provider permission snapshot provider, or undefined to clear it
   * @returns {void}
   */
  public setProvider(provider?: PrivacyAndSecurityPermissionProvider): void {
    this.provider = provider;
    this.lastReported.clear();
  }

  /**
   * Returns the original payload or a copy enriched with relevant permission changes.
   * @param {PermissionEnrichmentContext} context event context and permission history scope
   * @returns {ClientEventPayload | undefined}
   */
  public enrich({
    name,
    payload,
    scope,
  }: PermissionEnrichmentContext): ClientEventPayload | undefined {
    const policy = resolvePermissionEnrichmentPolicy(name, payload);

    try {
      if (payload?.privacyAndSecurityPermission !== undefined) {
        // An explicitly supplied permission payload is authoritative for this event.
        if (!policy.terminal) {
          this.lastReported.set(scope, {
            ...this.lastReported.get(scope),
            ...(payload.privacyAndSecurityPermission as PrivacyAndSecurityPermission),
          });
        }

        return payload;
      }

      if (!this.provider || policy.resources.length === 0) {
        return payload;
      }

      const permission = this.provider();
      const projectedPermission = permission
        ? projectPrivacyAndSecurityPermission(permission, policy.resources)
        : undefined;

      if (!projectedPermission) {
        return payload;
      }

      if (policy.terminal) {
        return {...payload, privacyAndSecurityPermission: projectedPermission};
      }

      const lastReported = this.lastReported.get(scope) ?? {};
      const changedPermission = getChangedPermission(projectedPermission, lastReported);

      if (!changedPermission) {
        return payload;
      }

      this.lastReported.set(scope, {...lastReported, ...changedPermission});

      return {...payload, privacyAndSecurityPermission: changedPermission};
    } catch (error) {
      this.onProviderError(error);

      return payload;
    } finally {
      if (policy.terminal) {
        this.lastReported.delete(scope);
      }
    }
  }
}
