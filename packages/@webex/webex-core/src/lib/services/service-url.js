import Url from 'url';

import AmpState from 'ampersand-state';

/* eslint-disable no-underscore-dangle */
/**
 * @class
 */
const ServiceUrl = AmpState.extend({
  namespace: 'ServiceUrl',

  props: {
    defaultUrl: ['string', true, undefined],
    hosts: ['array', false, () => []],
    name: ['string', true, undefined],
  },

  /**
   * Generate a host url based on the host
   * uri provided.
   * @param {string} hostUri
   * @returns {string}
   */
  _generateHostUrl(hostUri) {
    const url = Url.parse(this.defaultUrl);

    // setting url.hostname will not apply during Url.format(), set host via
    // a string literal instead.
    url.host = `${hostUri}${url.port ? `:${url.port}` : ''}`;

    return Url.format(url);
  },

  /**
   * Generate a list of urls based on this
   * `ServiceUrl`'s known hosts.
   * @returns {string[]}
   */
  _getHostUrls() {
    return this.hosts.map((host) => ({
      url: host.baseUrl ? new URL(host.baseUrl).href : this._generateHostUrl(host.host),
      priority: host.priority,
    }));
  },

  /**
   * Get the current host url with the highest priority. If a clusterId is not
   * provided, this will only return a URL with a filtered host that has the
   * `homeCluster` value set to `true`.
   *
   * @param {string} [clusterId] - The clusterId to filter for a priority host.
   * @returns {string} - The priority host url.
   */
  _getPriorityHostUrl(clusterId) {
    if (this.hosts.length === 0) {
      return this.defaultUrl;
    }

    let filteredHosts = clusterId
      ? this.hosts.filter((host) => host.id === clusterId)
      : this.hosts.filter((host) => host.homeCluster);

    // Filter out hosts with non-positive priorities (including -1)
    filteredHosts = filteredHosts.filter((host) => host.priority > 0);

    // If no valid hosts remain after filtering, return the default URL
    if (filteredHosts.length === 0) {
      return this.defaultUrl;
    }

    const aliveHosts = filteredHosts.filter((host) => !host.failed);

    filteredHosts =
      aliveHosts.length === 0
        ? filteredHosts.map((host) => {
            /* eslint-disable-next-line no-param-reassign */
            host.failed = false;

            return host;
          })
        : aliveHosts;

    const selectedHost = filteredHosts.reduce(
      (previous, current) => (current.priority < previous.priority ? current : previous),
      filteredHosts[0]
    );

    return selectedHost.baseUrl
      ? new URL(selectedHost.baseUrl).href
      : this._generateHostUrl(selectedHost.host);
  },

  /**
   * Attempt to mark a host from this `ServiceUrl` as failed and return true
   * if the provided url has a host that could be successfully marked as failed.
   *
   * @param {string} url
   * @returns {boolean}
   */
  failHost(url) {
    if (url === this.defaultUrl && !this.hosts.some((host) => host.baseUrl === url)) {
      return true;
    }

    const {hostname} = Url.parse(url);
    let requestedUrl;

    try {
      requestedUrl = new URL(url);
    } catch {
      // Legacy hosts still use hostname matching below.
    }

    const foundHost = this.hosts.find((hostObj) => {
      if (!hostObj.baseUrl) {
        return hostObj.host === hostname;
      }

      const baseUrl = new URL(hostObj.baseUrl);
      const basePath = baseUrl.pathname.replace(/\/$/, '');

      return (
        requestedUrl?.origin === baseUrl.origin &&
        (requestedUrl.pathname === baseUrl.pathname ||
          requestedUrl.pathname.startsWith(`${basePath}/`))
      );
    });

    if (foundHost) {
      foundHost.failed = true;
    }

    return foundHost !== undefined;
  },

  /**
   * Get the current `defaultUrl` or generate a url using the host with the
   * highest priority via host rendering.
   *
   * @param {boolean} [priorityHost] - Retrieve the priority host.
   * @param {string} [clusterId] - Cluster to match a host against.
   * @returns {string} - The full service url.
   */
  get(priorityHost, clusterId) {
    if (!priorityHost) {
      return this.defaultUrl;
    }

    return this._getPriorityHostUrl(clusterId);
  },
});
/* eslint-enable no-underscore-dangle */

export default ServiceUrl;
