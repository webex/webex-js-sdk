/**
 * Predicates are used to validate whether or not a transformer should be
 * triggered, and with what data.
 */

import {has} from 'lodash';

const transformSchedulerData = {
  /**
   * Name of the transformer to be called.
   *
   * A predicate will `test()` if the payload is valid for the transform, and
   * then `extract()` the necessary data to be passed into the transformer.
   *
   * @type {string}
   */
  name: 'transformSchedulerData',

  /**
   * Direction this predicate should process on. This allows for different
   * predicates to be used for inbound and outbound transforms.
   *
   * @type {'inbound' | 'outbound' | undefined}
   */
  direction: 'inbound',

  /**
   * Test is used to validate if the `extract()` method should be called to be
   * processed by the associated `name` transformer.
   *
   * @param {Record<'webex' | 'transform', any>} ctx - An Object containing a webex instance and transform prop
   * @param {Object} data - Data from the event or request
   * @returns {boolean} - Whether to process the `extract()` method.
   */
  test: (ctx, data) => {
    return Promise.resolve(
      data.options &&
        data.options.service === 'calendar' &&
        data.options.resource.indexOf('schedulerData') > -1 &&
        data.method === 'GET' &&
        has(data, 'body.seriesId')
    );
  },

  /**
   * Extract a given set of data from a request or event to be processed by the
   * associated `name` transform.
   *
   * @param {Object} data - Data from the event or request
   * @returns {any} - Data to send to the named transform.
   */
  extract: (data) => Promise.resolve(data.body),
};

const transformSchedulerRequest = {
  name: 'transformSchedulerRequest',
  direction: 'outbound',
  test: (ctx, data) => {
    return Promise.resolve(
      data.service === 'calendar' &&
        data.resource.indexOf('calendarEvents') > -1 &&
        (data.method === 'POST' || data.method === 'PATCH') &&
        (has(data, 'body.attendees') ||
          has(data, 'body.notes') ||
          has(data, 'body.subject') ||
          has(data, 'body.webexOptions'))
    );
  },
  extract: (data) => Promise.resolve(data.body),
};

const transformFreeBusyRequest = {
  name: 'transformFreeBusyRequest',
  direction: 'outbound',
  test: (ctx, data) => {
    return Promise.resolve(
      data.service === 'calendar' &&
        data.resource.indexOf('freebusy') > -1 &&
        data.method === 'POST' &&
        has(data, 'body.emails')
    );
  },
  extract: (data) => Promise.resolve(data.body),
};

const transformFreeBusyResponse = {
  name: 'transformFreeBusyResponse',
  direction: 'inbound',
  test: (ctx, data) => {
    return Promise.resolve(has(data, 'calendarFreeBusyScheduleResponse'));
  },
  extract: (data) => Promise.resolve(data.calendarFreeBusyScheduleResponse),
};

const predicates = {
  transformSchedulerData,
  transformSchedulerRequest,
  transformFreeBusyRequest,
  transformFreeBusyResponse,
};

export default predicates;
