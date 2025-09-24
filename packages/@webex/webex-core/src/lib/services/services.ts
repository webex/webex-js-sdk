import sha256 from 'crypto-js/sha256';

import {union, forEach} from 'lodash';
import WebexPlugin from '../webex-plugin';

import METRICS from '../metrics';
import ServiceCatalog from './service-catalog';
import ServiceRegistry from './service-registry';
import ServiceState from './service-state';
import fedRampServices from './service-fed-ramp';
import {COMMERCIAL_ALLOWED_DOMAINS} from '../constants';

const trailingSlashes = /(?:^\/)|(?:\/$)/;

// The default cluster when one is not provided (usually as 'US' from hydra)
export const DEFAULT_CLUSTER = 'urn:TEAM:us-east-2_a';
// The default service name for convo (currently identityLookup due to some weird CSB issue)
export const DEFAULT_CLUSTER_SERVICE = 'identityLookup';

const CLUSTER_SERVICE = process.env.WEBEX_CONVERSATION_CLUSTER_SERVICE || DEFAULT_CLUSTER_SERVICE;
const DEFAULT_CLUSTER_IDENTIFIER =
  process.env.WEBEX_CONVERSATION_DEFAULT_CLUSTER || `${DEFAULT_CLUSTER}:${CLUSTER_SERVICE}`;

/**
 * Interface for validate user parameter transfer object
 */
interface ValidateUserPTO {
  email: string;
  reqId?: string;
  forceRefresh?: boolean;
  activationOptions?: Record<string, any>;
  preloginUserId?: string;
}

/**
 * Interface for validate user return transfer object
 */
interface ValidateUserRTO {
  activated: boolean;
  exists: boolean;
  details: string;
  user?: any;
}

/**
 * Interface for send user activation parameter transfer object
 */
interface SendUserActivationPTO {
  email: string;
  reqId: string;
  token: string;
  activationOptions?: Record<string, any>;
  preloginUserId?: string;
}

/**
 * Interface for wait for service parameter transfer object
 */
interface WaitForServicePTO {
  name?: string;
  url?: string;
  timeout?: number;
}

/**
 * Interface for update services parameters
 */
interface UpdateServicesParams {
  from?: string;
  query?: Record<string, any>;
  token?: string;
  forceRefresh?: boolean;
}

/**
 * Interface for fetch new service hostmap parameters
 */
interface FetchNewServiceHostmapParams {
  from?: string;
  query?: Record<string, any>;
  token?: string;
  forceRefresh?: boolean;
}

/**
 * Interface for get service from cluster ID parameters
 */
interface GetServiceFromClusterIdParams {
  clusterId: string;
  priorityHost?: boolean;
  serviceGroup?: string;
}

/**
 * Interface for get service URL from cluster ID parameters
 */
interface GetServiceUrlFromClusterIdParams {
  cluster?: string;
}

/**
 * Interface for service object returned by getServiceFromUrl
 */
interface ServiceObject {
  name: string;
  priorityUrl: string;
  defaultUrl: string;
}

/**
 * Services plugin class for managing Webex service discovery and catalogs
 * @class Services
 * @extends WebexPlugin
 */
class Services extends WebexPlugin {
  namespace = 'Services';

  /**
   * The {@link WeakMap} of {@link ServiceRegistry} class instances that are
   * keyed with WebexCore instances.
   *
   * @instance
   * @type {WeakMap<WebexCore, ServiceRegistry>}
   * @private
   * @memberof Services
   */
  registries = new WeakMap();

  /**
   * The {@link WeakMap} of {@link ServiceState} class instances that are
   * keyed with WebexCore instances.
   *
   * @instance
   * @type {WeakMap<WebexCore, ServiceState>}
   * @private
   * @memberof Services
   */
  states = new WeakMap();

  validateDomains = true;
  initFailed = false;

  private _catalogs = new WeakMap();
  private _serviceUrls: Record<string, string> | null = null;
  private _hostCatalog: Record<string, any> | null = null;

