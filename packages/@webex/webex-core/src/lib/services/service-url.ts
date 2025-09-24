import Url from 'url';
import {WebexState} from '@webex/common';

export interface ServiceUrlHost {
  host: string;
  priority: number;
  id?: string;
  homeCluster?: boolean;
  failed?: boolean;
}

export interface ServiceUrlState {
  defaultUrl: string;
  hosts: ServiceUrlHost[];
  name: string;
}

/**
 * ServiceUrl class for managing service URLs with host failover
 */
export class ServiceUrl extends WebexState<ServiceUrlState> {
  namespace = 'ServiceUrl';

  /**
   * Generate a host url based on the host
   * uri provided.
   * @param {string} hostUri
   * @returns {string}
   */
  private _generateHostUrl(hostUri: string): string {
    const url = Url.parse(this.get('defaultUrl'));

    // setting url.hostname will not apply during Url.format(), set host via
    // a string literal instead.
    url.host = `${hostUri}${url.port ? `:${url.port}` : ''}`;

    return Url.format(url);
  }

  /**
   * Generate a list of urls based on this
   * `ServiceUrl`'s known hosts.
   * @returns {Array<{url: string, priority: number}>}
   */
  private _getHostUrls(): Array<{url: string; priority: number}> {
    return this.get('hosts').map((host) => ({
      url: this._generateHostUrl(host.host),
      priority: host.priority,
    }));
  }

  /**
   * Get the current host url with the highest priority. If a clusterId is not
   * provided, this will only return a URL with a filtered host that has the
   * `homeCluster` value set to `true`.
   *
   * @param {string} [clusterId] - The clusterId to filter for a priority host.
   * @returns {string} - The priority host url.
   */
  private _getPriorityHostUrl(clusterId?: string): string {
    const hosts = this.get('hosts');

    if (hosts.length === 0) {
      return this.get('defaultUrl');
    }

    let filteredHosts = clusterId
      ? hosts.filter((host) => host.id === clusterId)
      : hosts.filter((host) => host.homeCluster);

    const aliveHosts = filteredHosts.filter((host) => !host.failed);

    filteredHosts =
      aliveHosts.length === 0
        ? filteredHosts.map((host) => {
            /* eslint-disable-next-line no-param-reassign */
            host.failed = false;

            return host;
          })
        : aliveHosts;

    return this._generateHostUrl(
      filteredHosts.reduce(
        (previous, current) =>
          previous.priority > current.priority || !previous.homeCluster ? current : previous,
        {} as ServiceUrlHost
      ).host
    );
  }

  /**
   * Attempt to mark a host from this `ServiceUrl` as failed and return true
   * if the provided url has a host that could be successfully marked as failed.
   *
   * @param {string} url
   * @returns {boolean}
   */
  failHost(url: string): boolean {
    const defaultUrl = this.get('defaultUrl');

    if (url === defaultUrl) {
      return true;
    }

    const {hostname} = Url.parse(url);
    const hosts = this.get('hosts');
    const foundHost = hosts.find((hostObj) => hostObj.host === hostname);

    if (foundHost) {
      foundHost.failed = true;
      // Trigger a change event since we modified the hosts array
      this.set('hosts', [...hosts]);
    }

    return foundHost !== undefined;
  }

  /**
   * Get the current `defaultUrl` or generate a url using the host with the
   * highest priority via host rendering.
   *
   * @param {boolean} [priorityHost] - Retrieve the priority host.
   * @param {string} [clusterId] - Cluster to match a host against.
   * @returns {string} - The full service url.
   */
  get(key?: keyof ServiceUrlState): any;
  get(priorityHost?: boolean, clusterId?: string): string;
  get(keyOrPriorityHost?: keyof ServiceUrlState | boolean, clusterId?: string): any {
    // Handle the overloaded method signatures
    if (typeof keyOrPriorityHost === 'string') {
      return super.get(keyOrPriorityHost);
    }

    const priorityHost = keyOrPriorityHost;

    if (!priorityHost) {
      return this.get('defaultUrl');
    }

    return this._getPriorityHostUrl(clusterId);
  }
}

export default ServiceUrl;
