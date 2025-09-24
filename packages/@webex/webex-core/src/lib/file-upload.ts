/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {EventEmitter} from 'events';
import {defaultsDeep, omit} from 'lodash';
import uuid from 'uuid';

import {proxyEvents, transferEvents} from '@webex/common/src/events';

const MAX_FILE_SIZE_IN_MB = 2048;

/**
 * @class
 * @param {Object} base The base class to extend
 */
const FileUpload = (base) =>
  class extends base {
    /**
     * Uploads a file provided in `file` property
     *
     * @param {Object} options
     * @returns {Promise}
     */
    upload(options) {
      if (!options || !options.file) {
        return Promise.reject(new Error('`options.file` is required'));
      }

      options.phases = options.phases || {};
      options.phases.initialize = options.phases.initialize || {};
      options.phases.upload = options.phases.upload || {};
      options.phases.finalize = options.phases.finalize || {};

      defaultsDeep(
        options.phases.initialize,
        {
          method: 'POST',
          body: {
            uploadProtocol: 'content-length',
          },
        },
        omit(options, 'file', 'phases')
      );

      defaultsDeep(options.phases.upload, {
        method: 'PUT',
        json: false,
        withCredentials: false,
        body: options.file,
        headers: {
          'x-trans-id': uuid.v4(),
          authorization: undefined,
        },
      });

      defaultsDeep(
        options.phases.finalize,
        {
          method: 'POST',
        },
        omit(options, 'file', 'phases')
      );

      const shunt = new EventEmitter();

      const promise = this._uploadPhaseInitialize(options)
        .then(() => {
          const p = this._uploadPhaseUpload(options);

          transferEvents('progress', p, shunt);

          return p;
        })
        .then((res) => this._uploadPhaseFinalize(options))
        .then((res) => ({...res.body, ...res.headers}));

      proxyEvents(shunt, promise);

      return promise;
    }

    _uploadPhaseInitialize(options) {
      this.logger.debug('client: initiating upload session');

      return this.request(options.phases.initialize)
        .then((res) => {
          const fileUploadSizeLimitInBytes =
            (res.body.fileUploadSizeLimit || MAX_FILE_SIZE_IN_MB) * 1024 * 1024;
          const currentFileSizeInBytes = options.file.byteLength;

          if (fileUploadSizeLimitInBytes && fileUploadSizeLimitInBytes < currentFileSizeInBytes) {
            return this._uploadAbortSession(currentFileSizeInBytes, res);
          }

          return this._uploadApplySession(options, res);
        })
        .then((res) => {
          this.logger.debug('client: initiated upload session');

          return res;
        });
    }

    _uploadAbortSession(currentFileSizeInBytes, response) {
      this.logger.debug('client: deleting uploaded file');

      return this.request({
        method: 'DELETE',
        url: response.body.url,
        headers: response.options.headers,
      }).then(() => {
        this.logger.debug('client: deleting uploaded file complete');

        const abortErrorDetails = {
          currentFileSizeInBytes,
          fileUploadSizeLimitInMB: response.body.fileUploadSizeLimit || MAX_FILE_SIZE_IN_MB,
          message: 'file-upload-size-limit-enabled',
        };

        return Promise.reject(new Error(`${JSON.stringify(abortErrorDetails)}`));
      });
    }

    _uploadApplySession(options, res) {
      const session = res.body;

      ['upload', 'finalize'].reduce((opts, key) => {
        opts[key] = Object.keys(opts[key]).reduce((phaseOptions, phaseKey) => {
          if (phaseKey.startsWith('$')) {
            phaseOptions[phaseKey.substr(1)] = phaseOptions[phaseKey](session);
            Reflect.deleteProperty(phaseOptions, phaseKey);
          }

          return phaseOptions;
        }, opts[key]);

        return opts;
      }, options.phases);
    }

    _uploadPhaseUpload(options) {
      this.logger.debug('client: uploading file');

      const requestWithRetry = () =>
        this.request(options.phases.upload).catch((err) => {
          // Implement a simple retry mechanism, e.g., retry once after a delay
          return new Promise((resolve) => {
            setTimeout(resolve, 1000);
          }).then(() => this.request(options.phases.upload));
        });

      const promise = requestWithRetry();

      // The original code had `options.phases.upload.upload` which seems incorrect.
      // Assuming the intention was to proxy events from the promise.
      // proxyEvents(promise, shunt);

      /* istanbul ignore else */
      if (process.env.NODE_ENV === 'test') {
        promise.on('progress', (event) => {
          this.logger.info('upload progress', event.loaded, event.total);
        });
      }

      return promise.then((res) => {
        this.logger.debug('client: uploaded file');

        return res;
      });
    }

    _uploadPhaseFinalize(options) {
      this.logger.debug('client: finalizing upload session');

      return this.request(options.phases.finalize).then((res) => {
        this.logger.debug('client: finalized upload session');

        return res;
      });
    }
  };

export default FileUpload;