  /**
   * Constructor for Services plugin
   * @param attrs - Initial attributes
   * @param options - Plugin options
   */
  constructor(attrs: any, options: any) {
    super(attrs, options);
  }

  /**
   * Get the registry associated with this webex instance.
   *
   * @private
   * @memberof Services
   * @returns {ServiceRegistry} - The associated {@link ServiceRegistry}.
   */
  getRegistry(): any {
    return this.registries.get(this.webex);
  }

  /**
   * Get the state associated with this webex instance.
   *
   * @private
   * @memberof Services
   * @returns {ServiceState} - The associated {@link ServiceState}.
   */
  getState(): any {
    return this.states.get(this.webex);
  }

  /**
   * @private
   * Get the current catalog based on the associated
   * webex instance.
   * @returns {ServiceCatalog}
   */
  private _getCatalog(): any {
    return this._catalogs.get(this.webex);
  }

  /**
   * Get a service url from the current services list by name
   * from the associated instance catalog.
   * @param name - Service name
   * @param priorityHost - Use priority host
   * @param serviceGroup - Service group
   * @returns Service URL or undefined
   */
  get(name: string, priorityHost?: boolean, serviceGroup?: string): string | undefined {
    const catalog = this._getCatalog();

    return catalog.get(name, priorityHost, serviceGroup);
  }

  /**
   * Determine if the catalog contains a specific service
   *
   * @param serviceName - The service name to validate.
   * @returns True if the service exists.
   */
  hasService(serviceName: string): boolean {
    return !!this.get(serviceName);
  }

  /**
   * Determine if a allowlist exists in the service catalog.
   *
   * @returns True if a allowed domains list exists.
   */
  hasAllowedDomains(): boolean {
    const catalog = this._getCatalog();

    return catalog.getAllowedDomains().length > 0;
  }

  /**
   * Generate a service catalog as an object from
   * the associated instance catalog.
   * @param priorityHost - use highest priority host if set to `true`
   * @param serviceGroup - Service group
   * @returns Service catalog object
   */
  list(priorityHost?: boolean, serviceGroup?: string): Record<string, string> {
    const catalog = this._getCatalog();

    return catalog.list(priorityHost, serviceGroup);
  }

  /**
   * Mark a priority host service url as failed.
   * This will mark the host associated with the
   * `ServiceUrl` to be removed from the its
   * respective host array, and then return the next
   * viable host from the `ServiceUrls` host array,
   * or the `ServiceUrls` default url if no other priority
   * hosts are available, or if `noPriorityHosts` is set to
   * `true`.
   * @param url - Failed URL
   * @param noPriorityHosts - Disable priority hosts
   * @returns Next available URL
   */
  markFailedUrl(url: string, noPriorityHosts?: boolean): string {
    const catalog = this._getCatalog();

    return catalog.markFailedUrl(url, noPriorityHosts);
  }

  /**
   * saves all the services from the pre and post catalog service
   * @param serviceUrls - Service URLs to update
   */
  private _updateServiceUrls(serviceUrls: Record<string, string>): void {
    this._serviceUrls = {...this._serviceUrls, ...serviceUrls};
  }

  /**
   * saves the hostCatalog object
   * @param hostCatalog - Host catalog to update
   */
  private _updateHostCatalog(hostCatalog: Record<string, any>): void {
    this._hostCatalog = {...this._hostCatalog, ...hostCatalog};
  }

