/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

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
];

/** LLM lifecycle event fired when the signaling channel connects. */
export const LLM_ONLINE_EVENT = 'online';

/** Webex service names resolved from the service catalog. */
export const MEDIA_ENCRYPTION_SERVICE = 'media-encryption';
export const CERTIFICATE_AUTHORITY_SERVICE = 'webex-certificate-authority';

/** MLS roster device type identifying a media service (breaks zero-trust). */
export const MEDIA_SERVICE_DEVICE_TYPE = 'MEDIA_SERVICE';

/**
 * Webex Microservices production root CA, used as an MLS trust anchor for verifying member
 * certificates.
 */
export const WEBEX_CA_PRODUCTION_ROOTS =
  '-----BEGIN CERTIFICATE-----\n' +
  'MIICBjCCAYygAwIBAgIJAZOu2g1dR9NhMAoGCCqGSM49BAMDMEcxDzANBgNVBAsT\n' +
  'BkNhZWx1bTEOMAwGA1UEChMFQ2lzY28xJDAiBgNVBAMTG1dlYmV4IE1pY3Jvc2Vy\n' +
  'dmljZXMgUm9vdCBDQTAgFw0yMTA0MDgxNzQ5NTlaGA8yMDUxMDQwODE3NDk1OVow\n' +
  'RzEPMA0GA1UECxMGQ2FlbHVtMQ4wDAYDVQQKEwVDaXNjbzEkMCIGA1UEAxMbV2Vi\n' +
  'ZXggTWljcm9zZXJ2aWNlcyBSb290IENBMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE\n' +
  'dS1B5KM1hoIPodrKjjIdDCUMF9N3HCxwkVshIj+E2m1Qcws3TBygEd3L5hwVtLxO\n' +
  'r3FezXFEGSQy9dR9WhWbCTyAp5UIHFkwNAqPe8hQCEOwsmhC8O8q82Eso02vMAPR\n' +
  'o0IwQDAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQU\n' +
  'wAfEJpw+1x4HTK+0MN0Or6aO0hwwCgYIKoZIzj0EAwMDaAAwZQIwBIXZXTASZl4s\n' +
  'tLchC6wdmhUiVxMedK6VT3rimaQl2gOomZBv2UUDoX/Kfo+cwfl6AjEA8sKyFlqX\n' +
  'eykGJ9XgUKTXeNXXmT+3wHxS2g/T3qIGblPAXaNP7MwIfySJfqolV+IC\n' +
  '-----END CERTIFICATE-----';
