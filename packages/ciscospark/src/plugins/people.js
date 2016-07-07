/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Page from '../lib/page';
import {SparkPlugin} from '@ciscospark/spark-core';

/**
 * @typedef {Object} Types~Person
 * @property {uuid} id - Unique identifier for the person
 * @property {Array<email>} emails - Email addresses of the person
 * @property {string} displayName - Display name of the person
 * @property {isoDate} created - The date and time that the person was created
 */

/**
 * @class
 * @extends SparkPlugin
 */
const People = SparkPlugin.extend({
  /**
   * Returns a single person by ID
   * @instance
   * @memberof People
   * @param {Types~Person|uuid} person
   * @returns {Promise<Types~Person>}
   * @example
   * <%= people__get_es6 %>
   * @example
   * <%= people__get %>
   */
  get(person) {
    const id = person.personId || person.id || person;
    return this.request({
      uri: `${this.config.hydraServiceUrl}/people/${id}`
    })
      .then((res) => res.body);
  },

  /**
   * Returns a list of people
   * @instance
   * @memberof People
   * @param {Object} options
   * @param {email} options.email - Returns people with an email that contains this string
   * @param {string} options.name - Returns people with a name that contains this string
   * @returns {Promise<Page<Types~Person>>}
   * @example
   * <%= people__list_es6 %>
   * @example
   * <%= people__list %>
   */
  list(options) {
    return this.request({
      uri: `${this.config.hydraServiceUrl}/people`,
      qs: options
    })
      .then((res) => new Page(res, this.spark));
  }
});

export default People;