  /**
   * Update a list of `serviceUrls` to the most current
   * catalog via the defined `discoveryUrl` then returns the current
   * list of services.
   * @param params - Update parameters
   * @returns Promise resolving to updated services
   */
  updateServices(params: UpdateServicesParams = {}): Promise<any> {
    const {from, query, token, forceRefresh} = params;
    const catalog = this._getCatalog();
    let formattedQuery: Record<string, any> | undefined;
    let serviceGroup: string;

    // map catalog name to service group name.
    switch (from) {
      case 'limited':
        serviceGroup = 'preauth';
        break;
      case 'signin':
        serviceGroup = 'signin';
        break;
      default:
        serviceGroup = 'postauth';
        break;
    }

    // confirm catalog update for group is not in progress.
    if (catalog.status[serviceGroup].collecting) {
      return this.waitForCatalog(serviceGroup);
    }

    catalog.status[serviceGroup].collecting = true;

    if (serviceGroup === 'preauth') {
      const queryKey = query && Object.keys(query)[0];

      if (!['email', 'emailhash', 'userId', 'orgId', 'mode'].includes(queryKey)) {
        return Promise.reject(
          new Error('a query param of email, emailhash, userId, orgId, or mode is required')
        );
      }
    }
    // encode email when query key is email
    if (serviceGroup === 'preauth' || serviceGroup === 'signin') {
      const queryKey = Object.keys(query || {})[0];

      formattedQuery = {};

      if (queryKey === 'email' && query?.email) {
        formattedQuery.emailhash = sha256(query.email.toLowerCase()).toString();
      } else if (query && queryKey) {
        formattedQuery[queryKey] = query[queryKey];
      }
    }

    return this._fetchNewServiceHostmap({
      from,
      token,
      query: formattedQuery,
      forceRefresh,
    })
      .then((serviceHostMap) => {
        catalog.updateServiceUrls(serviceGroup, serviceHostMap);
        this.updateCredentialsConfig();
        catalog.status[serviceGroup].collecting = false;
      })
      .catch((error) => {
        catalog.status[serviceGroup].collecting = false;

        return Promise.reject(error);
      });
  }

  /**
   * Validate if a user is activated and update the service catalogs as needed
   * based on the user's activation status.
   *
   * @param params - The parameter transfer object.
   * @returns The return transfer object.
   */
  validateUser(params: ValidateUserPTO): Promise<ValidateUserRTO> {
    const {
      email,
      reqId = 'WEBCLIENT',
      forceRefresh = false,
      activationOptions = {},
      preloginUserId,
    } = params;

    this.logger.info('services: validating a user');

    // Validate that an email parameter key was provided.
    if (!email) {
      return Promise.reject(new Error('`email` is required'));
    }

    // Destructure the credentials object.
    const {canAuthorize} = this.webex.credentials;

    // Validate that the user is already authorized.
    if (canAuthorize) {
      return this.updateServices({forceRefresh})
        .then(() => this.webex.credentials.getUserToken())
        .then((token: any) =>
          this.sendUserActivation({
            email,
            reqId,
            token: token.toString(),
            activationOptions,
            preloginUserId,
          })
        )
        .then((userObj: any) => ({
          activated: true,
          exists: true,
          details: 'user is authorized via a user token',
          user: userObj,
        }));
    }

    // Destructure the client authorization details.
    /* eslint-disable camelcase */
    const {client_id, client_secret} = this.webex.credentials.config;

    // Validate that client authentication details exist.
    if (!client_id || !client_secret) {
      return Promise.reject(new Error('client authentication details are not available'));
    }
    /* eslint-enable camelcase */

    // Declare a class-member-scoped token for usage within the promise chain.
    let token: string;

    // Begin client authentication user validation.
    return (
      this.collectPreauthCatalog({email})
        .then(() => {
          // Retrieve the service url from the updated catalog. This is required
          // since `WebexCore` is usually not fully initialized at the time this
          // request completes.
          const idbrokerService = this.get('idbroker', true);

          // Collect the client auth token.
          return this.webex.credentials.getClientToken({
            uri: `${idbrokerService}idb/oauth2/v1/access_token`,
            scope: 'webexsquare:admin webexsquare:get_conversation Identity:SCIM',
          });
        })
        .then((tokenObj: any) => {
          // Generate the token string.
          token = tokenObj.toString();

          // Collect the signin catalog using the client auth information.
          return this.collectSigninCatalog({email, token, forceRefresh});
        })
        // Validate if collecting the signin catalog failed and populate the RTO
        // with the appropriate content.
        .catch((error: any) => ({
          exists: error.name !== 'NotFound',
          activated: false,
          details:
            error.name !== 'NotFound'
              ? 'user exists but is not activated'
              : 'user does not exist and is not activated',
        }))
        // Validate if the previous promise resolved with an RTO and populate the
        // new RTO accordingly.
        .then((rto: any) =>
          Promise.all([
            rto || {
              activated: true,
              exists: true,
              details: 'user exists and is activated',
            },
            this.sendUserActivation({
              email,
              reqId,
              token,
              activationOptions,
              preloginUserId,
            }),
          ])
        )
        .then(([rto, user]) => ({...rto, user}))
        .catch((error: any) => {
          const response = {
            statusCode: error.statusCode,
            responseText: error.body && error.body.message,
            body: error.body,
          };

          return Promise.reject(response);
        })
    );
  }

