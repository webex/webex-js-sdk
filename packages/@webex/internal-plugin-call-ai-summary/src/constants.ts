/*!
 * Copyright (c) 2015-2025 Cisco Systems, Inc. See LICENSE file.
 */

export const AI_SUMMARY_SERVICE = 'pragya';
export const AI_SUMMARY_CONTAINERS_RESOURCE = 'containers';

export const SUMMARY_STATUSES = {
  ACTIVE: 'Active',
} as const;

export const ERROR_MESSAGES = {
  INVALID_CONTAINER_ID: 'containerId is required and must be a non-empty string',
  INVALID_CONTAINER_INFO: 'containerInfo with valid summaryData and encryptionKeyUrl is required',
  CONTAINER_NOT_FOUND: 'Container not found',
  CONTENT_NOT_FOUND: 'Summary content not available or expired',
  ACCESS_DENIED: 'Access denied: User not authorized to view this summary',
  AUTHENTICATION_FAILED: 'Authentication failed: Invalid or expired token',
} as const;
