/**
 * Transformers are used to process data from requests and events, performing
 * actions prior to the resolution of a `request` or `event` within the calling
 * stack.
 */
const transformExample = {
  /**
   * Name of this transformer.
   *
   * The usage of this transformer can be validated via a predicate. See the
   * `predicates.js` file for more details.
   *
   * @type {string}
   */
  name: 'transformExample',

  /**
   * Direction this transformer should process on. This allows for different
   * directions to be handled differently when sending/receiving data.
   *
   * @type {'inbound' | 'outbound' | undefined}
   */
  direction: 'inbound',

  /**
   * The main transformation function
   * @param {Record<'webex' | 'transform', any>} ctx - An Object containing a webex instance and transform prop.
   * @param {any} data - Data from the event or request.
   * @returns {Promise<any>} - Data after transformation.
   */
  fn: (ctx, data) => {
    if (!data) {
      return Promise.resolve();
    }

    if (!data.encryptionKeyUrl) {
      return Promise.resolve();
    }

    // Decrypt the node you want to
    return Promise.all([
      ctx.transform('decryptTextProp', 'someNodeWhichYouWantToCheck', data.encryptionKeyUrl, data),
    ]);
  },
};

const transformers = {
  transformExample, // leave an example here
};

export default transformers;