  /**
   * Get user meeting preferences (preferred webex site).
   *
   * @returns User Information including user preferences.
   */
  getMeetingPreferences(): Promise<any> {
    return this.request({
      method: 'GET',
      service: 'hydra',
      resource: 'meetingPreferences',
    })
      .then((res: any) => {
        this.logger.info('services: received user region info');

        return res.body;
      })
      .catch((err: any) => {
        this.logger.info('services: was not able to fetch user login information', err);
        // resolve successfully even if request failed
      });
  }

  /**
   * Fetches client region info such as countryCode and timezone.
   *
   * @returns The region info object.
   */
  fetchClientRegionInfo(): Promise<any> {
    const {services} = this.webex.config;

    return this.request({
      uri: services.discovery.sqdiscovery,
      addAuthHeader: false,
      headers: {
        'spark-user-agent': null,
      },
      timeout: 5000,
    })
      .then((res: any) => {
        this.logger.info('services: received user region info');

        return res.body;
      })
      .catch((err: any) => {
        this.logger.info('services: was not able to get user region info', err);
        // resolve successfully even if request failed
      });
  }

  /**
   * Send a request to activate a user using a client token.
   *
   * @param params - The Parameter transfer object.
   * @returns The DTO returned from the **License** service.
   */
  sendUserActivation(params: SendUserActivationPTO): Promise<any> {
    const {email, reqId, token, activationOptions, preloginUserId} = params;

    this.logger.info('services: sending user activation request');
    let countryCode: string | undefined;
    let timezone: string | undefined;

    // try to fetch client region info first
    return (
      this.fetchClientRegionInfo()
        .then((clientRegionInfo: any) => {
          if (clientRegionInfo) {
            ({countryCode, timezone} = clientRegionInfo);
          }

          // Send the user activation request to the **License** service.
          return this.request({
            service: 'license',
            resource: 'users/activations',
            method: 'POST',
            headers: {
              accept: 'application/json',
              authorization: token,
              'x-prelogin-userid': preloginUserId,
            },
            body: {
              email,
              reqId,
              countryCode,
              timeZone: timezone,
              ...activationOptions,
            },
            shouldRefreshAccessToken: false,
          });
        })
        // On success, return the **License** user object.
        .then(({body}: any) => body)
        // On failure, reject with error from **License**.
        .catch((error: any) => Promise.reject(error))
    );
  }

  /**
   * Updates a given service group i.e. preauth, signin, postauth with a new hostmap.
   * @param serviceGroup - preauth, signin, postauth
   * @param hostMap - The new hostmap to update the service group with.
   * @returns Promise resolving when complete
   */
  updateCatalog(serviceGroup: string, hostMap: any): Promise<void> {
    const catalog = this._getCatalog();

    const serviceHostMap = this._formatReceivedHostmap(hostMap);

    return catalog.updateServiceUrls(serviceGroup, serviceHostMap);
  }

