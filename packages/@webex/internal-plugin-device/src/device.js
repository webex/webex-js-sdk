// Internal Dependencies
import {deprecated} from '@webex/common';
import {oneFlight} from '@webex/common';
import {persist, WebexPlugin} from '@webex/webex-core';
import {safeSetTimeout} from '@webex/common-timers';
import {orderBy} from 'lodash';
import uuid from 'uuid';

import METRICS from './metrics';
import {FEATURE_COLLECTION_NAMES, DEVICE_EVENT_REGISTRATION_SUCCESS} from './constants';
import FeaturesModel from './features/features-model';
import IpNetworkDetector from './ipNetworkDetector';
import {CatalogDetails} from './types';

/**
 * Determine if the plugin should be initialized based on cached storage.
 *
 * @returns {boolean} - If the device is ephemeral.
 */
function decider() {
  return !this.config.ephemeral;
}

class Device extends WebexPlugin {
  /**
   * Constructor for the Device plugin
   * @param {Object} attrs - Initial attributes
   * @param {Object} options - Plugin options
   */
  constructor(attrs = {}, options = {}) {
    super(attrs, options);

    // Plugin metadata
    this.namespace = 'Device';
    this.extraProperties = 'allow';
    this.idAttribute = 'url';

    // Initialize child models
    this.features = new FeaturesModel();
    this.ipNetworkDetector = new IpNetworkDetector();

    // Initialize properties
    this._initializeProperties(attrs);
  }

  /**
   * Initialize all device properties
   * @param {Object} attrs - Initial attributes
   * @private
   * @returns {void}
   */
  _initializeProperties(attrs = {}) {
    // Core device properties
    this.clientMessagingGiphy = attrs.clientMessagingGiphy || '';
    this.customerCompanyName = attrs.customerCompanyName || '';
    this.customerLogoUrl = attrs.customerLogoUrl || '';
    this.deviceType = attrs.deviceType || '';
    this.helpUrl = attrs.helpUrl || '';
    this.intranetInactivityDuration = attrs.intranetInactivityDuration || 0;
    this.intranetInactivityCheckUrl = attrs.intranetInactivityCheckUrl || '';
    this.inNetworkInactivityDuration = attrs.inNetworkInactivityDuration || 0;
    this.ecmEnabledForAllUsers = attrs.ecmEnabledForAllUsers || false;
    this.ecmSupportedStorageProviders = attrs.ecmSupportedStorageProviders || [];
    this.modificationTime = attrs.modificationTime || '';
    this.navigationBarColor = attrs.navigationBarColor || '';
    this.partnerCompanyName = attrs.partnerCompanyName || '';
    this.partnerLogoUrl = attrs.partnerLogoUrl || '';
    this.peopleInsightsEnabled = attrs.peopleInsightsEnabled || false;
    this.reportingSiteDesc = attrs.reportingSiteDesc || '';
    this.reportingSiteUrl = attrs.reportingSiteUrl || '';
    this.searchEncryptionKeyUrl = attrs.searchEncryptionKeyUrl || '';
    this.showSupportText = attrs.showSupportText || false;
    this.supportProviderCompanyName = attrs.supportProviderCompanyName || '';
    this.supportProviderLogoUrl = attrs.supportProviderLogoUrl || '';
    this.url = attrs.url || '';
    this.userId = attrs.userId || '';
    this.webFileShareControl = attrs.webFileShareControl || '';
    this.webSocketUrl = attrs.webSocketUrl || '';
    this.whiteboardFileShareControl = attrs.whiteboardFileShareControl || '';
    this.etag = attrs.etag || '';

    // Session properties
    this.logoutTimer = null;
    this.lastUserActivityDate = attrs.lastUserActivityDate || 0;
    this.isReachabilityChecked = attrs.isReachabilityChecked || false;
    this.energyForecastConfig = attrs.energyForecastConfig || false;
    this.isInMeeting = attrs.isInMeeting || false;
    this.isInNetwork = attrs.isInNetwork || false;
    this.refreshTimer = null;
  }

  /**
   * Get the registered state based on URL presence
   * @returns {boolean} - True if device is registered
   */
  get registered() {
    return !!this.url;
  }

  /**
   * Set method for updating properties (for compatibility)
   * Uses WebexState.set() to trigger change events for storage decorators
   * @param {Object|string} key - Property key or object of properties
   * @param {any} value - Property value (when key is string)
   * @param {Object} options - Set options
   * @returns {this}
   */
  set(key, value, options = {}) {
    if (typeof key === 'object') {
      // Set multiple properties using WebexState.set() for each
      Object.keys(key).forEach((prop) => {
        super.set(prop, key[prop]); // Use WebexState.set() to trigger change events
      });
    } else {
      // Set single property using WebexState.set()
      super.set(key, value); // Use WebexState.set() to trigger change events
    }

    return this;
  }

