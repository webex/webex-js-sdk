/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {SDK_EVENT} from './constants';

/**
 * Creates a 'webhook' envelope to wrap Webex events in
 * @param {object} webex - sdk object
 * @param {string} resource - resource to create an envelope for
 * @returns {object} - Returns a promise of an event envelope object
 */
export function createEventEnvelope(webex, resource) {
  return ensureMyIdIsAvailable(webex)
    .then(() =>
      Promise.resolve({
        createdBy: webex.internal.me.id,
        orgId: webex.internal.me.orgId,
        resource,
        // id -- webhook id concept does not correlate to SDK socket event
        // name -- webhook name concept does not correlate to SDK socket event
        // targetUrl -- targetUrl concept does not correlate to SDK socket event
        // secret -- secret concept does not correlate to SDK socket event
        ownedBy: SDK_EVENT.EXTERNAL.OWNER.CREATOR,
        status: SDK_EVENT.EXTERNAL.STATUS.ACTIVE,
        created: new Date().toISOString(),
        data: {},
      })
    )
    .catch((e) => {
      Promise.reject(
        new Error(`Unable to get person info for ${resource} \
event envelope: ${e.message}`)
      );
    });
}

/**
 * Stores SDK users info in the sdk object if it doesn't already exist
 * @param {object} webex - sdk object
 * @returns {Promise} - Returns a promise that user info will be available
 */
export async function ensureMyIdIsAvailable(webex) {
  // If we don't have it, save info about our user
  if ('me' in webex.internal) {
    return Promise.resolve();
  }

  return webex.people.get('me').then((person) => {
    webex.internal.me = person;

    return Promise.resolve();
  });
}
