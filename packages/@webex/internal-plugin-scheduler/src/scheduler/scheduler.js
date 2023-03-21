import {base64} from '@webex/common';
import {WebexPlugin} from '@webex/webex-core';

import CONSTANTS from './scheduler.constants';
import EncryptHelper from './scheduler.encrypt.helper';
import DecryptHelper from './scheduler.decrypt.helper';

/**
 * Scheduler WebexPlugin class.
 */
const Scheduler = WebexPlugin.extend({
  /**
   * Namespace, or key, to register a `Scheduler` class object to within the
   * `webex.internal` object. Note that only one instance of this class can be
   * used against a single `webex` class instance.
   */
  namespace: CONSTANTS.NAMESPACE,

  /**
   * registered value indicating events registration is successful
   * @instance
   * @type {Boolean}
   * @memberof Calendar
   */
  registered: false,

  /**
   * Cache all rpc event request locally
   * */
  rpcEventRequests: [],

  /**
   * WebexPlugin initialize method. This triggers once Webex has completed its
   * initialization workflow.
   *
   * If the plugin is meant to perform startup actions, place them in this
   * `initialize()` method instead of the `constructor()` method.
   * @returns {void}
   */
  initialize() {
    // Used to perform actions based on the provided configuration object once
    // the configuration object is ready.
    this.listenToOnce(this.webex, 'change:config', () => {
      /* ...perform actions once the configuration object is mounted... */
    });
    // Used to perform actions after webex is fully qualified and ready for
    // operation.
    this.listenToOnce(this.webex, 'ready', () => {
      /* ...perform actions once the webex object is fully qualified... */
      this.register()
        .then(() => {
          this.logger.log('webex.internal.scheduler - register successfully.');
        })
        .catch((error) => {
          this.logger.log('webex.internal.scheduler - register failed: {}', error);
        });
    });
  },

  /**
   * Explicitly sets up the scheduler plugin by registering
   * the device, connecting to mercury, and listening for calendar events.
   * @returns {Promise}
   * @public
   * @memberof Calendar
   */
  register() {
    if (!this.webex.canAuthorize) {
      this.logger.error(
        'internal-plugin-scheduler -> register#ERROR, unable to register, SDK cannot authorize'
      );

      return Promise.reject(new Error('SDK cannot authorize'));
    }

    if (this.registered) {
      this.logger.info('internal-plugin-scheduler -> register#INFO, plugin already registered');

      return Promise.resolve();
    }

    return this.webex.internal.device
      .register()
      .then(() => this.webex.internal.mercury.connect())
      .then(() => {
        this.listenForEvents();
        this.trigger(CONSTANTS.SCHEDULER_REGISTERED);
        this.registered = true;
      })
      .catch((error) => {
        this.logger.error(
          `internal-plugin-scheduler -> register#ERROR, Unable to register, ${error.message}`
        );

        return Promise.reject(error);
      });
  },

  /**
   * Explicitly tears down the scheduler plugin by unregister
   * the device, disconnecting from mercury, and stops listening to calendar events
   *
   * @returns {Promise}
   * @public
   * @memberof Calendar
   */
  unregister() {
    if (!this.registered) {
      this.logger.info(
        'internal-plugin-scheduler -> unregister#INFO, Calendar plugin already unregistered'
      );

      return Promise.resolve();
    }

    this.stopListeningForEvents();

    return this.webex.internal.mercury
      .disconnect()
      .then(() => this.webex.internal.device.unregister())
      .then(() => {
        this.trigger(CONSTANTS.SCHEDULER_UNREGISTERED);
        this.registered = false;
      });
  },

  /**
   * registers for calendar events through mercury
   * @returns {undefined}
   * @private
   */
  listenForEvents() {
    // Calendar mercury events listener
    this.webex.internal.mercury.on('event:calendar.free_busy', (envelope) => {
      this._handleFreeBusy(envelope.data);
    });
  },

  /**
   * unregisteres all the calendar events from mercury
   * @returns {undefined}
   * @private
   */
  stopListeningForEvents() {
    this.webex.internal.mercury.off('event:calendar.free_busy');
  },

  /**
   * handles freebusy events, do we need to cache it in memory?
   * @param {Object} data
   * @returns {undefined}
   * @private
   */
  _handleFreeBusy(data) {
    DecryptHelper.decryptFreeBusyResponse(this, data).then(() => {
      let response = {};
      if (data && data.calendarFreeBusyScheduleResponse) {
        response = data.calendarFreeBusyScheduleResponse;
      }
      if (response && response.requestId && response.requestId in this.rpcEventRequests) {
        this.logger.log(
          `webex.internal.scheduler - receive requests, requestId: ${response.requestId}`
        );
        delete response.encryptionKeyUrl;
        const {resolve} = this.rpcEventRequests[response.requestId];
        resolve(response);
        delete this.rpcEventRequests[response.requestId];
      } else {
        this.logger.log('webex.internal.scheduler - receive other requests.');
      }
    });
  },

  /**
   * Create calendar event
   * @param {object} [data] meeting payload data
   * @returns {Promise} Resolves with creating calendar event response
   * */
  createCalendarEvent(data) {
    return EncryptHelper.encryptCalendarEventRequest(this, data).then(() => {
      return this.request({
        method: 'POST',
        service: 'calendar',
        body: data,
        resource: 'calendarEvents/sync',
      });
    });
  },

  /**
   * Update calendar event
   * @param {string} [id] calendar event id
   * @param {object} [data] meeting payload data
   * @param {object} [query] the query parameters for specific usage
   * @returns {Promise} Resolves with updating calendar event response
   * */
  updateCalendarEvent(id, data, query) {
    return EncryptHelper.encryptCalendarEventRequest(this, data).then(() => {
      return this.request({
        method: 'PATCH',
        service: 'calendar',
        body: data,
        resource: `calendarEvents/${base64.encode(id)}/sync`,
        qs: query || {},
      });
    });
  },

  /**
   * Delete calendar event
   * @param {string} [id] calendar event id
   * @returns {Promise} Resolves with deleting calendar event response
   * */
  deleteCalendarEvent(id) {
    return this.request({
      method: 'DELETE',
      service: 'calendar',
      resource: `calendarEvents/${base64.encode(id)}/sync`,
    });
  },

  /**
   * @typedef QuerySchedulerDataOptions
   * @param {string} [siteName] it is site full url, must have. Example: ccctest.dmz.webex.com
   * @param {string} [id] it is seriesOrOccurrenceId. If present, the series/occurrence meeting ID to fetch data for. It should be base64 encoded.
   *                      Example: 040000008200E00074C5B7101A82E008000000004A99F11A0841D9010000000000000000100000009EE499D4A71C1A46B51494C70EC7BFE5
   * @param {string} [clientMeetingId] If present, the client meeting UUID to fetch data for. It should be base64 encoded.
   *                      Example: 7f318aa9-887c-6e94-802a-8dc8e6eb1a0a
   * @param {string} [scheduleTemplateId] it template id.
   * @param {string} [sessionTypeId] it session type id.
   * @param {string} [organizerCIUserId] required in schedule-on-behalf case. It is the organizer's CI UUID.
   * @param {boolean} [usmPreference]
   * @param {string} [webexMeetingId] webex side meeting UUID
   * @param {string} [eventId] event ID.
   * @param {string} [icalUid] icalendar UUID.
   * @param {string} [thirdPartyType] third part type, such as: Microsoft
   */
  /**
   * Get scheduler data from calendar service
   * @param {QuerySchedulerDataOptions} [query] the command parameters for fetching scheduler data.
   * @returns {Promise} Resolves with a decrypted scheduler data
   * */
  getSchedulerData(query) {
    return this.request({
      method: 'GET',
      service: 'calendar',
      resource: 'schedulerData',
      qs: query || {},
    }).then((response) => {
      // internal-plugin-calendar's transformer cover it, it will cause ours failed.
      // So currently, I have to comment out 3 internal-plugin-calendar's transformers in local running.
      return DecryptHelper.decryptSchedulerDataResponse(this, response.body).then(() => {
        delete response.body.encryptionKeyUrl;

        return response;
      });
    });
  },

  /**
   * Get free busy status from calendar service
   * @param {Object} [data] the command parameters for fetching free busy status.
   * @returns {Promise} Resolves with a decrypted response
   * */
  getFreeBusy(data) {
    return new Promise((resolve, reject) => {
      EncryptHelper.encryptFreeBusyRequest(this, data)
        .then(() => {
          this.request({
            method: 'POST',
            service: 'calendar',
            body: data,
            resource: 'freebusy',
          })
            .then(() => {
              this.rpcEventRequests[data.requestId] = {resolve, reject};
            })
            .catch((error) => {
              reject(error);
            });
        })
        .catch((error) => {
          reject(error);
        });
    });
  },
});

export default Scheduler;
