/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {get} from 'lodash';
import {oneFlight} from '@webex/common';
import {WebexPlugin} from '@webex/webex-core';

const Search = WebexPlugin.extend({
  namespace: 'Search',

  people(options) {
    options = options || {};

    if (!options.queryString && options.query) {
      options.queryString = options.query;
      Reflect.deleteProperty(options, 'query');
    }

    if (!options.queryString) {
      return Promise.reject(new Error('`options.query` is required'));
    }

    return this.request({
      api: 'argonaut',
      resource: 'directory',
      method: 'POST',
      body: options,
    }).then((res) => res.body);
  },

  @oneFlight
  bindSearchKey() {
    return this.webex.internal.encryption.kms.createUnboundKeys({count: 1}).then(([key]) =>
      this.webex.internal.encryption.kms
        .createResource({
          key,
          userIds: [this.webex.internal.device.userId],
        })
        .then(() => this.webex.internal.device.set('searchEncryptionKeyUrl', key.uri))
    );
  },

  /**
   * Fetches search result activities
   * @param {Object} options
   * @param {boolean} options.includeRemoteClusterReferences when true,
   * includes search results from remote clusters
   * @returns {Promise<Array>} Resolves with the activities
   */
  search(options) {
    /* eslint max-nested-callbacks: [0] */
    options = options || {};

    let promise = Promise.resolve();

    if (!this.webex.internal.device.searchEncryptionKeyUrl) {
      promise = this.bindSearchKey();
    }

    return promise
      .then(() =>
        this.webex.request({
          service: 'argonaut',
          resource: 'search',
          method: 'POST',
          body: Object.assign(options, {
            searchEncryptionKeyUrl: this.webex.internal.device.searchEncryptionKeyUrl,
          }),
        })
      )
      .then((res) => {
        const resActivities = get(res, 'body.activities.items', []);

        if (options.includeRemoteClusterReferences && res.body.breadcrumbs) {
          const {breadcrumbs} = res.body;
          const promises = [];

          Object.keys(breadcrumbs).forEach((cluster) => {
            // Map activity URLs to their cluster
            const editedCluster = `${cluster}:identityLookup`;
            const clusterActivityUrls = breadcrumbs[cluster].items.map(
              (activity) => activity.activityUrl
            );

            // Find activities per cluster
            const bulkActivitiesPromise = this.webex.internal.conversation
              .bulkActivitiesFetch(clusterActivityUrls, {cluster: editedCluster})
              .catch((err) => {
                this.logger.warn('search: error fetching from remote clusters', err);

                return Promise.resolve([]);
              });

            promises.push(bulkActivitiesPromise);
          });

          return Promise.all(promises).then((clusterResults) =>
            clusterResults.reduce(
              (accumulator, clusterResult) => accumulator.concat(clusterResult),
              resActivities
            )
          );
        }

        return resActivities;
      });
  },
});

export default Search;