  /**
   * Get method for retrieving properties (for compatibility)
   * @param {string} key - Property key
   * @returns {any} - Property value
   */
  get(key) {
    return this[key];
  }

  /**
   * Unset method for removing properties (for compatibility)
   * @param {string} key - Property key
   * @param {Object} options - Unset options
   * @returns {this}
   */
  unset(key, options = {}) {
    delete this[key];

    if (!options.silent) {
      this.emit(`change:${key}`, this, undefined, options);
      this.emit('change', this, options);
    }

    return this;
  }

  /**
   * Serialize the device to JSON (for compatibility)
   * @returns {Object} - Serialized device data
   */
  serialize() {
    const data = {
      clientMessagingGiphy: this.clientMessagingGiphy,
      customerCompanyName: this.customerCompanyName,
      customerLogoUrl: this.customerLogoUrl,
      deviceType: this.deviceType,
      helpUrl: this.helpUrl,
      intranetInactivityDuration: this.intranetInactivityDuration,
      intranetInactivityCheckUrl: this.intranetInactivityCheckUrl,
      inNetworkInactivityDuration: this.inNetworkInactivityDuration,
      ecmEnabledForAllUsers: this.ecmEnabledForAllUsers,
      ecmSupportedStorageProviders: this.ecmSupportedStorageProviders,
      modificationTime: this.modificationTime,
      navigationBarColor: this.navigationBarColor,
      partnerCompanyName: this.partnerCompanyName,
      partnerLogoUrl: this.partnerLogoUrl,
      peopleInsightsEnabled: this.peopleInsightsEnabled,
      reportingSiteDesc: this.reportingSiteDesc,
      reportingSiteUrl: this.reportingSiteUrl,
      searchEncryptionKeyUrl: this.searchEncryptionKeyUrl,
      showSupportText: this.showSupportText,
      supportProviderCompanyName: this.supportProviderCompanyName,
      supportProviderLogoUrl: this.supportProviderLogoUrl,
      url: this.url,
      userId: this.userId,
      webFileShareControl: this.webFileShareControl,
      webSocketUrl: this.webSocketUrl,
      whiteboardFileShareControl: this.whiteboardFileShareControl,
    };

    // Only include features if they exist
    if (this.features) {
      data.features = this.features.serialize ? this.features.serialize() : this.features;
    }

    return data;
  }

  /**
   * Trigger method (for compatibility - maps to emit)
   * @param {string} event - Event name
   * @param {...any} args - Event arguments
   * @returns {boolean}
   */
  trigger(event, ...args) {
    return this.emit(event, ...args);
  }

  // Event method members.

  /**
   * Trigger meeting started event for webex instance. Used by web-client team.
   *
   * @returns {void}
   */
  meetingStarted() {
    this.webex.emit('meeting started');
  }

  /**
   * Trigger meeting ended event for webex instance. Used by web-client team.
   *
   * @returns {void}
   */
  meetingEnded() {
    this.webex.emit('meeting ended');
  }

  /**
   * Set the value of energy forecast config for the current registered device.
   * @param {boolean} [energyForecastConfig=false] - fetch an energy forecast on the next refresh/register
   * @returns {void}
   */
  setEnergyForecastConfig(energyForecastConfig = false) {
    this.energyForecastConfig = energyForecastConfig;
  }

  // Registration method members

