import sha256 from 'crypto-js/sha256';

import {union, unionBy} from 'lodash';
import WebexPlugin from '../webex-plugin';

import METRICS from '../metrics';
import ServiceCatalog from './service-catalog';
import fedRampServices from './service-fed-ramp';
import {COMMERCIAL_ALLOWED_DOMAINS} from '../constants';
import {
  ActiveServices,
  IServiceCatalog,
  QueryOptions,
  Service,
  ServiceHostmap,
  ServiceGroup,
} from './types';

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
  query?: QueryOptions & {mode?: string; emailhash?: string};
  token?: string;
  forceRefresh?: boolean;
}

/**
 * Interface for fetch new service hostmap parameters
 */
interface FetchNewServiceHostmapParams {
  from?: string;
  query?: QueryOptions & {mode?: string; emailhash?: string};
  token?: string;
  forceRefresh?: boolean;
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
 * Services V2 plugin class for managing Webex service discovery and catalogs
 * @class Services
 * @extends WebexPlugin
 */
class Services extends WebexPlugin {
  namespace = 'Services';

  validateDomains = true;
  initFailed = false;

  private _catalogs = new WeakMap();
  private _activeServices: ActiveServices = {};
  private _services: Service[] = [];

  /**
   * Constructor for Services plugin
   * @param attrs - Initial attributes
   * @param options - Plugin options
   */
  constructor(attrs: any, options: any) {
    super(attrs, options);
  }

  /**
   * @private
   * Get the current catalog based on the associated
   * webex instance.
   * @returns {IServiceCatalog}
   */
  private _getCatalog(): IServiceCatalog {
    return this._catalogs.get(this.webex);
  }