  /**
   * simplified method to update the preauth catalog via email
   *
   * @param query - Query parameters
   * @param forceRefresh - Boolean to bypass u2c cache control header
   * @returns Promise resolving when complete
   */
  collectPreauthCatalog(query?: Record<string, any>, forceRefresh = false): Promise<void> {
    if (!query) {
      return this.updateServices({
        from: 'limited',
        query: {mode: 'DEFAULT_BY_PROXIMITY'},
        forceRefresh,
      });
    }

    return this.updateServices({from: 'limited', query, forceRefresh});
  }

  /**
   * simplified method to update the signin catalog via email and token
   * @param params - Parameters object
   * @returns Promise resolving when complete
   */
  collectSigninCatalog(
    params: {email?: string; token?: string; forceRefresh?: boolean} = {}
  ): Promise<void> {
    const {email, token, forceRefresh} = params;

    if (!email) {
      return Promise.reject(new Error('`email` is required'));
    }
    if (!token) {
      return Promise.reject(new Error('`token` is required'));
    }

    return this.updateServices({
      from: 'signin',
      query: {email},
      token,
      forceRefresh,
    });
  }

  /**
   * Updates credentials config to utilize u2c catalog
   * urls.
   */
  updateCredentialsConfig(): void {
    const {idbroker, identity} = this.list(true);

    if (idbroker && identity) {
      const {authorizationString, authorizeUrl} = this.webex.config.credentials;

      // This must be set outside of the setConfig method used to assign the
      // idbroker and identity url values.
      this.webex.config.credentials.authorizeUrl = authorizationString
        ? authorizeUrl
        : `${idbroker.replace(trailingSlashes, '')}/idb/oauth2/v1/authorize`;

      this.webex.setConfig({
        credentials: {
          idbroker: {
            url: idbroker.replace(trailingSlashes, ''), // remove trailing slash
          },
          identity: {
            url: identity.replace(trailingSlashes, ''), // remove trailing slash
          },
        },
      });
    }
  }

  /**
   * Wait until the service catalog is available,
   * or reject after a timeout of 60 seconds.
   * @param serviceGroup - Service group to wait for
   * @param timeout - Timeout in seconds
   * @returns Promise resolving when ready
   */
  waitForCatalog(serviceGroup: string, timeout?: number): Promise<void> {
    const catalog = this._getCatalog();
    const {supertoken} = this.webex.credentials;

    if (
      serviceGroup === 'postauth' &&
      supertoken &&
      supertoken.access_token &&
      !catalog.status.postauth.collecting &&
      !catalog.status.postauth.ready
    ) {
      if (!catalog.status.preauth.ready) {
        return this.initServiceCatalogs();
      }

      return this.updateServices();
    }

    return catalog.waitForCatalog(serviceGroup, timeout);
  }

  /**
   * Wait until the service has been amended to any service catalog. This
   * method prioritizes the service name over the service url when searching.
   *
   * @param params - The parameter transfer object.
   * @returns Resolves to the priority host of a service.
   */
  waitForService(params: WaitForServicePTO): Promise<string> {
    const {name, timeout = 5, url} = params;
    const {services} = this.webex.config;

    // Save memory by grabbing the catalog after there isn't a priorityURL
    const catalog = this._getCatalog();

    const fetchFromServiceUrl = services.servicesNotNeedValidation.find(
      (service: string) => service === name
    );

    if (fetchFromServiceUrl) {
      return Promise.resolve(this._serviceUrls![name!]);
    }

    const priorityUrl = this.get(name!, true);
    const priorityUrlObj = this.getServiceFromUrl(url);

    if (priorityUrl || priorityUrlObj) {
      return Promise.resolve(priorityUrl || priorityUrlObj.priorityUrl);
    }

    if (catalog.isReady) {
      if (url) {
        return Promise.resolve(url);
      }

      this.webex.internal.metrics.submitClientMetrics(METRICS.JS_SDK_SERVICE_NOT_FOUND, {
        fields: {service_name: name},
      });

      return Promise.reject(
        new Error(`services: service '${name}' was not found in any of the catalogs`)
      );
    }

    return new Promise((resolve, reject) => {
      const groupsToCheck = ['preauth', 'signin', 'postauth'];
      const checkCatalog = (catalogGroup: string) =>
        catalog
          .waitForCatalog(catalogGroup, timeout)
          .then(() => {
            const scopedPriorityUrl = this.get(name!, true);
            const scopedPriorityUrlObj = this.getServiceFromUrl(url);

            if (scopedPriorityUrl || scopedPriorityUrlObj) {
              resolve(scopedPriorityUrl || scopedPriorityUrlObj.priorityUrl);
            }
          })
          .catch(() => undefined);

      Promise.all(groupsToCheck.map((group) => checkCatalog(group))).then(() => {
        this.webex.internal.metrics.submitClientMetrics(METRICS.JS_SDK_SERVICE_NOT_FOUND, {
          fields: {service_name: name},
        });
        reject(new Error(`services: service '${name}' was not found after waiting`));
      });
    });
  }

