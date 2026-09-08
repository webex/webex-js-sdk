import {isEqual} from 'lodash';

import type {
  ClientEventPayload,
  PrivacyAndSecurityPermission,
  PrivacyAndSecurityPermissionResource,
} from '../metrics.types';

export const resolveMediaResources = (
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

export const resolveContentShareResources = (
  payload?: ClientEventPayload
): PrivacyAndSecurityPermissionResource[] => {
  if (payload?.mediaType !== 'share') {
    return [];
  }

  return ['contentShare'];
};

const copyPermissionState = (
  source: PrivacyAndSecurityPermission,
  target: PrivacyAndSecurityPermission,
  resource: PrivacyAndSecurityPermissionResource
): void => {
  switch (resource) {
    case 'camera':
      if (source.camera) {
        target.camera = {...source.camera};
      }
      break;
    case 'microphone':
      if (source.microphone) {
        target.microphone = {...source.microphone};
      }
      break;
    case 'contentShare':
      if (source.contentShare) {
        target.contentShare = {...source.contentShare};
      }
      break;
    default:
      break;
  }
};

export const projectPrivacyAndSecurityPermission = (
  permission: PrivacyAndSecurityPermission,
  resources: readonly PrivacyAndSecurityPermissionResource[]
): PrivacyAndSecurityPermission | undefined => {
  const projectedPermission: PrivacyAndSecurityPermission = {};

  resources.forEach((resource) => {
    copyPermissionState(permission, projectedPermission, resource);
  });

  return Object.keys(projectedPermission).length > 0 ? projectedPermission : undefined;
};

export const getChangedPermission = (
  current: PrivacyAndSecurityPermission,
  previous: PrivacyAndSecurityPermission
): PrivacyAndSecurityPermission | undefined => {
  const changedResources = (Object.keys(current) as PrivacyAndSecurityPermissionResource[]).filter(
    (resource) => !isEqual(current[resource], previous[resource])
  );

  return projectPrivacyAndSecurityPermission(current, changedResources);
};
