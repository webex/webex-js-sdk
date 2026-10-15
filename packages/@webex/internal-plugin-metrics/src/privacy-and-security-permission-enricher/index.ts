import type {ClientEventPayload, PrivacyAndSecurityPermission} from '../metrics.types';
import {
  CAMERA_AND_MICROPHONE_PERMISSION_EVENTS,
  CONTENT_SHARE_PERMISSION_EVENTS,
  FINAL_PERMISSION_EVENTS,
  MEDIA_TX_PERMISSION_EVENTS,
  NO_PERMISSION_ENRICHMENT,
} from './constants';
import type {
  PermissionEnrichmentContext,
  PermissionEnrichmentPolicy,
  PermissionEnrichmentRule,
} from './types';
import {
  getChangedPermission,
  projectPrivacyAndSecurityPermission,
  resolveContentShareResources,
  resolveMediaResources,
} from './utils';

export const PERMISSION_ENRICHMENT_RULES = [
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
      resources: resolveContentShareResources(payload),
      terminal: false,
    }),
  },
  {
    events: FINAL_PERMISSION_EVENTS,
    resolve: () => ({resources: ['camera', 'microphone', 'contentShare'], terminal: true}),
  },
] satisfies readonly PermissionEnrichmentRule[];

const resolvePermissionEnrichmentPolicy = (
  name: PermissionEnrichmentContext['name'],
  payload?: ClientEventPayload
): PermissionEnrichmentPolicy =>
  PERMISSION_ENRICHMENT_RULES.find(({events}) => events.has(name))?.resolve(payload) ??
  NO_PERMISSION_ENRICHMENT;

/**
 * Enriches eligible client events with relevant browser permission changes.
 */
export default class PrivacyAndSecurityPermissionEnricher {
  private permission?: PrivacyAndSecurityPermission;

  private lastReported = new Map<string, PrivacyAndSecurityPermission>();

  private readonly onEnrichmentError: (error: unknown) => void;

  /**
   * Creates a permission enricher.
   * @param {Function} onEnrichmentError permission enrichment error handler
   */
  constructor(onEnrichmentError: (error: unknown) => void) {
    this.onEnrichmentError = onEnrichmentError;
  }

  /**
   * Stores the latest normalized browser permission state.
   * @param {PrivacyAndSecurityPermission} permission permission snapshot
   * @returns {void}
   */
  public setPermission(permission: PrivacyAndSecurityPermission): void {
    this.permission = projectPrivacyAndSecurityPermission(permission, [
      'camera',
      'microphone',
      'contentShare',
    ]);
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

      if (policy.resources.length === 0) {
        return payload;
      }

      const projectedPermission = this.permission
        ? projectPrivacyAndSecurityPermission(this.permission, policy.resources)
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
      this.onEnrichmentError(error);

      return payload;
    } finally {
      if (policy.terminal) {
        this.lastReported.delete(scope);
      }
    }
  }
}