  /**
   * Get a service url from the current services list by name
   * from the associated instance catalog.
   * @param name - Service name
   * @param serviceGroup - Service group
   * @returns Service URL or undefined
   */
  get(name: string, serviceGroup?: ServiceGroup): string | undefined {
    const catalog = this._getCatalog();

    const clusterId = this._activeServices[name];

    const urlById = catalog.get(clusterId, serviceGroup);
    const urlByName = catalog.get(name, serviceGroup);

    // if both are undefined, then we cannot find the service
    if (!urlById && !urlByName) {
      return undefined;
    }

    return urlById || urlByName;
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
   * Mark a priority host service url as failed.
   * This will mark the service url associated with the
   * `ServiceDetail` to be removed from the its
   * respective service url array, and then return the next
   * viable service url from the `ServiceDetail` service url array.
   * @param url - URL to mark as failed
   * @returns Next available URL
   */
  markFailedUrl(url: string): string | undefined {
    const catalog = this._getCatalog();

    return catalog.markFailedServiceUrl(url);
  }

  /**
   * saves all the services from the pre and post catalog service
   * @param activeServices - Active services to update
   */
  private _updateActiveServices(activeServices: ActiveServices): void {
    this._activeServices = {...this._activeServices, ...activeServices};
  }

  /**
   * saves the hostCatalog object
   * @param services - Services to update
   */
  private _updateServices(services: Service[]): void {
    this._services = unionBy(services, this._services, 'id');
  }

  /**
   * Update a list of `serviceUrls` to the most current
   * catalog via the defined `discoveryUrl` then returns the current
   * list of services.
   * @param params - Update parameters
   * @returns Promise resolving to updated services
   */
  updateServices(params: UpdateServicesParams = {}): Promise<object> {
    const {from, query, token, forceRefresh} = params;
    const catalog = this._getCatalog();
    let formattedQuery: QueryOptions | undefined;
    let serviceGroup: ServiceGroup;

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
      .then((serviceHostMap: ServiceHostmap) => {
        catalog.updateServiceGroups(serviceGroup, serviceHostMap);
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
          const idbrokerService = this.get('idbroker');

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
  updateCatalog(serviceGroup: ServiceGroup, hostMap: ServiceHostmap): Promise<void> {
    const catalog = this._getCatalog();

    const serviceHostMap = this._formatReceivedHostmap(hostMap);

    return catalog.updateServiceGroups(serviceGroup, serviceHostMap);
  }

  /**
   * simplified method to update the preauth catalog via email
   *
   * @param query - Query parameters
   * @param forceRefresh - Boolean to bypass u2c cache control header
   * @returns Promise resolving when complete
   */
  collectPreauthCatalog(query?: QueryOptions, forceRefresh = false): Promise<void> {
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
    const idbrokerUrl = this.get('idbroker');
    const identityUrl = this.get('identity');

    if (idbrokerUrl && identityUrl) {
      const {authorizationString, authorizeUrl} = this.webex.config.credentials;

      // This must be set outside of the setConfig method used to assign the
      // idbroker and identity url values.
      this.webex.config.credentials.authorizeUrl = authorizationString
        ? authorizeUrl
        : `${idbrokerUrl.replace(trailingSlashes, '')}/idb/oauth2/v1/authorize`;

      this.webex.setConfig({
        credentials: {
          idbroker: {
            url: idbrokerUrl.replace(trailingSlashes, ''), // remove trailing slash
          },
          identity: {
            url: identityUrl.replace(trailingSlashes, ''), // remove trailing slash
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
  waitForCatalog(serviceGroup: ServiceGroup, timeout?: number): Promise<void> {
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
      const clusterId = this._activeServices[name!];

      return Promise.resolve(this.get(clusterId));
    }

    const priorityUrl = this.get(name!);
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
      const checkCatalog = (catalogGroup: ServiceGroup) =>
        catalog
          .waitForCatalog(catalogGroup, timeout)
          .then(() => {
            const scopedPriorityUrl = this.get(name!);
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
    try {
      return this.convertUrlToPriorityHostUrl(uri);
    } catch {
      return uri;
    }
  }

  /**
   * Formats a host map entry for use in service catalog.
   *
   * @param entry - The host map entry to format.
   * @returns The formatted host map entry.
   */
  private _formatHostMapEntry(entry: {id: string; serviceName: string; serviceUrls: any[]}): any {
    const {id, serviceName, serviceUrls} = entry;
    const formattedServiceUrls = serviceUrls.map((serviceUrl) => ({
      host: new URL(serviceUrl.baseUrl).host,
      ...serviceUrl,
    }));

    return {
      id,
      serviceName,
      serviceUrls: formattedServiceUrls,
    };
  }

  /**
   * @private
   * Organize a received hostmap from a service
   * catalog endpoint.
   * @param serviceHostmap - Service hostmap
   * @returns Formatted hostmap
   */
  private _formatReceivedHostmap(serviceHostmap: {
    services: Service[];
    activeServices: ActiveServices;
  }): Service[] {
    const {services, activeServices} = serviceHostmap;
    const formattedHostmap = services.map((service) => this._formatHostMapEntry(service));
    this._updateActiveServices(activeServices);
    this._updateServices(services);

    return formattedHostmap;
  }

  /**
   * Get the clusterId associated with a URL string.
   * @param url - URL to check
   * @returns Cluster ID of url provided
   */
  getClusterId(url: string): string | undefined {
    const catalog = this._getCatalog();

    return catalog.findClusterId(url);
  }

  /**
   * Get a service value from a provided clusterId. This method will
   * return an object containing both the name and url of a found service.
   * @param params - Parameters
   * @returns Service object
   */
  getServiceFromClusterId(params: {
    clusterId: string;
    serviceGroup?: ServiceGroup;
  }): {name: string; url: string} | undefined {
    const catalog = this._getCatalog();

    return catalog.findServiceFromClusterId(params);
  }

  /**
   * Get service URL from cluster ID
   * @param params - Parameters containing cluster info
   * @returns URL of the service
   */
  getServiceUrlFromClusterId(params: {cluster?: string} = {}): string {
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
    const service = this._getCatalog().findServiceDetailFromUrl(url);

    if (!service) {
      return undefined;
    }

    const priorityUrl = service.get();
    const defaultUrl = new URL(
      service.serviceUrls.find((serviceUrl: any) => url.startsWith(serviceUrl.baseUrl)).baseUrl
    ).href;

    return {
      name: service.serviceName,
      priorityUrl,
      defaultUrl,
    };
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
  private _fetchNewServiceHostmap(params: FetchNewServiceHostmapParams = {}): Promise<object> {
    const {from, query, token, forceRefresh} = params;
    const service = 'u2c';
    const resource = from ? `/${from}/catalog` : '/catalog';
    const qs: Record<string, any> = {...(query || {}), format: 'U2CV2'};

    if (forceRefresh) {
      qs.timestamp = new Date().getTime();
    }

    const requestObject: any = {
      method: 'GET',
      service,
      resource,
      qs,
      headers: {},
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
        const formattedDiscoveryServices = Object.keys(services.discovery).map((key) =>
          this._formatHostMapEntry({
            id: key,
            serviceName: key,
            serviceUrls: [{baseUrl: services.discovery[key], priority: 1}],
          })
        );

        // Inject formatted discovery services into services catalog.
        catalog.updateServiceGroups('discovery', formattedDiscoveryServices);
      }

      if (services.override) {
        // Format the override configuration into an injectable array.
        const formattedOverrideServices = Object.keys(services.override).map((key) =>
          this._formatHostMapEntry({
            id: key,
            serviceName: key,
            serviceUrls: [{baseUrl: services.override[key], priority: 1}],
          })
        );

        // Inject formatted override services into services catalog.
        catalog.updateServiceGroups('override', formattedOverrideServices);
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
            return this.updateServices().catch((error) => {
              this.initFailed = true;
              this.logger.warn(`services: cannot retrieve postauth catalog, ${error?.message}`);
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
    this._catalogs.set(this.webex, catalog);

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
