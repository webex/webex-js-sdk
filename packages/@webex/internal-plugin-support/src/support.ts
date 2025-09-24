/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import WebexPlugin from '@webex/webex-core';
import {defaults} from 'lodash';
import {v4 as uuid} from 'uuid';

export interface SupportMetadata {
  locusId?: string;
  appVersion?: string;
  callStart?: string;
  feedbackId?: string;
  correlationId?: string;
  meetingId?: string;
  surveySessionId?: string;
  productAreaTag?: string;
  issueTypeTag?: string;
  issueDescTag?: string;
  locussessionid?: string;
  autoupload?: boolean;
}

export interface FileMetadataEntry {
  key: string;
  value: string;
}

export interface SubmitLogsOptions {
  type?: 'full' | 'diff';
}

export interface SupportConfig {
  appVersion?: string;
  appType?: string;
  languageCode?: string;
  incrementalLogs?: boolean;
}

/**
 * @class Support
 */
class Support extends WebexPlugin {
  namespace = 'Support';

  /**
   * Gets a feedback URL for the user
   * @param {Object} options - Options for feedback URL generation
   * @returns {Promise<string>} The feedback URL
   */
  getFeedbackUrl(options: Partial<SupportMetadata> = {}): Promise<string> {
    return this.request({
      method: 'POST',
      api: 'conversation',
      resource: 'users/deskFeedbackUrl',
      body: defaults(options, {
        appVersion: this.config.appVersion,
        appType: this.config.appType,
        feedbackId: options.feedbackId || uuid(),
        languageCode: this.config.languageCode,
      }),
    }).then((res) => res.body.url);
  }

  /**
   * Gets the support URL for the user
   * @returns {Promise<string>} The support URL
   */
  getSupportUrl(): Promise<string> {
    return this.webex
      .request({
        method: 'GET',
        api: 'conversation',
        resource: 'users/deskSupportUrl',
        qs: {
          languageCode: this.config.languageCode,
        },
      })
      .then((res) => res.body.url);
  }

  /**
   * Sends logs to the backend
   *
   * @param {SupportMetadata} metadata metadata about the logs
   * @param {string} logs logs to send, if undefined, SDK's logs will be sent
   * @param {SubmitLogsOptions} options additional options
   * @returns {Promise<any>}
   */
  submitLogs(
    metadata: SupportMetadata,
    logs?: string,
    options: SubmitLogsOptions = {}
  ): Promise<any> {
    const metadataArray = this._constructFileMetadata(metadata);

    const {type} = options;

    // this is really testing that the logger is fully ready
    if (
      !logs &&
      this.webex.logger.sdkBuffer &&
      this.webex.logger.clientBuffer &&
      this.webex.logger.buffer
    ) {
      const diff = type !== undefined ? type === 'diff' : this.config.incrementalLogs;

      logs = this.webex.logger.formatLogs({diff});
    }

    let filename: string;

    if (metadata.locusId && metadata.callStart) {
      filename = `${metadata.locusId}_${metadata.callStart}.txt`;
    } else {
      filename = `${this.webex.sessionId}.txt`;
    }

    let userId: string;

    return this.webex.credentials
      .getUserToken()
      .catch(() => this.webex.credentials.getClientToken())
      .then(async (token) => {
        const headers = {authorization: token.toString()};

        const initialOpts = {
          service: 'clientLogs',
          resource: 'logs/urls',
        };

        const finalOpts = {
          service: 'clientLogs',
          resource: 'logs/meta',
        };

        const uploadOptions = defaults(initialOpts, {
          file: logs,
          shouldAttemptReauth: false,
          headers,
          phases: {
            initialize: {
              body: {
                file: filename,
              },
            },
            upload: {
              $uri: (session: any) => session.tempURL,
            },
            finalize: defaults(finalOpts, {
              $body: (session: any) => {
                userId = session.userId;

                return {
                  filename: session.logFilename,
                  data: metadataArray,
                  userId: this.webex.internal.device.userId || session.userId,
                };
              },
            }),
          },
        });

        return this.webex.upload(uploadOptions);
      })
      .then((body: any) => {
        if (userId && !body.userId) {
          body.userId = userId;
        }

        return body;
      });
  }

  /**
   * Constructs an array of key-value pairs for log upload.
   * @param {SupportMetadata} metadata
   * @returns {FileMetadataEntry[]}
   */
  private _constructFileMetadata(metadata: SupportMetadata): FileMetadataEntry[] {
    const metadataArray: FileMetadataEntry[] = [
      'locusId',
      'appVersion',
      'callStart',
      'feedbackId',
      'correlationId',
      'meetingId',
      'surveySessionId',
      'productAreaTag',
      'issueTypeTag',
      'issueDescTag',
      'locussessionid',
      'autoupload',
    ]
      .map((key) => {
        const value = metadata[key as keyof SupportMetadata];
        if (value !== undefined) {
          return {
            key,
            value: String(value),
          };
        }

        return null;
      })
      .filter((entry): entry is FileMetadataEntry => Boolean(entry));

    if (this.webex.sessionId) {
      metadataArray.push({
        key: 'trackingId',
        value: this.webex.sessionId,
      });
    }

    if (this.webex.internal.support.config.appVersion) {
      metadataArray.push({
        key: 'appVersion',
        value: this.webex.internal.support.config.appVersion,
      });
    }

    if (this.webex.internal.device.userId) {
      metadataArray.push({
        key: 'userId',
        value: this.webex.internal.device.userId,
      });
    }

    if (this.webex.internal.device.orgId) {
      metadataArray.push({
        key: 'orgId',
        value: this.webex.internal.device.orgId,
      });
    }

    return metadataArray;
  }
}

export default Support;
