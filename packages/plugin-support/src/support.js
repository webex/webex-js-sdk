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
    let userId, filename, shouldAttemptReauth, headers = {};
    let metadataArray = this._constructFileMetadata(metadata);
    logs = logs || this.logger._buffer.join(`\n`);

    if (metadata.locusId && metadata.callStart) {
      filename = `${metadata.locusId}_${metadata.callStart}.txt`;
    }
    else {
      filename = `${this.spark.trackingId}.txt`;
    }

    const isUnAuthUser = !this.spark.isAuthenticated;
    if (isUnAuthUser) {
      logs = logs || `${new Date().toISOString()}DEBUG \`client: initiating upload session: Logs from UnAuthenticated user\``;
      shouldAttemptReauth = false;
      headers = {
        Authorization: this.spark.credentials.getClientCredentialsAuthorization()
      }
    }

    return this.upload({
      file: logs,
      api: `atlas`,
      resource: `logs/url`,
      shouldAttemptReauth,
      headers,
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
            if (isUnAuthUser) {
              userId = session.userId;
              return {
                filename: session.logFilename,
                data: metadataArray,
                userId: isUnAuthUser ? session.userId : ''
              };
            }

            return {
              filename: session.logFilename,
              data: metadataArray
            };
          }
        }
      }
    })
    .then((body) => {
      if (isUnAuthUser) {
        // userId received from Atlas in the above phase needs to be returned back to the callee
        body.userId = userId;
        return body;
      }
    });
  }
});

export default Support;
