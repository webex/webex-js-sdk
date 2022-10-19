/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import {flatten} from 'lodash';
import {WebexPlugin} from '@webex/webex-core';

const Flag = WebexPlugin.extend({
  namespace: 'Flag',

  /**
  * Archive a flag
  * @param {Object} flag
  * @param {Object} options
  * @returns {Promise<Object>} Resolves with the flag archival
  */
  archive(flag, options) {
    if (!flag.url) {
      return Promise.reject(new Error('`flag.url` is required'));
    }
    options = options || {};
    const params = {
      method: 'PUT',
      uri: flag.url,
      options,
      body: {
        state: 'archived'
      }
    };

    return this.webex.request(params)
      .then((res) => res.body);
  },

  /**
  * Flags an activity
  * @param {Object} activity
  * @param {Object} options
  * @returns {Promise<Object>} Resolves with the flag creation
  */
  create(activity, options) {
    if (!activity.url) {
      return Promise.reject(new Error('`activity.url` is required'));
    }
    options = options || {};
    const params = {
      method: 'POST',
      service: 'userApps',
      resource: '/flags',
      options,
      body: {
        'conversation-url': activity.target.url,
        'flag-item': activity.url,
        state: 'flagged'
      }
    };

    return this.webex.request(params)
      .then((res) => res.body);
  },

  /**
  * Gets a list of Flags for a user
  * @param {Object} options
  * @returns {Promise} Resolves with the fetched flags
  */
  list(options) {
    options = options || {};
    const params = {
      method: 'GET',
      service: 'userApps',
      resource: '/flags',
      options,
      qs: {
        state: 'flagged'
      }
    };

    return this.webex.request(params)
      .then((res) => res.body.items);
  },

  /**
  * Gets an array of activities where the status is 200
  * @param {Object} flags
  * @returns {Promise<Object>} Resolves with the activities
  * TODO: this should be implemented as a batched request when migrating to the modular sdk
  */
  async mapToActivities(flags) {
    const mapUrlActivities = new Map();

    for (const flag of flags) {
      const convoUrlRegex = /(.*)\/activities\//;
      const activity = flag['flag-item'];
      const match = convoUrlRegex.exec(activity);

      if (match) {
        const url = match[1];
        let activities = mapUrlActivities.get(url);

        if (!activities) {
          activities = [];
          mapUrlActivities.set(url, activities);
        }
        activities.push(activity);
      }
      else {
        this.logger.warn(
          `The activity URL has a strange format (${activity}). Ignoring it.`
        );
      }
    }

    const responses = await Promise.all(
      Array.from(mapUrlActivities, async ([convoUrl, activityUrls]) => {
        const params = {
          method: 'POST',
          url: `${convoUrl}/bulk_activities_fetch`,
          body: {
            activityUrls
          }
        };

        const res = await this.webex.request(params);

        return res.body.multistatus.reduce((activitiesArr, statusData) => {
          if (statusData.status === '200') {
            activitiesArr.push(statusData.data.activity);
          }

          return activitiesArr;
        }, []);
      })
    );

    return flatten(responses);
  },

  /**
  * Delete a flag
  * @param {Object} flag
  * @param {Object} options
  * @returns {Promise<Object>} Resolves with the flag deletion
  */
  delete(flag, options) {
    if (!flag.url) {
      return Promise.reject(new Error('`flag.url` is required'));
    }
    options = options || {};
    const params = {
      method: 'DELETE',
      options,
      uri: flag.url
    };

    return this.request(params)
      .then((res) => res.body);
  },

  /**
  * UnFlags an activity
  * @param {Object} flag
  * @param {Object} options
  * @returns {Promise<Object>} Resolves with the flag removal
  */
  unflag(flag, options) {
    if (!flag.url) {
      return Promise.reject(new Error('`flag.url` is required'));
    }
    options = options || {};
    const params = {
      method: 'PUT',
      uri: flag.url,
      options,
      body: {
        state: 'unflagged'
      }
    };

    return this.webex.request(params)
      .then((res) => res.body);
  }

});

export default Flag;
