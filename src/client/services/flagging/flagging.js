/**!
*
* Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
*/

'use strict';

var Decrypter = require('../conversation/decrypter');
var map = require('lodash.map');
var Normalizer = require('../conversation/normalizer');
var resolveWith = require('../../../util/resolve-with');
var SparkBase = require('../../../lib/spark-base');
/**
* @class
* @extends {SparkBase}
* @memberof {Team}
*/
var FlaggingService = SparkBase.extend(
  {
    children: {
      decrypter: Decrypter,
      normalizer: Normalizer
    },

    namespace: 'Flagging',

    /**
    * Gets a list of Flags for a user
    * @returns {Promise} Resolves with the fetched flags
    */
    list: function list(options) {

      options = options || {};
      var params = {
        method: 'GET',
        api: 'userApps',
        resource: '/flags',
        options: options,
        qs: {
          // do we need to include unflagged here
          state: 'flagged'
        }
      };

      return this.request(params)
        .then(function processResponse(res) {
          return res.body.items;
        });
    },

    /**
    * Gets an array of activities where the status is 200
    * @param {Object} flags
    * @returns {Promise<Object>} Resolves with the activities
    * TODO: this should be implemented as a batched request when migrating to the modular sdk
    */
    mapToActivities: function mapToActivities(flags, options) {
      var activityUrls = map(flags, 'flag-item');

      var params = {
        method: 'POST',
        api: 'conversation',
        resource: 'bulk_activities_fetch',
        body: {
          activityUrls: activityUrls
        }
      };

      return this.request(params)
        .then(function processResponse(res) {
          var activitiesArr = [];
          res.body.multistatus.forEach(function getSyncActivities(statusData) {
            if (statusData.status === '200') {
              activitiesArr.push(statusData.data.activity);
            }
          });
          return Promise.all(activitiesArr.map(function processActivity(activity) {
            return this.decrypter.decryptObject(activity, options)
              .then(this.normalizer.normalize.bind(this.normalizer));
          }.bind(this)))
            .then(resolveWith(activitiesArr));
        }.bind(this));
    },

    /**
    * Flags an activity
    * @param {Object} activity
    * @returns {Promise<Object>} Resolves with the flag creation
    */
    flag: function flag(activity, options) {
      if (!activity.url) {
        return Promise.reject(new Error('`activity.url` is required'));
      }
      options = options || {};
      var params = {
        method: 'POST',
        api: 'userApps',
        resource: '/flags',
        options: options,
        body: {
          'flag-item': activity.url,
          state: 'flagged'
        }
      };

      return this.request(params)
        .then(function processResponse(res) {
          return res.body;
        });

    },

    /**
    * UnFlags an activity
    * @param {Object} flag
    * @returns {Promise<Object>} Resolves with the flag removal
    */
    unflag: function unflag(flag, options) {
      if (!flag.id) {
        return Promise.reject(new Error('`flag.id` is required'));
      }
      options = options || {};
      var params = {
        method: 'PUT',
        uri: flag.url,
        options: options,
        body: {
          state: 'unflagged'
        }
      };

      return this.request(params)
        .then(function processResponse(res) {
          return res.body;
        });
    },

    /**
    * Archive a flag
    * @param {Object} flag
    * @returns {Promise<Object>} Resolves with the flag archival
    */
    archive: function archive(flag, options) {
      if (!flag.id) {
        return Promise.reject(new Error('`flag.id` is required'));
      }
      options = options || {};
      var params = {
        method: 'PUT',
        uri: flag.url,
        options: options,
        body: {
          state: 'archived'
        }
      };

      return this.request(params)
        .then(function processResponse(res) {
          return res.body;
        });
    },

    /**
    * Delete a flag
    * @param {Object} flag
    * @returns {Promise<Object>} Resolves with the flag deletion
    */
    remove: function remove(flag, options) {
      if (!flag.id) {
        return Promise.reject(new Error('`flag.id` is required'));
      }
      options = options || {};
      var params = {
        method: 'DELETE',
        options: options,
        uri: flag.url
      };

      return this.request(params)
        .then(function processResponse(res) {
          return res.body;
        });
    }
  });

module.exports = FlaggingService;
