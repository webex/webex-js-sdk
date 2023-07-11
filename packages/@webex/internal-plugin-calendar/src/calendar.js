/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * Calendar Item Create Event
 * Emitted when a calendar item has been added
 * @event calendar:meeting:create
 * @instance
 * @memberof Calendar
 */

/**
 * Calendar Item Update Event
 * Emitted when a calendar item has been updated
 * @event calendar:meeting:update
 * @instance
 * @memberof Calendar
 */

/**
 * Calendar Item Update Event
 * Emitted when a calendar item has been deleted
 * @event calendar:meeting:delete
 * @instance
 * @memberof Calendar
 */

/**
 * Calendar Registered Event
 * Emitted when the calendar instance has been registered and listening
 * @event calendar:registered
 * @instance
 * @memberof Calendar
 */

/**
 * Calendar Registered Event
 * Emitted when the calendar instance has been registered and listening
 * @event calendar:unregistered
 * @instance
 * @memberof Calendar
 */
import {isArray} from 'lodash';
import {base64} from '@webex/common';
import {WebexPlugin} from '@webex/webex-core';

import CalendarCollection from './collection';
import {
  CALENDAR_REGISTERED,
  CALENDAR_UNREGISTERED,
  CALENDAR_DELETE,
  CALENDAR_CREATE,
  CALENDAR_UPDATED,
} from './constants';

import EncryptHelper from './calendar.encrypt.helper';
import DecryptHelper from './calendar.decrypt.helper';

