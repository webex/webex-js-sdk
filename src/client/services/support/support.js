/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint-env browser */

var SparkBase = require('../../../lib/spark-base');
var defaults = require('lodash.defaults');
var uuid = require('uuid');

/**
 * @class
 * @extends {SparkBase}
 * @memberof Support
 */
var SupportService = SparkBase.extend(
  /** @lends Support.SupportService.prototype */
  {
  namespace: 'Support',

  /**
   * Submits a call log to atlas
   * @param {Support~CallMetadata} metadata
   * @param {string} logs
   * @returns {Promise} Resolves when network calls have completed
   */
  submitCallLogs: function submitCallLogs(metadata, logs) {
    var filename;
    var metadataArray = this._constructFileMetadata(metadata);
    logs = logs || this.logger._buffer.join('\n');
    if (metadata.locusId && metadata.callStart) {
      filename = metadata.locusId + '_' + metadata.callStart + '.txt';
    }
    else {
      filename = this.spark.trackingId + '.txt';
    }
    return this.upload({
      file: logs,
      api: 'atlas',
      resource: 'logs/url',
      phases: {
        initialize: {
          // Must send empty object
          body: {
            file: filename
          }
        },
        upload: {
          $uri: function $uri(session) {
            return session.tempURL;
          }
        },
        finalize: {
          api: 'atlas',
          resource: 'logs/meta',
          $body: function $body(session) {
            return {
              filename: session.logFilename,
              data: metadataArray
            };
          }
        }
      }
    });
  },

  /**
   * Submits a call log to atlas
   * @param {Support~CallMetadata} metadata
   * @param {string} logs
   * @returns {Promise} Resolves when network calls have completed
   */
  submitCallLogsForUnAuthUser: function submitCallLogsForUnAuthUser(metadata, logs) {
    var filename;
    var metadataArray = this._constructFileMetadata(metadata);
    logs = logs || this.logger._buffer.join('\n');
    // formatted as 2016-04-07T22:51:14.569Z DEBUG 'client: initiating upload session' Logs from UnAuthenticated user
    logs = logs || new Date().toISOString() + ' DEBUG \'client: initiating upload session: Logs from UnAuthenticated user\'';

    if (metadata.locusId && metadata.callStart) {
      filename = metadata.locusId + '_' + metadata.callStart + '.txt';
    }
    else {
      filename = this.spark.trackingId + '.txt';
    }
    return this.spark.credentials.getClientAuthorization()
      .then(function getAuthorization(auth) {
        var userId;
        return this.upload({
          file: logs,
          api: 'atlas',
          resource: 'logs/url',
          // Do not attempt reauthurization as the user is not logged in anyways.
          shouldAttemptReauth: false,
          headers: {
            // pass the default Auth bearer since the user is not logged in.
            Authorization: auth
          },
          phases: {
            initialize: {
              body: {
                file: filename
              }
            },
            upload: {
              $uri: function $uri(session) {
                return session.tempURL;
              }
            },
            finalize: {
              api: 'atlas',
              resource: 'logs/meta',
              headers: {
                // pass the default Auth bearer since the user is not logged in.
                Authorization: auth
              },
              $body: function $body(session) {
                userId = session.userId;
                return {
                  filename: session.logFilename,
                  data: metadataArray,
                  userId: session.userId
                };
              }
            }
          }
        })
        .then(function updateUserIdInfo(body) {
          // userId received from Atlas in the above phase needs to be returned back to the callee
          body.userId = userId;
          return body;
        });
      }.bind(this));
  },

  /**
   * Retrieves a signed desk.com feedback form URL
   * @param {Object} options
   * @param {string} options.feedbackId
   * @param {string} options.locusId
   * @returns {Promise} Resolves with the url
   */
  getFeedbackUrl: function getFeedbackUrl(options) {
    options = options || {};
    return this.request({
      method: 'POST',
      api: 'conversation',
      resource: 'users/deskFeedbackUrl',
      body: defaults(options, {
        appVersion: this.config.appVersion,
        appType: this.config.appType,
        feedbackId: options.feedbackId || uuid.v4(),
        languageCode: this.config.languageCode
      })
    })
      .then(function processResponse(res) {
        return res.body.url;
      });
  },

  /**
   * Retrieves a signed desk.com support/help page URL
   * @returns {Promise} Resolves with the url
   */
  getSupportUrl: function getSupportUrl() {
    return this.request({
      method: 'GET',
      api: 'conversation',
      resource: 'users/deskSupportUrl',
      qs: {
        languageCode: this.config.languageCode
      }
    })
      .then(function processResponse(res) {
        return res.body.url;
      });
  },

  /**
   * constructs metadata of a log
   * @param {Object} metadata
   * @param {string} metadata.feedbackId
   * @param {string} metadata.locusId
   * @param {string} metadata.callStart
   * @private
   * @returns {Promise} returns metadata array
   */
  _constructFileMetadata: function _constructMetada(metadata) {
    var metadataArray = [];
    var trackingId = this.spark.client.trackingIdBase;

    if (this.spark.config.trackingIdPrefix) {
      trackingId = this.spark.config.trackingIdPrefix + '_' + this.spark.client.trackingIdBase;
    }

    ['locusId', 'callStart', 'feedbackId'].forEach(function addKeyToArray(key) {
      if (metadata[key]) {
        metadataArray.push({
          key: key,
          value: metadata[key]
        });
      }
    });

    metadataArray.push({
      key: 'trackingId',
      value: trackingId
    });

    return metadataArray;
  }
});

module.exports = SupportService;
