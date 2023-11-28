/**
 * Predicates are used to validate whether or not a transformer should be
 * triggered, and with what data.
 */
const exampleGeneralPredicate = {
  /**
   * Name of the transformer to be called.
   *
   * A predicate will `test()` if the payload is valid for the transform, and
   * then `extract()` the necessary data to be passed into the transformer.
   *
   * @type {string}
   */
  name: 'exampleGeneralTransformer',

  /**
   * Direction this predicate should process on. This allows for different
   * predicates to be used for inbound and outbound transforms.
   *
   * @type {'inbound' | 'outbound' | undefined}
   */
  direction: undefined,

  /**
   * Test is used to validate if the `extract()` method should be called to be
   * processed by the associated `name` transformer.
   *
   * @param {Record<'webex' | 'transform', any>} ctx - An Object containing a webex instance and transform prop
   * @param {Object} data - Data from the event or request
   * @returns {boolean} - Whether to process the `extract()` method.
   */
  test: (ctx, data) => Promise.resolve(!!data.value),

  /**
   * Extract a given set of data from a request or event to be processed by the
   * associated `name` transform.
   *
   * @param {Object} data - Data from the event or request
   * @returns {any} - Data to send to the named transform.
   */
  extract: (data) => Promise.resolve(data.value),
};

// NOTE - additional predicate examples [start]

const exampleInboundPredicate = {
  name: 'exampleInboundTransformer',
  direction: 'inbound',
  test: (ctx, data) => Promise.resolve(!!data.inboundValue),
  extract: (data) => Promise.resolve(data.inboundValue),
};

const exampleOutboundPredicate = {
  name: 'exampleOutboundTransformer',
  direction: 'outbound',
  test: (ctx, data) => Promise.resolve(!!data.outboundValue),
  extract: (data) => Promise.resolve(data.outboundValue),
};

// NOTE - additional predicate examples [end]

const predicates = {
  exampleGeneralPredicate,
  exampleInboundPredicate,
  exampleOutboundPredicate,
};

export default predicates;
