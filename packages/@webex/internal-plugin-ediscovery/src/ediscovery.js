/* eslint-disable prefer-template */
/* eslint-disable no-useless-escape */
/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import {waitForValue, WebexPlugin} from '@webex/webex-core';
import {oneFlight} from '@webex/common';

import {InvalidEmailAddressError} from './ediscovery-error';

/**
 * Creates a unique oneflight key for a request from the reportId and options params
 * It is important that the offset params are included if present to ensure paged requests get back the correct data
 * @param {Object} reportId - A set of criteria for determining the focus of the search
 * @param {Object} options - optional parameters for this method
 * @returns {String} oneFlight key which is a composite of the request parameters
 */
function createOneFlightKey(reportId, options) {
  let key = String(reportId);

  if (options) {
    if (options.offset) {
      key += String(options.offset);
    }
    if (options.size) {
      key += String(options.size);
    }
    if (options.types) {
      key += String(options.types);
    }
  }

  return key;
}

/**
 * @class EDiscovery is used by compliance officers to run compliance reports
 *
 */
const EDiscovery = WebexPlugin.extend({
  namespace: 'EDiscovery',

  session: {
    contentContainerCache: {
      type: 'object',
      default() {
        return new Map();
      }
    }
  },

  @waitForValue('@')
  /**
   * Creates a compliance report with a specific set of search parameters
   * @param {Object} reportRequest - A set of criteria for determining the focus of the search
   * @param {Object} options - optional parameters for this method
   * @param {number} options.timeoutMs - connection timeout in milliseconds, defaults to 30s
   * @returns {Promise<ResponseEntity>} Http response containing the new report record
   */
  async createReport(reportRequest, options) {
    if (!reportRequest) {
      throw Error('Undefined parameter');
    }

    // use spread operator to set default options
    options = {...this.config.defaultOptions, ...options};

    const body = reportRequest;

    try {
      return await this.request({
        method: 'POST',
        service: 'ediscovery',
        resource: 'reports',
        timeout: options.timeoutMs,
        body
      });
    }
    catch (reason) {
      return this._handleReportRequestError(reason);
    }
  },

  /**
   * Checks the error from createReport and ensures the appropriate error is sent to the client
   * @param {Error} reason - Error response thrown by the request to createReport
   * @returns {Promise<Error>} Promise rejection containing the error
   */
  _handleReportRequestError(reason) {
    if (reason.body.errorCode === InvalidEmailAddressError.getErrorCode()) {
      try {
        const invalidEmails = JSON.parse(reason.body.message);

        if (Array.isArray(invalidEmails) && invalidEmails.length) {
          const invalidEmailAddressError = new InvalidEmailAddressError(invalidEmails);

          return Promise.reject(invalidEmailAddressError);
        }

        this.logger.warn('InvalidEmailAddress error received but the list could not be parsed to the correct format.');
      }
      catch (error) {
        // assume syntax error and continue
        this.logger.error('InvalidEmailAddress error received but an error occured while parsing the emails.');
      }
    }

    return Promise.reject(reason);
  },

  @waitForValue('@')
  /**
   * Retrieves information relating to a specified report
   * @param {UUID} reportId - Id of the report being requested
   * @param {Object} options - optional parameters for this method
   * @param {number} options.timeoutMs - connection timeout in milliseconds, defaults to 30s
   * @returns {Promise<ResponseEntity<ReportRecord>>} Http response containing the specified report record
   */
  async getReport(reportId, options) {
    if (!reportId) {
      throw Error('Undefined parameter');
    }

    // use spread operator to set default options
    options = {...this.config.defaultOptions, ...options};

    return this.request({
      method: 'GET',
      service: 'ediscovery',
      resource: `reports/${reportId}`,
      timeout: options.timeoutMs
    });
  },

  @waitForValue('@')
  /**
   * Retrieves all the compliance officers reports
   * @param {Object} options - optional parameters for this method
   * @param {number} options.offset - start position from which to retrieve records
   * @param {number} options.size - the number of records to retrieve
   * @param {number} options.timeoutMs - connection timeout in milliseconds, defaults to 30s
   * @returns {Promise<ResponseEntity<Array<ReportRecord>>>} Http Response containing a list of report records
   */
  async getReports(options) {
    // use spread operator to set default options
    options = {...this.config.defaultOptions, ...options};

    return this.request({
      method: 'GET',
      service: 'ediscovery',
      resource: 'reports',
      qs: {offset: options.offset, size: options.size},
      timeout: options.timeoutMs
    });
  },

  @waitForValue('@')
  /**
   * Deletes a specified report
   * @param {UUID} reportId - Id of the report being requested for deletion
   * @param {Object} options - optional parameters for this method
   * @param {number} options.timeoutMs - connection timeout in milliseconds, defaults to 30s
   * @returns {Promise<ResponseEntity>} HttpResponse indicating if delete was successful
   */
  async deleteReport(reportId, options) {
    if (!reportId) {
      throw Error('Undefined parameter');
    }

    // use spread operator to set default options
    options = {...this.config.defaultOptions, ...options};

    return this.request({
      method: 'DELETE',
      service: 'ediscovery',
      resource: `reports/${reportId}`,
      timeout: options.timeoutMs
    });
  },

  @waitForValue('@')
  /**
   * Restarts a completed or cancelled report so that it begins again from scratch
   * @param {UUID} reportId - Id of the report being requested
   * @param {Object} options - optional parameters for this method
   * @param {number} options.timeoutMs - connection timeout in milliseconds, defaults to 30s
   * @returns {Promise<ResponseEntity<ReportRecord>>} Http response containing the report record
   */
  async restartReport(reportId, options) {
    if (!reportId) {
      throw Error('Undefined parameter');
    }

    // use spread operator to set default options
    options = {...this.config.defaultOptions, ...options};

    return this.request({
      method: 'PUT',
      service: 'ediscovery',
      resource: `reports/${reportId}`,
      timeout: options.timeoutMs
    });
  },

  @waitForValue('@')
  @oneFlight({keyFactory: (reportId, options) => createOneFlightKey(reportId, options)})
  /**
   * Retrieves content associated with a report
   * @param {UUID|string} reportId - UUID or url of the report which contains the content
   * @param {Object} options - optional parameters for this method
   * @param {number} options.offset - start position from which to retrieve records
   * @param {number} options.size - the number of records to retrieve
   * @param {number} options.timeoutMs - connection timeout in milliseconds, defaults to 30s
   * @returns {Promise<ResponseEntity<[Activity]>>} Http response containing the activities
   */
  async getContent(reportId, options) {
    if (!reportId) {
      throw Error('Undefined parameter');
    }

    // use spread operator to set default options
    options = {...this.config.defaultOptions, ...options};

    const [requestOptions] = this._createRequestOptions(reportId, '/contents');

    return this.request({
      method: 'GET',
      ...requestOptions,
      qs: {offset: options.offset, size: options.size},
      timeout: options.timeoutMs
    });
  },

  @waitForValue('@')
  @oneFlight({keyFactory: (reportId, options) => createOneFlightKey(reportId, options)})
  /**
   * Retrieves a list of content containers relevant to a specified report
   * @param {UUID|string} reportId - UUID or url of the report being requested
   * @param {Object} options - optional parameters for this method
   * @param {number} options.offset - start position from which to retrieve records
   * @param {number} options.size - the number of records to retrieve
   * @param {number} options.timeoutMs - connection timeout in milliseconds, defaults to 30s
   * @param {Set<Object>} options.types - Set of ContentContainerTypes to be retrieved
   * @returns {Promise<ResponseEntity<ContentContainer>>} Http response containing the content containers
   */
  async getContentContainer(reportId, options) {
    if (!reportId) {
      throw Error('Undefined parameter');
    }

    // use spread operator to set default options
    options = {...this.config.defaultOptions, ...options};

    const [requestOptions, reportUUID] = this._createRequestOptions(reportId, '/contents/container');

    const res = await this.request({
      method: 'GET',
      ...requestOptions,
      qs: {offset: options.offset, size: options.size},
      timeout: options.timeoutMs,
      types: options.types
    });

    await this._writeToContentContainerCache(reportUUID, res.body);

    return res;
  },

  @waitForValue('@')
  @oneFlight({keyFactory: (reportId, containerId) => String(reportId + containerId)})
  /**
   * Retrieves information for a specific content container relevant to a specified report
   * @param {UUID|string} reportId - UUID or url of the report being requested
   * @param {UUID} containerId - Id of the contenyt container being requested
   * @param {Object} options - optional parameters for this method
   * @param {number} options.timeoutMs - connection timeout in milliseconds, defaults to 30s
   * @returns {Promise<ResponseEntity<ContentContainer>>} Http response containing the specified content container
   */
  async getContentContainerByContainerId(reportId, containerId, options) {
    if (!reportId || !containerId) {
      throw Error('Undefined parameter');
    }

    // use spread operator to set default options
    options = {...this.config.defaultOptions, ...options};

    const [requestOptions, reportUUID] = this._createRequestOptions(reportId, `/contents/container/${containerId}`);

    // If this content container has already been cached then it can be retrieved from there instead of making a network call to ediscovery
    if (this.contentContainerCache.has(reportUUID) && this.contentContainerCache.get(reportUUID).has(containerId)) {
      return {body: this.contentContainerCache.get(reportUUID).get(containerId), statusCode: 200};
    }

    this.logger.warn(`Cache miss for container ${containerId} in contentContainerCache`);

    const res = await this.request({
      method: 'GET',
      ...requestOptions,
      qs: {offset: options.offset, size: options.size},
      timeout: options.timeoutMs
    });

    await this._writeToContentContainerCache(reportUUID, [res.body]);

    return res;
  },

  /**
   * The results of a getContentContainer or getContentContainerByContainerId request are written to the contentContainerCache
   * since information for a container is likely to be accessed very frequently when decrypting activities
   * @param {UUID} reportId - Id of the report which contains the relevant content summary
   * @param {Array<Object>} containers - List of the container objects to be written to the cache
   * @returns {Promise} - Promise resolution indicating operation is complete
   */
  _writeToContentContainerCache(reportId, containers) {
    if (!reportId || !containers || !containers.length) {
      return;
    }

    if (!this.contentContainerCache.has(reportId)) {
      this.contentContainerCache.set(reportId, new Map());
    }

    for (const container of containers) {
      if (container && container.containerId) {
        try {
          this.contentContainerCache.get(reportId).set(container.containerId, container);
        }
        catch (error) {
          this.logger.error(`Error adding ${container.containerId} to contentContainerCache: ${error}`);
        }
      }
      else {
        this.logger.error('Error adding undefined container to contentContainerCache');
      }
    }
  },

  /**
   * Wipe the cache used by eDiscovery to store the space summaries and content containers.
   * Good practice to clear it down when finished with a report to save RAM.
   * @returns {undefined}
   */
  clearCache() {
    this.contentContainerCache.clear();
  },

  /**
   * Retrieves a uuid string from a report url
   * @param {String} reportUrl - full destination address (including report id parameter) for the http request being sent
   * e.g. 'http://ediscovery-intb.wbx2.com/ediscovery/api/v1/reports/3b10e625-2bd5-4efa-b866-58d6c93c505c'
   * @returns {String} - uuid of the report
   */
  _getReportIdFromUrl(reportUrl) {
    if (reportUrl) {
      const uuids = reportUrl.match(/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/);

      if (uuids && uuids.length > 0) {
        return uuids[0];
      }
    }

    return '';
  },

  _isUrl(string) {
    // Regex found from `https://ihateregex.io/expr/url`
    return /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/g.test(string);
  },

  /**
   * Create the appropriate request options based on whether the reportId is a url or a uuid.
   * @param {UUID|string} reportId - May be either a url for the report or a uuid.
   * e.g. 'http://ediscovery-intb.wbx2.com/ediscovery/api/v1/reports/3b10e625-2bd5-4efa-b866-58d6c93c505c' or '3b10e625-2bd5-4efa-b866-58d6c93c505c'.
   * @param {String} resource - The resource on the remote server to request
   * @returns {[Options, uuid]} - The options to pass to `request` and the report uuid.
   */
  _createRequestOptions(reportId, resource) {
    let requestOptions;
    let reportUUID;
    const isUrl = this._isUrl(reportId);

    if (isUrl) {
      reportUUID = this._getReportIdFromUrl(reportId);

      if (!reportUUID) {
        throw Error('Report url does not contain a report id');
      }

      // Ensure the url is formatted to
      // https://ediscovery.intb1.ciscospark.com/ediscovery/api/v1/reports/16bf0d01-b1f7-483b-89a2-915144158fb9
      // index.js for example passes the url in as
      // https://ediscovery.intb1.ciscospark.com/ediscovery/api/v1/reports/16bf0d01-b1f7-483b-89a2-915144158fb9/contents
      const reportUrl = reportId.substring(0, reportId.lastIndexOf(reportUUID) + reportUUID.length);

      requestOptions = {
        url: reportUrl + resource
      };
    }
    else {
      requestOptions = {
        service: 'ediscovery',
        resource: `reports/${reportId}/${resource}`
      };
      reportUUID = reportId;
    }

    return [requestOptions, reportUUID];
  },

  @waitForValue('@')
  /**
   * Retrieves a config object from the service which can be used by the client for optimal performance, e.g. content page size
   * @param {Object} options - optional parameters for this method
   * @param {number} options.timeoutMs - connection timeout in milliseconds, defaults to 30s
   * @returns {Promise<Config>} Http response containing the config object
   */
  async getClientConfig(options) {
    // use spread operator to set default options
    options = {...this.config.defaultOptions, ...options};

    return this.request({
      method: 'GET',
      service: 'ediscovery',
      resource: 'reports/clientconfig',
      timeout: options.timeoutMs
    });
  },

  @waitForValue('@')
  /**
   * Submits an audit event to the eDiscovery service for admin use. Only expected to be used for
   * the getContentContainer API
   * @param {UUID} reportId - Id of the report to send an audit log for
   * @param {Object} options - optional parameters for this method
   * @param {number} options.timeoutMs - connection timeout in milliseconds, defaults to 30s
   * @returns {Promise<Config>} Http response containing the config object
   */
  async postAuditLog(reportId, options) {
    if (!reportId) {
      throw Error('No report ID specified');
    }

    // use spread operator to set default options
    options = {...this.config.defaultOptions, ...options};

    return this.request({
      method: 'POST',
      service: 'ediscovery',
      resource: `reports/${reportId}/audit/summary-download`,
      timeout: options.timeoutMs
    });
  }

});

export default EDiscovery;
