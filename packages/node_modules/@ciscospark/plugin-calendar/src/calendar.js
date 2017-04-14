/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {SparkPlugin} from '@ciscospark/spark-core';

const Calendar = SparkPlugin.extend({
  namespace: `Calendar`,

  /**
   * Retrieves a collection of meetings based on the request parameters
   * @param {Object} options
   * @param {Date} options.fromDate the start of the time range
   * @param {Date} options.toDate the end of the time range
   * @returns {Promise} Resolves with an array of meetings
   */
  list(options) {
    options = options || {};
    return this.spark.request({
      method: `GET`,
      service: `calendar`,
      resource: `calendarEvents`,
      qs: options
    })
      .then((res) => res.body.items);
  }
});

export default Calendar;
