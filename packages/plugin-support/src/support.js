/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';
import {defaults} from 'lodash';
import uuid from 'uuid';


const Support = SparkPlugin.extend({
  namespace: `Support`,

  _constructFileMetadata(metadata) {
    let metadataArray = [];
    let client = this.spark.client || {};
    let trackingId = client.trackingIdBase;

    if (this.spark.config.trackingIdPrefix) {
      trackingId = `${this.spark.config.trackingIdPrefix}_${client.trackingIdBase}`;
    }

    [`locusId`, `callStart`, `feedbackId`].forEach(function addKeyToArray(key) {
      if (metadata[key]) {
        metadataArray.push({
          key: key,
          value: metadata[key]
        });
      }
    });

    metadataArray.push({
      key: `trackingId`,
      value: trackingId
    });

    return metadataArray;
  },

  getFeedbackUrl(options) {
    options = options || {};
    return this.request({
      method: `POST`,
      api: `conversation`,
      resource: `users/deskFeedbackUrl`,
      body: defaults(options, {
        appVersion: this.config.appVersion,
        appType: this.config.appType,
        feedbackId: options.feedbackId || uuid.v4(),
        languageCode: this.config.languageCode
      })
    })
      .then((res) => res.body.url);
  },

  getSupportUrl() {
    return this.spark.request({
      method: `GET`,
      api: `conversation`,
      resource: `users/deskSupportUrl`,
      qs: {
        languageCode: this.config.languageCode
      }
    })
      .then((res) => res.body.url);
  },

  submitCallLogs(metadata, logs) {
    let filename;
    let metadataArray = this._constructFileMetadata(metadata);
    logs = logs || this.logger._buffer.join(`\n`);
    if (metadata.locusId && metadata.callStart) {
      filename = `${metadata.locusId}_${metadata.callStart}.txt`;
    }
    else {
      filename = `${this.spark.trackingId}.txt`;
    }
    return this.upload({
      file: logs,
      api: `atlas`,
      resource: `logs/url`,
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
          api: `atlas`,
          resource: `logs/meta`,
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

  submitCallLogsForUnAuthUser(metadata, logs) {
    let filename;
    let metadataArray = this._constructFileMetadata(metadata);
    logs = logs || this.logger._buffer.join(`\n`);
    // formatted as 2016-04-07T22:51:14.569Z DEBUG 'client: initiating upload session' Logs from UnAuthenticated user
    logs = logs || `${new Date().toISOString()}DEBUG \`client: initiating upload session: Logs from UnAuthenticated user\``;

    if (metadata.locusId && metadata.callStart) {
      filename = `${metadata.locusId}_${metadata.callStart}.txt`;
    }
    else {
      filename = `${this.spark.trackingId}.txt`;
    }
    return this.spark.credentials.getClientCredentialsAuthorization()
      .then((auth) => {
        let userId;
        return this.upload({
          file: logs,
          api: `atlas`,
          resource: `logs/url`,
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
              api: `atlas`,
              resource: `logs/meta`,
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
        .then((body) => {
          // userId received from Atlas in the above phase needs to be returned back to the callee
          body.userId = userId;
          return body;
        });
      });
  }

});

export default Support;
