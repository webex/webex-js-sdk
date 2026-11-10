/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import uuid from 'uuid';

/**
 * Generates a unique test email for user-activation/validation specs.
 *
 * The local part is kept short on purpose: for a brand-new self-signup user the
 * backend derives the "given name" from the email local part, and self-signup
 * orgs cap the given name at 50 characters. A full UUID would push the local
 * part to 59 chars and fail with errorCode 100018, so we use 20 hex characters
 * of entropy (local part = 43 chars).
 *
 * @returns {string} e.g. `Collabctg+webex-js-sdk-1a2b3c4d5e6f7a8b9c0d@gmail.com`
 */
export function createActivationEmail(): string {
  return `Collabctg+webex-js-sdk-${uuid.v4().replace(/-/g, '').slice(0, 20)}@gmail.com`;
}

export default createActivationEmail;
