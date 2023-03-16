/**
 * Predicates are used to validate whether or not a transformer should be
 * triggered, and with what data.
 */

import {has} from 'lodash';

const transformExample = {
  /**
   * Name of the transformer to be called.
   *
   * A predicate will `test()` if the payload is valid for the transform, and
   * then `extract()` the necessary data to be passed into the transformer.
   *
   * @type {string}
   */
  name: 'transformExample',

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
    return Promise.resolve(has(data, 'body.someNodeWhichYouWantToCheck'));
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

const predicates = {
  transformExample, // leave an example here
};

export default predicates;