  /**
   * Looks up the hostname in the host catalog
   * and replaces it with the first host if it finds it
   * @param uri - URI to process
   * @returns URI with the host replaced
   */
  replaceHostFromHostmap(uri: string): string {
    const url = new URL(uri);
    const hostCatalog = this._hostCatalog;

    if (!hostCatalog) {
      return uri;
    }

    const host = hostCatalog[url.host];

    if (host && host[0]) {
      const newHost = host[0].host;

      url.host = newHost;

      return url.toString();
    }

    return uri;
  }

  /**
   * @private
   * Organize a received hostmap from a service
   * catalog endpoint.
   * @param serviceHostmap - Service hostmap
   * @returns Formatted hostmap
   */
  private _formatReceivedHostmap(serviceHostmap: any): any[] {
    this._updateHostCatalog(serviceHostmap.hostCatalog);

    const extractId = (entry: any) => entry.id.split(':')[3];

    const formattedHostmap: any[] = [];

    // for each of the services in the serviceLinks, find the matching host in the catalog
    Object.keys(serviceHostmap.serviceLinks).forEach((serviceName) => {
      const serviceUrl = serviceHostmap.serviceLinks[serviceName];

      let host: string;
      try {
        host = new URL(serviceUrl).host;
      } catch (e) {
        return;
      }

      const matchingCatalogEntry = serviceHostmap.hostCatalog[host];

      const formattedHost = {
        name: serviceName,
        defaultUrl: serviceUrl,
        defaultHost: host,
        hosts: [],
      };

      formattedHostmap.push(formattedHost);

      // If the catalog does not have any hosts we will be unable to find the service ID
      // so can't search for other hosts
      if (!matchingCatalogEntry || !matchingCatalogEntry[0]) {
        return;
      }

      const serviceId = extractId(matchingCatalogEntry[0]);

      forEach(matchingCatalogEntry, (entry: any) => {
        // The ids for all hosts within a hostCatalog entry should be the same
        // but for safety, only add host entries that have the same id as the first one
        if (extractId(entry) === serviceId) {
          formattedHost.hosts.push({
            ...entry,
            homeCluster: true,
          });
        }
      });

      const otherHosts: any[] = [];

      // find the services in the host catalog that have the same id
      // and add them to the otherHosts
      forEach(serviceHostmap.hostCatalog, (entry: any) => {
        // exclude the matching catalog entry as we have already added that
        if (entry === matchingCatalogEntry) {
          return;
        }

        forEach(entry, (entryHost: any) => {
          // only add hosts that have the correct id
          if (extractId(entryHost) === serviceId) {
            otherHosts.push({
              ...entryHost,
              homeCluster: false,
            });
          }
        });
      });

      formattedHost.hosts.push(...otherHosts);
    });

    // update all the service urls in the host catalog

    this._updateServiceUrls(serviceHostmap.serviceLinks);
    this._updateHostCatalog(serviceHostmap.hostCatalog);

    return formattedHostmap;
  }

