/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin, Page} from '@webex/webex-core';
import {base64, oneFlight} from '@webex/common';

import PeopleBatcher from './people-batcher';

/**
 * @typedef {Object} PersonObject
 * @property {string} id - (server generated) Unique identifier for the person
 * @property {Array<email>} emails - Email addresses of the person
 * @property {string} displayName - Display name of the person
 * @property {isoDate} created - (server generated) The date and time that the person was created
 */

/**
 * @class
 */
const People = WebexPlugin.extend({
  namespace: 'People',

  children: {
    batcher: PeopleBatcher,
  },
  /**
   * Returns a single person by ID
   * @instance
   * @memberof People
   * @param {PersonObject|uuid|string} person
   * @returns {Promise<PersonObject>}
   * @example
   * webex.rooms.create({title: 'Get Person Example'})
   *   .then(function(room) {
   *     return webex.memberships.create({
   *       personEmail: 'alice@example.com',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function(membership) {
   *     return webex.people.get(membership.personId);
   *   })
   *   .then(function(alice) {
   *     var assert = require('assert');
   *     assert(alice.id);
   *     assert(Array.isArray(alice.emails));
   *     assert.equal(alice.emails.filter(function(email) {
   *       return email === 'alice@example.com';
   *     }).length, 1);
   *     assert(alice.displayName);
   *     assert(alice.created);
   *     return 'success';
   *   });
   *   // => success
   */
  get(person) {
    if (!person) {
      return Promise.reject(new Error('A person with an id is required'));
    }
    if (person === 'me') {
      return this._getMe();
    }
    const id = person.personId || person.id || person;

    return this.batcher.request(id);
  },

  /**
   * Returns a list of people
   * @instance
   * @memberof People
   * @param {Object | uuid[]} options or array of uuids
   * @param {email} options.email - Returns people with an email that contains this string
   * @param {string} options.displayName - Returns people with a name that contains this string
   * @param {bool} showAllTypes optional flag that requires Hydra to send every type field,
   * even if the type is not "person" (e.g.: SX10, webhook_integration, etc.)
   * @returns {Promise<Page<PersonObject>>}
   * @example
   * var room;
   * webex.rooms.create({title: 'List People Example'})
   *   .then(function(r) {
   *     room = r;
   *     return webex.memberships.create({
   *       personEmail: 'alice@example.com',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function() {
   *     return webex.memberships.create({
   *       personEmail: 'bob@example.com',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function() {
   *     return webex.people.list({email: 'alice@example.com'});
   *   })
   *   .then(function(people) {
   *     var assert = require('assert');
   *     assert.equal(people.length, 1);
   *     var person = people.items[0];
   *     assert(person.id);
   *     assert(Array.isArray(person.emails));
   *     assert(person.displayName);
   *     assert(person.created);
   *     return 'success';
   *   });
   *   // => success
   *  @example <caption>Example usage of array method</caption>
   * var room;
   * var aliceId;
   * var bobId;
   * webex.rooms.create({title: 'List People Array Example'})
   *   .then(function(r) {
   *     room = r;
   *     return webex.memberships.create({
   *       personEmail: 'alice@example.com',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function(membership) {
   *     aliceId = membership.personId;
   *   })
   *   .then(function() {
   *     return webex.memberships.create({
   *       personEmail: 'bob@example.com',
   *       roomId: room.id
   *     });
   *   })
   *   .then(function(membership) {
   *     bobId = membership.personId;
   *   })
   *   .then(function() {
   *     return webex.people.list([aliceId, bobId]);
   *   })
   *   .then(function(people) {
   *     var assert = require('assert');
   *     assert.equal(people.length, 2);
   *     var person = people.items[0];
   *     assert(person.id);
   *     assert(Array.isArray(person.emails));
   *     assert(person.displayName);
   *     assert(person.created);
   *     return 'success';
   *   });
   *   // => success
   */
  list(options) {
    if (Array.isArray(options)) {
      const peopleIds = options;

      return Promise.all(peopleIds.map((personId) => this.batcher.request(personId)));
    }

    return this.request({
      service: 'hydra',
      resource: 'people',
      qs: options,
    }).then((res) => new Page(res, this.webex));
  },

  /**
   * Converts a uuid to a hydra id without a network dip.
   * @param {string} id
   * @private
   * @returns {string}
   */
  inferPersonIdFromUuid(id) {
    // base64.validate seems to return true for uuids, so we need a different
    // check
    try {
      if (base64.decode(id).includes('ciscospark://')) {
        return id;
      }
    } catch (err) {
      // ignore
    }

    return base64.encode(`ciscospark://us/PEOPLE/${id}`);
  },

  /**
   * Fetches the current user from the /people/me endpoint
   * @instance
   * @memberof People
   * @private
   * @returns {Promise<PersonObject>}
   */
  @oneFlight
  _getMe() {
    return this.webex
      .request({
        service: 'hydra',
        resource: 'people/me',
      })
      .then((res) => res.body);
  },
});

export default People;
