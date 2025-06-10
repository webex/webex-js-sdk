import AmpState from 'ampersand-state';
import {ServiceUrl} from './types';

/**
 * @class
 */
const ServiceDetail = AmpState.extend({
  namespace: 'ServiceDetail',

  props: {
    serviceUrls: ['array', false, () => []],
    serviceName: ['string', true, undefined],
    id: ['string', true, undefined],
  },

  /**
   * Generate a host url based on the host
   * uri provided.
   * @param {ServiceUrl} serviceUrl
   * @returns {string}
   */
  _generateHostUrl(serviceUrl: ServiceUrl): string {
    const url = new URL(serviceUrl.baseUrl);

    // setting url.hostname will not apply during Url.format(), set host via
    // a string literal instead.
    url.host = `${serviceUrl.host}${url.port ? `:${url.port}` : ''}`;

    return url.href;
  },

  /**
   * Get the current host url with the highest priority. This will only return a URL with a filtered host that has the
   * `homeCluster` value set to `true`.
   * @returns {string} - The priority host url.
   */
  _getPriorityHostUrl(): string {
    // format of catalog ensures that array is sorted by highest priority
    let priorityServiceUrl = this._searchForValidPriorityHost();

    if (!priorityServiceUrl) {
      this.serviceUrls = this.serviceUrls.map((serviceUrl) => {
        serviceUrl.failed = false;

        return serviceUrl;
      });

      priorityServiceUrl = this._searchForValidPriorityHost();
    }

    return priorityServiceUrl ? this._generateHostUrl(priorityServiceUrl) : '';
  },

  /**
   * Searches for a valid service URL with a priority greater than 0 that has not failed.
   * @returns {ServiceUrl | undefined} - The first valid service URL found, or undefined if none exist.
   */
  _searchForValidPriorityHost(): ServiceUrl | undefined {
    return this.serviceUrls.find((serviceUrl) => serviceUrl.priority > 0 && !serviceUrl.failed);
  },

  /**
   * Attempt to mark a host from this `ServiceDetail` as failed and return true
   * if the provided url has a host that could be successfully marked as failed.
   *
   * @param {string} url
   * @returns {boolean}
   */
  failHost(url: string): boolean {
    const failedUrl = new URL(url);

    const foundHost = this.serviceUrls.find((serviceUrl) => serviceUrl.host === failedUrl.host);

    if (foundHost) {
      foundHost.failed = true;
    }

    return foundHost !== undefined;
  },

  /**
   * Generate a url using the host with the
   * highest priority via host rendering.
   *
   * @returns {string} - The full service url.
   */
  get(): string {
    // return empty string to indicate that no service url is available
    if (!this.serviceUrls || this.serviceUrls.length === 0) {
      return '';
    }

    return this._getPriorityHostUrl();
  },
});

export default ServiceDetail;
