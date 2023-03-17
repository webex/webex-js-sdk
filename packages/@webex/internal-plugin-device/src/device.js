// Internal Dependencies
import {deprecated, oneFlight} from '@webex/common';
import {persist, waitForValue, WebexPlugin} from '@webex/webex-core';
import {safeSetTimeout} from '@webex/common-timers';

import METRICS from './metrics';
import {FEATURE_COLLECTION_NAMES, DEVICE_EVENT_REGISTRATION_SUCCESS} from './constants';
import FeaturesModel from './features/features-model';

/**
 * Determine if the plugin should be initialized based on cached storage.
 *
 * @returns {boolean} - If the device is ephemeral.
 */
function decider() {
  return !this.config.ephemeral;
}

const Device = WebexPlugin.extend({
  // Ampersand property members.

  namespace: 'Device',

  // Allow for extra properties to prevent the plugin from failing due to
  // **WDM** service DTO changes.
  extraProperties: 'allow',

  idAttribute: 'url',

  children: {
    /**
     * The class object that contains all of the feature collections.
     *
     * @type {FeaturesModel}
     */
    features: FeaturesModel,
  },

  /**
   * A collection of device properties mostly assigned by the retrieved DTO from
   * the **WDM** service that are mapped against the ampersand properties.
   *
   * @type {Object}
   */
  props: {
    /**
     * This property determines whether or not giphy support is enabled.
     *
     * @type {'ALLOW' | 'BLOCK'}
     */
    clientMessagingGiphy: 'string',

    /**
     * This property should store the company name.
     *
     * @type {string}
     */
    customerCompanyName: 'string',

    /**
     * This property should store the logo url.
     *
     * @type {string}
     */
    customerLogoUrl: 'string',

    /**
     * This property doesn't have any real values, but is sent during device
     * refresh to prevent the **wdm** service from falling back to an iOS device
     * type.
     *
     * @type {string}
     */
    deviceType: 'string',

    /**
     * This property should store the help url.
     *
     * @type {string}
     */
    helpUrl: 'string',

    /**
     * This property should store the intranet inactivity timer duration.
     *
     * @type {number}
     */
    intranetInactivityDuration: 'number',

    /**
     * This property stores the url required to validate if the device is able
     * to actively reach the intranet network.
     *
     * @type {string}
     */
    intranetInactivityCheckUrl: 'string',

    /**
     * This property stores the inactivity timer duration, and could possibly
     * deprecate the `intranetInactivityDuration` property.
     *
     * @type {number}
     */
    inNetworkInactivityDuration: 'number',

    /**
     * This property stores the ECM (external content management) enabled value
     * for the whole organization.
     *
     * @type {boolean}
     */
    ecmEnabledForAllUsers: ['boolean', false, false],

    /**
     * This property stores an array of ECM (external content management)
     * providers that are currently available.
     *
     * @returns {Array<string>}
     */
    ecmSupportedStorageProviders: ['array', false, () => []],

    /**
     * This property stores the modification time value retrieved from the
     * **WDM** endpoint formatted as ISO 8601.
     *
     * @type {string}
     */
    modificationTime: 'string',

    /**
     * This property stores the navigation bar color.
     *
     * @type {string}
     */
    navigationBarColor: 'string',

    /**
     * This property stores the partner company's name when available.
     *
     * @type {string}
     */
    partnerCompanyName: 'string',

    /**
     * This property stores the partner company's logo when available.
     *
     * @type {string}
     */
    partnerLogoUrl: 'string',

    /**
     * This property stores the availability of people data from the **WDM**
     * service.
     *
     * @type {boolean}
     */
    peopleInsightsEnabled: 'boolean',

    /**
     * This property stores the reporting site's description when available.
     *
     * @type {string}
     */
    reportingSiteDesc: 'string',

    /**
     * This property stores the reporting site's access url when available.
     *
     * @type {string}
     */
    reportingSiteUrl: 'string',

    /**
     * This property stores the encryption key url when available.
     *
     * @type {string}
     */
    searchEncryptionKeyUrl: 'string',

    /**
     * This property stores the availability of support-provided text from the
     * **WDM** service.
     *
     * @type {boolean}
     */
    showSupportText: 'boolean',

    /**
     * This property stores the support provider's company name when available.
     *
     * @type {string}
     */
    supportProviderCompanyName: 'string',

    /**
     * This property stores the support provider's logo url when available.
     *
     * @type {string}
     */
    supportProviderLogoUrl: 'string',

    /**
     * This property stores the device's url retrieved from a registration
     * request. This property gets set via the initial registration process by a
     * `this.set()` method.
     *
     * @type {string}
     */
    url: 'string',

    /**
     * This property stores the device's userId uuid value, which can also be
     * derived from the device's registerd user's userId retrieved from
     * the **Hydra** service.
     *
     * @type {string}
     */
    userId: 'string',

    /**
     * This property stores whether or not file sharing is enabled
     *
     * @type {'BLOCK_BOTH' | 'BLOCK_UPLOAD'}
     */
    webFileShareControl: 'string',

    /**
     * This property stores the current web socket url used by the registered
     * device.
     *
     * @type {string}
     */
    webSocketUrl: 'string',

    /**
     * This property stores the value indicating whether or not white board file
     * sharing is enabled for the current device.
     *
     * @type {'ALLOW' | 'BLOCK'}
     */
    whiteboardFileShareControl: 'string',
  },

  /**
   * A list of derived properties that populate based when their parent data
   * available via the device's properties.
   *
   * @type {Object}
   */
  derived: {
    /**
     * This property determines if the current device is registered.
     *
     * @type {boolean}
     */
    registered: {
      deps: ['url'],

      /**
       * Checks if the device is registered by validating that the url exists.
       * Amperstand does not allow this to method to be written as an arrow
       * function.
       *
       * @returns {boolean}
       */
      fn() {
        return !!this.url;
      },
    },
  },

  /**
   * Stores timer data as well as other state details.
   *
   * @type {Object}
   */
  session: {
    /**
     * This property stores the logout timer object
     *
     * @type {any}
     */
    logoutTimer: 'any',

    /**
     * This property stores the date for the last activity the user made
     * with the current device.
     *
     * @type {number}
     */
    lastUserActivityDate: 'number',

    /**
     * This property stores whether or not the reachability check has been
     * performed to prevent the reachability check from performing its
     * operation more than once after a successful check.
     *
     * @returns {boolean}
     */
    isReachabilityChecked: ['boolean', false, false],

    /**
     * This property stores whether or not the current device is in a meeting
     * to prevent an unneeded timeout of a meeting due to inactivity.
     *
     * @type {boolean}
     */
    isInMeeting: 'boolean',

    /**
     * This property identifies if the device is currently in network to prevent
     * the `resetLogoutTimer()` method from being called repeatedly once its
     * known client is connected to the organization's internal network.
     *
     * @type {boolean}
     */
    isInNetwork: 'boolean',
  },

  // Event method members.

  /**
   * Trigger meeting started event for webex instance. Used by web-client team.
   *
   * @returns {void}
   */
  meetingStarted() {
    this.webex.trigger('meeting started');
  },

  /**
   * Trigger meeting ended event for webex instance. Used by web-client team.
   *
   * @returns {void}
   */
  meetingEnded() {
    this.webex.trigger('meeting ended');
  },

  // Registration method members

  /* eslint-disable require-jsdoc */
  /**
   * Refresh the current registered device if able.
   *
   * @returns {Promise<void, Error>}
   */
  @oneFlight
  @waitForValue('@')
  refresh() {
    this.logger.info('device: refreshing');

    // Validate that the device can be registered.
    return this.canRegister().then(() => {
      // Validate if the device is not registered and register instead.
      if (!this.registered) {
        this.logger.info('device: device not registered, registering');

        return this.register();
      }

      // Merge body configurations, overriding defaults.
      const body = {
        ...this.serialize(),
        ...(this.config.body ? this.config.body : {}),
      };

      // Remove unneeded properties from the body object.
      delete body.features;
      delete body.mediaCluster;
      delete body.etag;

      // Append a ttl value if the device is marked as ephemeral.
      if (this.config.ephemeral) {
        body.ttl = this.config.ephemeralDeviceTTL;
      }

      // Merge header configurations, overriding defaults.
      const headers = {
        ...(this.config.defaults.headers ? this.config.defaults.headers : {}),
        ...(this.config.headers ? this.config.headers : {}),
        // If etag is sent, WDM will not send developer feature toggles unless they have changed
        ...(this.etag ? {'If-None-Match': this.etag} : {}),
      };

      return this.request({
        method: 'PUT',
        uri: this.url,
        body,
        headers,
      })
        .then((response) => this.processRegistrationSuccess(response))
        .catch((reason) => {
          // Handle a 404 error, which indicates that the device is no longer
          // valid and needs to be registered as a new device.
          if (reason.statusCode === 404) {
            this.logger.info('device: refresh failed, device is not valid');
            this.logger.info('device: attempting to register a new device');

            this.clear();

            return this.register();
          }

          return Promise.reject(reason);
        });
    });
  },

  /**
   * Register or refresh a device depending on the current device state. Device
   * registration utilizes the services plugin to send the request to the
   * **WDM** service.
   *
   * @returns {Promise<void, Error>}
   */
  @oneFlight
  @waitForValue('@')
  register() {
    this.logger.info('device: registering');

    // Validate that the device can be registered.
    return this.canRegister().then(() => {
      // Validate if the device is already registered and refresh instead.
      if (this.registered) {
        this.logger.info('device: device already registered, refreshing');

        return this.refresh();
      }

      // Merge body configurations, overriding defaults.
      const body = {
        ...(this.config.defaults.body ? this.config.defaults.body : {}),
        ...(this.config.body ? this.config.body : {}),
      };

      // Merge header configurations, overriding defaults.
      const headers = {
        ...(this.config.defaults.headers ? this.config.defaults.headers : {}),
        ...(this.config.headers ? this.config.headers : {}),
      };

      // Append a ttl value if the device is marked as ephemeral
      if (this.config.ephemeral) {
        body.ttl = this.config.ephemeralDeviceTTL;
      }

      // This will be replaced by a `create()` method.
      return this.request({
        method: 'POST',
        service: 'wdm',
        resource: 'devices',
        body,
        headers,
      })
        .then((response) => {
          this.webex.internal.metrics.submitClientMetrics(
            METRICS.JS_SDK_WDM_REGISTRATION_SUCCESSFUL
          );

          return this.processRegistrationSuccess(response);
        })
        .catch((error) => {
          this.webex.internal.metrics.submitClientMetrics(METRICS.JS_SDK_WDM_REGISTRATION_FAILED, {
            fields: {error},
          });
          throw error;
        });
    });
  },

  /**
   * Unregister the current registered device if available. Unregistering a
   * device utilizes the services plugin to send the request to the **WDM**
   * service.
   *
   * @returns {Promise<void, Error>}
   */
  @oneFlight
  @waitForValue('@')
  unregister() {
    this.logger.info('device: unregistering');

    if (!this.registered) {
      this.logger.warn('device: not registered');

      return Promise.resolve();
    }

    return this.request({
      uri: this.url,
      method: 'DELETE',
    }).then(() => this.clear());
  },
  /* eslint-enable require-jsdoc */

  // Helper method members

  /**
   * Determine if registration methods can be performed. This method utilizes
   * the `services` plugin to confirm if the appropriate service urls are
   * available for device registration.
   *
   * @returns {Promise<void, Error>}
   */
  canRegister() {
    this.logger.info('device: validating if registration can occur');

    // Destructure the services plugin for ease of reference.
    const {services} = this.webex.internal;

    // Wait for the postauth catalog to populate.
    return services.waitForCatalog('postauth', this.config.canRegisterWaitDuration).then(() =>
      // Validate that the service exists after waiting for the catalog.
      services.get('wdm')
        ? Promise.resolve()
        : Promise.reject(
            new Error(
              [
                'device: cannot register,',
                "'wdm' service is not available from the postauth catalog",
              ].join(' ')
            )
          )
    );
  },

  /**
   * Check if the device can currently reach the inactivity check url.
   *
   * @returns {Promise<void, Error>}
   */
  checkNetworkReachability() {
    this.logger.info('device: checking network reachability');

    // Validate if the device has been checked and reset the logout timer.
    if (this.isReachabilityChecked) {
      return Promise.resolve(this.resetLogoutTimer());
    }

    this.isReachabilityChecked = true;

    // Validate if the device has a intranet checking url.
    if (!this.intranetInactivityCheckUrl) {
      this.isInNetwork = false;

      return Promise.resolve(this.resetLogoutTimer());
    }

    // Clear unnecessary headers for reachability request.
    const headers = {
      'cisco-no-http-redirect': null,
      'spark-user-agent': null,
      trackingid: null,
    };

    // Send the network reachability request.
    return this.request({
      headers,
      method: 'GET',
      uri: this.intranetInactivityCheckUrl,
    })
      .then(() => {
        this.isInNetwork = true;

        return Promise.resolve(this.resetLogoutTimer());
      })
      .catch(() => {
        this.logger.info('device: did not reach ping endpoint');
        this.logger.info('device: triggering off-network timer');

        this.isInNetwork = false;

        return Promise.resolve(this.resetLogoutTimer());
      });
  },

  /**
   * Clears the registration ttl value if available.
   *
   * @param {Object} options - Values to be cleared.
   * @returns {void}
   */
  clear(...args) {
    this.logger.info('device: clearing registered device');

    // Prototype the extended class in order to preserve the parent member.
    Reflect.apply(WebexPlugin.prototype.clear, this, args);
  },

  /**
   * Get the current websocket url with the appropriate priority host.
   *
   * @param {boolean} [wait=false] - Willing to wait on a valid url.
   * @returns {Promise<string, Error>} - The priority-mapped web socket url.
   */
  getWebSocketUrl(wait = false) {
    this.logger.info('device: getting the current websocket url');

    // Destructure the services plugin for ease of reference.
    const {services} = this.webex.internal;

    // Validate if the method should wait for registration.
    if (wait) {
      return this.waitForRegistration()
        .then(() => services.convertUrlToPriorityHostUrl(this.webSocketUrl))
        .catch((error) => {
          this.logger.warn(error.message);

          return Promise.reject(new Error('device: failed to get the current websocket url'));
        });
    }

    // Validate if the device is registered.
    if (!this.registered) {
      return Promise.reject(
        new Error('device: cannot get websocket url, device is not registered')
      );
    }

    // Attempt to collect the priority-host-mapped web socket URL.
    const wsUrl = services.convertUrlToPriorityHostUrl(this.webSocketUrl);

    // Validate that the url was collected.
    if (wsUrl) {
      return Promise.resolve(wsUrl);
    }

    return Promise.reject(new Error('device: failed to get the current websocket url'));
  },

  /**
   * Process a successful device registration.
   *
   * @param {Object} response - response object from registration success.
   * @returns {void}
   */
  processRegistrationSuccess(response) {
    this.logger.info('device: received registration payload');

    // Clone the response body for service cleaning.
    const body = {...response.body};

    // Clean service data.
    delete body.services;
    delete body.serviceHostMap;

    const {etag} = response.headers || {};

    if (this.etag && etag && this.etag === etag) {
      // If current etag matches the previous one and we have sent
      // If-None-Match header the developer and entitlement feature
      // toggles will not be returned
      const {features} = body;

      delete body.features;
      // When using the etag feature cache, user and entitlement features are still returned
      this.features.user.reset(features.user);
      this.features.entitlement.reset(features.entitlement);
    }

    // Assign the recieved DTO from **WDM** to this device.
    this.set(body);

    // Assign the new etag to this device.
    this.set({etag});

    // Validate if device is ephemeral and setup refresh timer.
    if (this.config.ephemeral) {
      this.logger.info('device: enqueuing device refresh');

      const delay = (this.config.ephemeralDeviceTTL / 2 + 60) * 1000;

      this.refreshTimer = safeSetTimeout(() => this.refresh(), delay);
    }

    // Emit the registration:success event.
    this.trigger(DEVICE_EVENT_REGISTRATION_SUCCESS, this);
  },

  /**
   * Reset the current local logout timer for the registered device if
   * registered.
   *
   * @returns {void}
   */
  resetLogoutTimer() {
    this.logger.info('device: resetting logout timer');

    // Clear current logout timer.
    clearTimeout(this.logoutTimer);

    // Remove last activity date event listener.
    this.off('change:lastUserActivityDate');

    // Remove the logout timer.
    this.unset('logoutTimer');

    // Validate if the device is currently in a meeting and is configured to
    // required inactivity enforcement.
    if (
      !this.isInMeeting &&
      this.config.enableInactivityEnforcement &&
      this.isReachabilityChecked
    ) {
      if (this.isInNetwork) {
        this.setLogoutTimer(this.inNetworkInactivityDuration);
      } else {
        this.setLogoutTimer(this.intranetInactivityDuration);
      }
    }
  },

  /**
   * Set the value of the logout timer for the current registered device.
   *
   * @param {number} duration - Value in seconds of the new logout timer.
   * @returns {void}
   */
  setLogoutTimer(duration) {
    this.logger.info('device: setting logout timer');

    if (!duration || duration <= 0) {
      return;
    }

    // Setup user activity date event listener.
    this.on('change:lastUserActivityDate', () => {
      this.resetLogoutTimer();
    });

    // Initialize a new timer.
    this.logoutTimer = safeSetTimeout(() => {
      this.webex.logout();
    }, duration * 1000);
  },

  /**
   * Wait for the device to be registered.
   *
   * @param {number} [timeout=10] - The maximum duration to wait, in seconds.
   * @returns {Promise<void, Error>}
   */
  waitForRegistration(timeout = 10) {
    this.logger.info('device: waiting for registration');

    return new Promise((resolve, reject) => {
      if (this.registered) {
        resolve();
      }

      const timeoutTimer = safeSetTimeout(
        () => reject(new Error('device: timeout occured while waiting for registration')),
        timeout * 1000
      );

      this.once(DEVICE_EVENT_REGISTRATION_SUCCESS, () => {
        clearTimeout(timeoutTimer);
        resolve();
      });
    });
  },

  // Deprecated methods.

  /**
   * Mark a url as failed and get the next priority host url.
   *
   * @param {string} url - The url to mark as failed.
   * @returns {Promise<string>} - The next priority url.
   */
  @deprecated('device#markUrlFailedAndGetNew(): Use services#markFailedUrl()')
  markUrlFailedAndGetNew(url) {
    return Promise.resolve(this.webex.internal.services.markFailedUrl(url));
  },

  // Ampersand method members

  /* eslint-disable require-jsdoc */
  /**
   * Initializer method for the device plugin.
   *
   * @override
   * @param {Array<any>} args - An array of items to be mapped as properties.
   * @returns {void}
   */
  @persist('@', decider)
  initialize(...args) {
    // Prototype the extended class in order to preserve the parent member.
    Reflect.apply(WebexPlugin.prototype.initialize, this, args);

    // Initialize feature events and listeners.
    FEATURE_COLLECTION_NAMES.forEach((collectionName) => {
      this.features.on(`change:${collectionName}`, (model, value, options) => {
        this.trigger('change', this, options);
        this.trigger('change:features', this, this.features, options);
      });
    });

    // Initialize network reachability checking event for url change.
    this.on('change:intranetInactivityCheckUrl', () => {
      this.checkNetworkReachability();
    });

    // Initialize network reachability checking event for duration change.
    this.on('change:intranetInactivityDuration', () => {
      this.checkNetworkReachability();
    });

    // Initialize network reachability checking event for duration change.
    this.on('change:inNetworkInactivityDuration', () => {
      this.checkNetworkReachability();
    });

    // Initialize listener for activity checking.
    this.listenTo(this.webex, 'user-activity', () => {
      this.lastUserActivityDate = Date.now();
    });

    // Initialize listener for meeting started event.
    this.listenTo(this.webex, 'meeting started', () => {
      this.isInMeeting = true;
      this.resetLogoutTimer();
    });

    // Initialize listener for meeting ended event.
    this.listenTo(this.webex, 'meeting ended', () => {
      this.isInMeeting = false;
      this.resetLogoutTimer();
    });
  },
  /* eslint-enable require-jsdoc */
});

export default Device;