  /**
   * Get the clusterId associated with a URL string.
   * @param url - URL to check
   * @returns Cluster ID of url provided
   */
  getClusterId(url: string): string {
    const catalog = this._getCatalog();

    return catalog.findClusterId(url);
  }

  /**
   * Get a service value from a provided clusterId. This method will
   * return an object containing both the name and url of a found service.
   * @param params - Parameters
   * @returns Service object
   */
  getServiceFromClusterId(params: GetServiceFromClusterIdParams): {name: string; url: string} {
    const catalog = this._getCatalog();

    return catalog.findServiceFromClusterId(params);
  }

  /**
   * Get service URL from cluster ID
   * @param params - Parameters containing cluster info
   * @returns URL of the service
   */
  getServiceUrlFromClusterId(params: GetServiceUrlFromClusterIdParams = {}): string {
    const {cluster = 'us'} = params;
    let clusterId = cluster === 'us' ? DEFAULT_CLUSTER_IDENTIFIER : cluster;

    // Determine if cluster has service name (non-US clusters from hydra do not)
    if (clusterId.split(':').length < 4) {
      // Add Service to cluster identifier
      clusterId = `${cluster}:${CLUSTER_SERVICE}`;
    }

    const {url} = this.getServiceFromClusterId({clusterId}) || {};

    if (!url) {
      throw Error(`Could not find service for cluster [${cluster}]`);
    }

    return url;
  }

  /**
   * Get a service object from a service url if the service url exists in the
   * catalog.
   *
   * @param url - The url to be validated.
   * @returns Service object or undefined.
   */
  getServiceFromUrl(url = ''): ServiceObject | undefined {
    const service = this._getCatalog().findServiceUrlFromUrl(url);

    if (!service) {
      return undefined;
    }

    return {
      name: service.name,
      priorityUrl: service.get(true),
      defaultUrl: service.get(),
    };
  }

  /**
   * Verify that a provided url exists in the service
   * catalog.
   * @param url - URL to verify
   * @returns true if exists, false otherwise
   */
  isServiceUrl(url: string): boolean {
    const catalog = this._getCatalog();

    return !!catalog.findServiceUrlFromUrl(url);
  }

  /**
   * Determine if a provided url is in the catalog's allowed domains.
   *
   * @param url - The url to match allowed domains against.
   * @returns True if the url provided is allowed.
   */
  isAllowedDomainUrl(url: string): boolean {
    const catalog = this._getCatalog();

    return !!catalog.findAllowedDomain(url);
  }

  /**
   * Converts the host portion of the url from default host
   * to a priority host
   *
   * @param url - a service url that contains a default host
   * @returns a service url that contains the top priority host.
   * @throws if url isn't a service url
   */
  convertUrlToPriorityHostUrl(url = ''): string {
    const data = this.getServiceFromUrl(url);

    if (!data) {
      throw Error(`No service associated with url: [${url}]`);
    }

    return url.replace(data.defaultUrl, data.priorityUrl);
  }

  /**
   * @private
   * Simplified method wrapper for sending a request to get
   * an updated service hostmap.
   * @param params - Request parameters
   * @returns Promise resolving to formatted hostmap
   */
  private _fetchNewServiceHostmap(params: FetchNewServiceHostmapParams = {}): Promise<any> {
    const {from, query, token, forceRefresh} = params;
    const service = 'u2c';
    const resource = from ? `/${from}/catalog` : '/catalog';
    const qs: Record<string, any> = {...query, format: 'hostmap'};

    if (forceRefresh) {
      qs.timestamp = new Date().getTime();
    }

    const requestObject: any = {
      method: 'GET',
      service,
      resource,
      qs,
    };

    if (token) {
      requestObject.headers = {authorization: token};
    }

    return this.webex.internal.newMetrics.callDiagnosticLatencies
      .measureLatency(() => this.request(requestObject), 'internal.get.u2c.time')
      .then(({body}: any) => this._formatReceivedHostmap(body));
  }

