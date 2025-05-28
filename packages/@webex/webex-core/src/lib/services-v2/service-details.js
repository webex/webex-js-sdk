import Url from 'url';

import AmpState from 'ampersand-state';

/* eslint-disable no-underscore-dangle */
/**
 * @class
 */
const ServiceDetails = AmpState.extend({
  namespace: 'ServiceDetails',

  props: {
    serviceUrls: ['array', false, () => []],
    serviceName: ['string', true, undefined],
    id: ['string', true, undefined],
  },

  /**
   * Generate a host url based on the host
   * uri provided.
   * @param {string} serviceUrl
   * @returns {string}
   */
  _generateHostUrl(serviceUrl) {
    const url = Url.parse(serviceUrl.baseUrl);

    // setting url.hostname will not apply during Url.format(), set host via
    // a string literal instead.
    url.host = `${serviceUrl.host}${url.port ? `:${url.port}` : ''}`;

    return Url.format(url);
  },

  /**
   * Get the current host url with the highest priority. This will only return a URL with a filtered host that has the
   * `homeCluster` value set to `true`.
   * @returns {string} - The priority host url.
   */
  _getPriorityHostUrl() {
    const priorityServiceUrl = this.serviceUrls.find((url) => url.priority > 0);

    return this._generateHostUrl(priorityServiceUrl);
  },

  /**
   * Attempt to mark a host from this `Service` as failed and return true
   * if the provided url has a host that could be successfully marked as failed.
   *
   * @param {string} url
   * @returns {boolean}
   */
  failHost(url) {
    const {hostname} = Url.parse(url);
    const foundHost = this.serviceUrls.find((hostObj) => hostObj.host === hostname);

    if (foundHost) {
      foundHost.failed = true;
    }

    return foundHost !== undefined;
  },

  /**
   * Get the current `defaultUrl` or generate a url using the host with the
   * highest priority via host rendering.
   *
   * @returns {string} - The full service url.
   */
  get() {
    return this._getPriorityHostUrl();
  },
});
/* eslint-enable no-underscore-dangle */

export default ServiceDetails;
