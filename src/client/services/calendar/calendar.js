/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var defaults = require('lodash.defaults');
var isArray = require('lodash.isarray');
var noop = require('lodash.noop');
var patterns = require('../../../util/patterns');
var resolveWith = require('../../../util/resolve-with');
var SparkBase = require('../../../lib/spark-base');

// Adding decryption for subject
require('./decrypter');

/**
 * @class
 * @extends {SparkBase}
 * @memberof Calendar
 */
var CalendarService = SparkBase.extend(
  /** @lends Calendar.CalendarService.prototype */
  {
  namespace: 'Calendar',

  /**
   * Retrieves a collection of meetings based on the query parameters
   *
   * @memberof CalendarService.prototype
   * @param {Date} start the start of the time range
   * @param {Date} end the end of the time range
   * @returns {Promise} Resolves with an array of meetings with decrypted data
   */
  getMeetings: function getMeetings() {
    // return this.request({
    //   api: 'calendar',
    //   resource: 'calendarEvents'
    // })
    return this.request({
      method: 'GET',
      url: 'http://localhost:9090/calendar-server/calendar/api/v1/calendarEvents'
    })
    .then(function(res) {
      if (res.body.items) {
        return Promise.all(
          // items is a list of encrypted meetings, we map it to a list of Promises
          res.body.items.map(function(meeting) {
            meeting.title = meeting.encryptedSubject;
            meeting.location = meeting.encryptedLocation;
            meeting.agenda = meeting.encryptedAgenda;
            // Decrypt title
            return this.spark.conversation.decrypter.decryptProperty(meeting, 'title', meeting.encryptionKeyUrl)
              .then(function(meetingWithDecryptedTitle) {
                return this.spark.conversation.decrypter.decryptProperty(meetingWithDecryptedTitle, 'location', meetingWithDecryptedTitle.encryptionKeyUrl)
                  .then(function(meetingWithDecryptedLocation) {
                    return this.spark.conversation.decrypter.decryptProperty(meetingWithDecryptedLocation, 'agenda', meetingWithDecryptedLocation.encryptionKeyUrl);
                  }.bind(this));
              }.bind(this));
          }.bind(this))
        ).then(function(data) {
          return data;
        }).catch(function(err) {
          this.logger.error('calendar: error occurred in decrypting meeting', err);
        }.bind(this));
      }
      else {
        return [];
      }
    }.bind(this))
    .catch(function(err) {
      this.logger.error('calendar: error occurred in retrieving meetings', err);
    }.bind(this));
  },

  getUser: function getUser(userId, orgId) {
    if (!userId || !orgId) {
      return Promise.reject('Both userId and orgId must be passed in.');
    }

    return this.request({
      method: 'GET',
      url: `https://identity.webex.com/identity/scim/${orgId}/v1/Users/${userId}`
    })
    .then(function(res) {
      return res.body;
    })
    .catch(function(err) {
      this.logger.error('scim: error occurred in retrieving user', err);
    }.bind(this));
  }
});

module.exports = CalendarService;