  /**
   * Initialize the discovery services and the allowlisted services.
   */
  initConfig(): void {
    // Get the catalog and destructure the services config.
    const catalog = this._getCatalog();
    const {services, fedramp} = this.webex.config;

    // Validate that the services configuration exists.
    if (services) {
      if (fedramp) {
        services.discovery = fedRampServices;
      }
      // Check for discovery services.
      if (services.discovery) {
        // Format the discovery configuration into an injectable array.
        const formattedDiscoveryServices = Object.keys(services.discovery).map((key) => ({
          name: key,
          defaultUrl: services.discovery[key],
        }));

        // Inject formatted discovery services into services catalog.
        catalog.updateServiceUrls('discovery', formattedDiscoveryServices);
      }

      if (services.override) {
        // Format the override configuration into an injectable array.
        const formattedOverrideServices = Object.keys(services.override).map((key) => ({
          name: key,
          defaultUrl: services.override[key],
        }));

        // Inject formatted override services into services catalog.
        catalog.updateServiceUrls('override', formattedOverrideServices);
      }

      // if not fedramp, append on the commercialAllowedDomains
      if (!fedramp) {
        services.allowedDomains = union(services.allowedDomains, COMMERCIAL_ALLOWED_DOMAINS);
      }

      // Check for allowed host domains.
      if (services.allowedDomains) {
        // Store the allowed domains as a property of the catalog.
        catalog.setAllowedDomains(services.allowedDomains);
      }

      // Set `validateDomains` property to match configuration
      this.validateDomains = services.validateDomains;
    }
  }

  /**
   * Make the initial requests to collect the root catalogs.
   *
   * @returns Promise that resolves when initialization is complete
   */
  initServiceCatalogs(): Promise<void> {
    this.logger.info('services: initializing initial service catalogs');

    // Destructure the credentials plugin.
    const {credentials} = this.webex;

    // Init a promise chain. Must be done as a Promise.resolve() to allow
    // credentials#getOrgId() to properly throw.
    return (
      Promise.resolve()
        // Get the user's OrgId.
        .then(() => credentials.getOrgId())
        // Begin collecting the preauth/limited catalog.
        .then((orgId: string) => this.collectPreauthCatalog({orgId}))
        .then(() => {
          // Validate if the token is authorized.
          if (credentials.canAuthorize) {
            // Attempt to collect the postauth catalog.
            return this.updateServices().catch(() => {
              this.initFailed = true;
              this.logger.warn('services: cannot retrieve postauth catalog');
            });
          }

          // Return a resolved promise for consistent return value.
          return Promise.resolve();
        })
    );
  }

  /**
   * Initializer
   *
   * @instance
   * @memberof Services
   * @returns Services instance
   */
  initialize(): this {
    const catalog = new ServiceCatalog();
    const registry = new ServiceRegistry();
    const state = new ServiceState();

    this._catalogs.set(this.webex, catalog);
    this.registries.set(this.webex, registry);
    this.states.set(this.webex, state);

    // Listen for configuration changes once.
    this.webex.once('change:config', () => {
      this.initConfig();
    });

    // wait for webex instance to be ready before attempting
    // to update the service catalogs
    this.webex.once('ready', () => {
      const {supertoken} = this.webex.credentials;
      // Validate if the supertoken exists.
      if (supertoken && supertoken.access_token) {
        this.initServiceCatalogs()
          .then(() => {
            catalog.isReady = true;
          })
          .catch((error: any) => {
            this.initFailed = true;
            this.logger.error(
              `services: failed to init initial services when credentials available, ${error?.message}`
            );
          });
      } else {
        const {email} = this.webex.config;

        this.collectPreauthCatalog(email ? {email} : undefined).catch((error: any) => {
          this.initFailed = true;
          this.logger.error(
            `services: failed to init initial services when no credentials available, ${error?.message}`
          );
        });
      }
    });

    return this;
  }
}

export default Services;