  /**
   * Refresh the current registered device if able.
   *
   * @param {DeviceRegistrationOptions} deviceRegistrationOptions - The options for refresh.
   * @param {CatalogDetails} deviceRegistrationOptions.includeDetails - The details to include in the refresh/register request.
   * @returns {Promise<void, Error>}
   */
  @oneFlight()
  refresh(deviceRegistrationOptions = {}) {
    this.logger.info('device: refreshing');

    // Validate that the device can be registered.
    return this.canRegister().then(() => {
      // Validate if the device is not registered and register instead.
      if (!this.registered) {
        this.logger.info('device: device not registered, registering');

        return this.register(deviceRegistrationOptions);
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

      const {includeDetails = CatalogDetails.all} = deviceRegistrationOptions;

      const requestId = uuid.v4();
      this.set('refresh-request-id', requestId);

      return this.request({
        method: 'PUT',
        uri: this.url,
        body,
        headers,
        qs: {
          includeUpstreamServices: `${includeDetails}${
            this.config.energyForecast && this.energyForecastConfig ? ',energyforecast' : ''
          }`,
        },
      })
        .then((response) => {
          // If we've signed out in the mean time, the request ID will have changed
          if (this.get('refresh-request-id') !== requestId) {
            this.logger.info('device: refresh request ID mismatch, ignoring response');

            return Promise.resolve();
          }

          return this.processRegistrationSuccess(response);
        })
        .catch((reason) => {
          // Handle a 404 error, which indicates that the device is no longer
          // valid and needs to be registered as a new device.
          if (reason.statusCode === 404) {
            this.logger.info('device: refresh failed, device is not valid');
            this.logger.info('device: attempting to register a new device');

            this.clear();

            return this.register(deviceRegistrationOptions);
          }

          return Promise.reject(reason);
        });
    });
  }

  /**
   * Fetches the web devices and deletes the third of them which are not recent devices in use
   * @returns {Promise<void, Error>}
   */
  deleteDevices() {
    // Fetch devices with a GET request
    return this.request({
      method: 'GET',
      service: 'wdm',
      resource: 'devices',
    })
      .then((response) => {
        const {devices} = response.body;

        const {deviceType} = this._getBody();

        // Filter devices of type deviceType
        const webDevices = devices.filter((item) => item.deviceType === deviceType);

        const sortedDevices = orderBy(webDevices, [(item) => new Date(item.modificationTime)]);

        // If there are more than two devices, delete the last third
        if (sortedDevices.length > 2) {
          const totalItems = sortedDevices.length;
          const countToDelete = Math.ceil(totalItems / 3);
          const urlsToDelete = sortedDevices.slice(0, countToDelete).map((item) => item.url);

          return Promise.race(
            urlsToDelete.map((url) => {
              return this.request({
                uri: url,
                method: 'DELETE',
              });
            })
          );
        }

        return Promise.resolve();
      })
      .catch((error) => {
        this.logger.error('Failed to retrieve devices:', error);

        return Promise.reject(error);
      });
  }

  /**
   * Registers and when fails deletes devices
   * @param {Object} deviceRegistrationOptions - The options for registration
   * @returns {Promise<void, Error>}
   */
  register(deviceRegistrationOptions = {}) {
    this.logger.info('device: registering');

    this.webex.internal.newMetrics.callDiagnosticMetrics.setDeviceInfo(this);

    // Validate that the device can be registered.
    return this.canRegister().then(() => {
      // Validate if the device is already registered and refresh instead.
      if (this.registered) {
        this.logger.info('device: device already registered, refreshing');

        return this.refresh(deviceRegistrationOptions);
      }

      return this._registerInternal(deviceRegistrationOptions).catch((error) => {
        if (error?.body?.message === 'User has excessive device registrations') {
          return this.deleteDevices().then(() => {
            return this._registerInternal(deviceRegistrationOptions);
          });
        }
        throw error;
      });
    });
  }

  _getBody() {
    return {
      ...(this.config.defaults.body ? this.config.defaults.body : {}),
      ...(this.config.body ? this.config.body : {}),
    };
  }

  /**
   * Register or refresh a device depending on the current device state. Device
   * registration utilizes the services plugin to send the request to the
   * **WDM** service.
   *
   * @param {Object} deviceRegistrationOptions - The options for registration.
   * @param {CatalogDetails} deviceRegistrationOptions.includeDetails - The details to include in the refresh/register request.
   * @returns {Promise<void, Error>}
   */
  @oneFlight()
  _registerInternal(deviceRegistrationOptions = {}) {
    this.logger.info('device: making registration request');

    // Merge body configurations, overriding defaults.
    const body = this._getBody();

    // Merge header configurations, overriding defaults.
    const headers = {
      ...(this.config.defaults.headers ? this.config.defaults.headers : {}),
      ...(this.config.headers ? this.config.headers : {}),
    };

    // Append a ttl value if the device is marked as ephemeral
    if (this.config.ephemeral) {
      body.ttl = this.config.ephemeralDeviceTTL;
    }
    this.webex.internal.newMetrics.submitInternalEvent({
      name: 'internal.register.device.request',
    });

    const {includeDetails = CatalogDetails.all} = deviceRegistrationOptions;

    const requestId = uuid.v4();
    this.set('register-request-id', requestId);

    // This will be replaced by a `create()` method.
    return this.request({
      method: 'POST',
      service: 'wdm',
      resource: 'devices',
      body,
      headers,
      qs: {
        includeUpstreamServices: `${includeDetails}${
          this.config.energyForecast && this.energyForecastConfig ? ',energyforecast' : ''
        }`,
      },
    })
      .catch((error) => {
        this.webex.internal.newMetrics.submitInternalEvent({
          name: 'internal.register.device.response',
        });

        throw error;
      })
      .then((response) => {
        // If we've signed out in the mean time, the request ID will have changed
        if (this.get('register-request-id') !== requestId) {
          this.logger.info('device: register request ID mismatch, ignoring response');

          return Promise.resolve();
        }

        // Do not add any processing of response above this as that will affect timestamp
        this.webex.internal.newMetrics.submitInternalEvent({
          name: 'internal.register.device.response',
        });

        this.webex.internal.metrics.submitClientMetrics(METRICS.JS_SDK_WDM_REGISTRATION_SUCCESSFUL);

        return this.processRegistrationSuccess(response);
      })
      .catch((error) => {
        this.webex.internal.metrics.submitClientMetrics(METRICS.JS_SDK_WDM_REGISTRATION_FAILED, {
          fields: {error},
        });
        throw error;
      });
  }

  /**
   * Unregister the current registered device if available. Unregistering a
   * device utilizes the services plugin to send the request to the **WDM**
   * service.
   *
   * @returns {Promise<void, Error>}
   */
  @oneFlight()
  unregister() {
    this.logger.info('device: unregistering');

    if (!this.registered) {
      this.logger.warn('device: not registered');

      return Promise.resolve();
    }

    return this.request({
      uri: this.url,
      method: 'DELETE',
    })
      .then(() => this.clear())
      .catch((reason) => {
        if (reason.statusCode === 404) {
          this.logger.info(
            'device: 404 when deleting device, device is already deleted, clearing device'
          );

          this.clear();
        }
        throw reason;
      });
  }

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
  }

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
  }

  /**
   * Clears the registration ttl value if available.
   *
   * @param {Object} options - Values to be cleared.
   * @returns {void}
   */
  clear(...args) {
    this.logger.info('device: clearing registered device');

    // Clear timers
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = null;
    }

    // Reset all properties
    this._initializeProperties({});

    // Clear child models
    if (this.features && typeof this.features.clear === 'function') {
      this.features.clear();
    }

    if (this.ipNetworkDetector && typeof this.ipNetworkDetector.clear === 'function') {
      this.ipNetworkDetector.clear();
    }

    // Call parent clear method
    super.clear(...args);
  }

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
  }

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
      if (this.features && features) {
        if (this.features.user && typeof this.features.user.reset === 'function') {
          this.features.user.reset(features.user);
        }
        if (this.features.entitlement && typeof this.features.entitlement.reset === 'function') {
          this.features.entitlement.reset(features.entitlement);
        }
      }
    }

    // Handle features separately to preserve collection structure
    const {features, ...otherProps} = body;

    // Set other properties normally
    this.set(otherProps);

    // Properly handle features through the FeaturesModel to maintain collection structure
    if (features && this.features) {
      if (
        features.developer &&
        this.features.developer &&
        typeof this.features.developer.reset === 'function'
      ) {
        this.features.developer.reset(features.developer);
      }
      if (features.user && this.features.user && typeof this.features.user.reset === 'function') {
        this.features.user.reset(features.user);
      }
      if (
        features.entitlement &&
        this.features.entitlement &&
        typeof this.features.entitlement.reset === 'function'
      ) {
        this.features.entitlement.reset(features.entitlement);
      }
    }

    // Assign the new etag to this device.
    this.set({etag});

    // Validate if device is ephemeral and setup refresh timer.
    if (this.config.ephemeral) {
      this.logger.info('device: enqueuing device refresh');

      const delay = (this.config.ephemeralDeviceTTL / 2 + 60) * 1000;

      this.refreshTimer = safeSetTimeout(() => this.refresh(), delay);
    }

    // Emit the registration:success event.
    this.emit(DEVICE_EVENT_REGISTRATION_SUCCESS, this);
  }

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
    this.removeAllListeners('change:lastUserActivityDate');

    // Remove the logout timer.
    this.logoutTimer = null;

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
  }

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
  }

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
  }

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
  }

  /**
   * Initializer method for the device plugin.
   *
   * @override
   * @param {Array<any>} args - An array of items to be mapped as properties.
   * @returns {void}
   */
  @persist('@', decider)
  initialize(...args) {
    // Initialize feature events and listeners.
    FEATURE_COLLECTION_NAMES.forEach((collectionName) => {
      if (this.features && typeof this.features.on === 'function') {
        this.features.on(`change:${collectionName}`, (model, value, options) => {
          this.emit('change', this, options);
          this.emit('change:features', this, this.features, options);
        });
      }
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
    if (this.webex && typeof this.webex.on === 'function') {
      this.webex.on('user-activity', () => {
        this.lastUserActivityDate = Date.now();
        this.emit('change:lastUserActivityDate', this, this.lastUserActivityDate);
      });
      // Initialize listener for meeting started event.
      this.webex.on('meeting started', () => {
        this.isInMeeting = true;
        this.resetLogoutTimer();
      });
      // Initialize listener for meeting ended event.
      this.webex.on('meeting ended', () => {
        this.isInMeeting = false;
        this.resetLogoutTimer();
      });
    }
  }
}

export default Device;