const Calendar = WebexPlugin.extend({
  namespace: 'Calendar',

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
   * Cache KMS encryptionKeyUrl
   * */
  encryptionKeyUrl: null,

  /**
   * WebexPlugin initialize method. This triggers once Webex has completed its
   * initialization workflow.
   *
   * If the plugin is meant to perform startup actions, place them in this
   * `initialize()` method instead of the `constructor()` method.
   * @returns {void}
   */
  initialize() {
    // Used to perform actions after webex is fully qualified and ready for
    // operation.
    this.listenToOnce(this.webex, 'ready', () => {
      // Pre-fetch a KMS encryption key url to improve performance
      this.webex.internal.encryption.kms.createUnboundKeys({count: 1}).then((keys) => {
        const key = isArray(keys) ? keys[0] : keys;
        this.encryptionKeyUrl = key ? key.uri : null;
        this.logger.info('calendar->bind a KMS encryption key url');
        this.webex.internal.encryption
          .getKey(this.encryptionKeyUrl, {onBehalfOf: null})
          .then((retrievedKey) => {
            this.encryptionKeyUrl = retrievedKey ? retrievedKey.uri : null;
            this.logger.info('calendar->retrieve the KMS encryption key url and cache it');
          });
      });
    });
  },

  /**
   * Explicitly sets up the calendar plugin by registering
   * the device, connecting to mercury, and listening for calendar events.
   * @returns {Promise}
   * @public
   * @memberof Calendar
   */
  register() {
    if (!this.webex.canAuthorize) {
      this.logger.error('calendar->register#ERROR, Unable to register, SDK cannot authorize');

      return Promise.reject(new Error('SDK cannot authorize'));
    }

    if (this.registered) {
      this.logger.info('calendar->register#INFO, Calendar plugin already registered');

      return Promise.resolve();
    }

    return this.webex.internal.device
      .register()
      .then(() => this.webex.internal.mercury.connect())
      .then(() => {
        this.listenForEvents();
        this.trigger(CALENDAR_REGISTERED);
        this.registered = true;
      })
      .catch((error) => {
        this.logger.error(`calendar->register#ERROR, Unable to register, ${error.message}`);

        return Promise.reject(error);
      });
  },

  /**
   * Explicitly tears down the calendar plugin by deregistering
   * the device, disconnecting from mercury, and stops listening to calendar events
   *
   * @returns {Promise}
   * @public
   * @memberof Calendar
   */
  unregister() {
    if (!this.registered) {
      this.logger.info('calendar->unregister#INFO, Calendar plugin already unregistered');

      return Promise.resolve();
    }

    this.stopListeningForEvents();

    return this.webex.internal.mercury
      .disconnect()
      .then(() => this.webex.internal.device.unregister())
      .then(() => {
        this.trigger(CALENDAR_UNREGISTERED);
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
    this.webex.internal.mercury.on('event:calendar.meeting.create', (envelope) => {
      this._handleCreate(envelope.data);
    });
    this.webex.internal.mercury.on('event:calendar.meeting.update', (envelope) => {
      this._handleUpdate(envelope.data);
    });
    this.webex.internal.mercury.on('event:calendar.meeting.create.minimal', (envelope) => {
      this._handleCreate(envelope.data);
    });
    this.webex.internal.mercury.on('event:calendar.meeting.update.minimal', (envelope) => {
      this._handleUpdate(envelope.data);
    });
    this.webex.internal.mercury.on('event:calendar.meeting.delete', (envelope) => {
      this._handleDelete(envelope.data);
    });
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
    this.webex.internal.mercury.off('event:calendar.meeting.create');
    this.webex.internal.mercury.off('event:calendar.meeting.create.minimal');
    this.webex.internal.mercury.off('event:calendar.meeting.update');
    this.webex.internal.mercury.off('event:calendar.meeting.update.minimal');
    this.webex.internal.mercury.off('event:calendar.meeting.delete');
    this.webex.internal.mercury.off('event:calendar.free_busy');
  },

  /**
   * handles update events, triggers after collection updates
   * @param {Object} data
   * @returns {undefined}
   * @private
   */
  _handleUpdate(data) {
    const id = CalendarCollection.set(data.calendarMeetingExternal);

    this.trigger(CALENDAR_UPDATED, CalendarCollection.get(id));
  },

  /**
   * handles create events, triggers after collection updates
   * @param {Object} data
   * @returns {undefined}
   * @private
   */
  _handleCreate(data) {
    const id = CalendarCollection.set(data.calendarMeetingExternal);

    this.trigger(CALENDAR_CREATE, CalendarCollection.get(id));
  },

  /**
   * handles delete events, triggers after collection updates
   * @param {Object} data
   * @returns {undefined}
   * @private
   */
  _handleDelete(data) {
    const item = CalendarCollection.remove(data.calendarMeetingExternal.id);

    this.trigger(CALENDAR_DELETE, item);
  },

  /**
   * handles free_busy events
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
          `webex.internal.calendar - receive requests, requestId: ${response.requestId}`
        );
        delete response.encryptionKeyUrl;
        const {resolve} = this.rpcEventRequests[response.requestId];
        resolve(response);
        delete this.rpcEventRequests[response.requestId];
      } else {
        this.logger.log('webex.internal.calendar - receive other requests.');
      }
    });
  },

  /**
   * Retrieves a collection of calendars based on the request parameters
   * Defaults to 1 day before and 7 days ahead
   * @param {Object} options
   * @param {Date} options.fromDate the start of the time range
   * @param {Date} options.toDate the end of the time range
   * @returns {Promise} Resolves with an array of calendars
   */
  syncCalendar(options = {fromDate: this.config.fromDate, toDate: this.config.toDate}) {
    return this.list({fromDate: options.fromDate, toDate: options.toDate}).then((res) => {
      CalendarCollection.setAll(res);

      return CalendarCollection.getAll();
    });
  },
  /**
   * get the calendar item that has a matching value
   * @param {String} key meeting property
   * @param {Any} value the meeting property to match
   * @returns {Object}
   */
  getByType(key, value) {
    if (['spaceURI', 'spaceMeetURL', 'conversationId'].includes(key)) {
      return CalendarCollection.getBy(key, value);
    }
    throw new Error('key must be one of, spaceURI, spaceMeetURL, or conversationId');
  },

  /**
   * gets all the calendar items that have been populated
   * @returns {Object}
   */
  getAll() {
    return CalendarCollection.getAll();
  },

  /**
   * Decrypts an encrypted incoming calendar event
   * @param {Object} event
   * @returns {Promise} Resolves with a decrypted calendar event
   */
  processMeetingEvent(event) {
    return this.webex.transform('inbound', event).then(() => event);
  },

  /**
   * Retrieves an array of meeting participants for the meeting id
   * @param {String} id
   * @returns {Promise} Resolves with an object of meeting participants
   */
  getParticipants(id) {
    return this.request({
      method: 'GET',
      service: 'calendar',
      resource: `calendarEvents/${base64.encode(id)}/participants`,
    });
  },

  /**
   * Retrieves a collection of meetings based on the request parameters
   * @param {String} id
   * @returns {Promise} Resolves with an object of meeting notes
   */
  getNotes(id) {
    return this.request({
      method: 'GET',
      service: 'calendar',
      resource: `calendarEvents/${base64.encode(id)}/notes`,
    });
  },

  /**
   * Retrieves a collection of meetings based on the request parameters
   * @param {Object} options
   * @param {Date} options.fromDate the start of the time range
   * @param {Date} options.toDate the end of the time range
   * @returns {Promise} Resolves with an array of meetings
   */
  list(options) {
    options = options || {};

    return this.webex
      .request({
        method: 'GET',
        service: 'calendar',
        resource: 'calendarEvents',
        qs: options,
      })
      .then((res) => {
        const meetingObjects = res.body.items;
        const promises = [];

        meetingObjects.forEach((meeting) => {
          if (!meeting.encryptedParticipants) {
            promises.push(
              this.getParticipants(meeting.id).then((notesResponse) => {
                meeting.encryptedParticipants = notesResponse.body.encryptedParticipants;
              })
            );
          }
        });

        return Promise.all(promises).then(() => meetingObjects);
      });
  },

  /**
   * Create calendar event
   * @param {object} [data] meeting payload data
   * @param {object} [query] the query parameters for specific usage
   * @returns {Promise} Resolves with creating calendar event response
   * */
  createCalendarEvent(data, query) {
    return EncryptHelper.encryptCalendarEventRequest(this, data).then(() =>
      this.request({
        method: 'POST',
        service: 'calendar',
        body: data,
        resource: 'calendarEvents/sync',
        qs: query || {},
      })
    );
  },

  /**
   * Update calendar event
   * @param {string} [id] calendar event id
   * @param {object} [data] meeting payload data
   * @param {object} [query] the query parameters for specific usage
   * @returns {Promise} Resolves with updating calendar event response
   * */
  updateCalendarEvent(id, data, query) {
    return EncryptHelper.encryptCalendarEventRequest(this, data).then(() =>
      this.request({
        method: 'PATCH',
        service: 'calendar',
        body: data,
        resource: `calendarEvents/${base64.encode(id)}/sync`,
        qs: query || {},
      })
    );
  },

  /**
   * Delete calendar event
   * @param {string} [id] calendar event id
   * @param {object} [query] the query parameters for specific usage
   * @returns {Promise} Resolves with deleting calendar event response
   * */
  deleteCalendarEvent(id, query) {
    return this.request({
      method: 'DELETE',
      service: 'calendar',
      resource: `calendarEvents/${base64.encode(id)}/sync`,
      qs: query || {},
    });
  },

  /**
   * @typedef QuerySchedulerDataOptions
   * @param {string} [siteName] it is site full url, must have. Example: ccctest.dmz.webex.com
   * @param {string} [id] it is seriesOrOccurrenceId. If present, the series/occurrence meeting ID to fetch data for.
   *                      Example: 040000008200E00074C5B7101A82E008000000004A99F11A0841D9010000000000000000100000009EE499D4A71C1A46B51494C70EC7BFE5
   * @param {string} [clientMeetingId] If present, the client meeting UUID to fetch data for.
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
      return DecryptHelper.decryptSchedulerDataResponse(this, response.body).then(() => response);
    });
  },

  /**
   * Get free busy status from calendar service
   * @param {Object} [data] the command parameters for fetching free busy status.
   * @param {object} [query] the query parameters for specific usage
   * @returns {Promise} Resolves with a decrypted response
   * */
  getFreeBusy(data, query) {
    return EncryptHelper.encryptFreeBusyRequest(this, data)
      .then(() => {
        return this.request({
          method: 'POST',
          service: 'calendar',
          body: data,
          resource: 'freebusy',
          qs: query || {},
        });
      })
      .then(() => {
        return new Promise((resolve, reject) => {
          this.rpcEventRequests[data.requestId] = {resolve, reject};
        });
      })
      .catch((error) => {
        throw error;
      });
  },
});

export default Calendar;
