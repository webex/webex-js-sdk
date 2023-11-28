/**
 * Transformers are used to process data from requests and events, performing
 * actions prior to the resolution of a `request` or `event` within the calling
 * stack.
 */
const exampleGeneralTransformer = {
  /**
   * Name of this transformer.
   *
   * The usage of this transformer can be validated via a predicate. See the
   * `predicates.js` file for more details.
   *
   * @type {string}
   */
  name: 'exampleGeneralTransformer',

  /**
   * Direction this transformer should process on. This allows for different
   * directions to be handled differently when sending/receiving data.
   *
   * @type {'inbound' | 'outbound' | undefined}
   */
  direction: undefined,

  /**
   * The main transformation function
   * @param {Record<'webex' | 'transform', any>} ctx - An Object containing a webex instance and transform prop.
   * @param {any} data - Data from the event or request.
   * @returns {Promise<any>} - Data after transformation.
   */
  fn: (ctx, data) =>
    ctx
      .transform('exampleInboundTransformer', ctx, data)
      .then((transformed) => ctx.webex.internal.encryption.example(transformed)),
};

// NOTE - additional predicate examples [start]

const exampleInboundTransformer = {
  name: 'exampleInboundTransformer',
  direction: 'inbound',
  fn: (ctx, data) =>
    ctx
      .transform('exampleGeneralTransformer', ctx, data)
      .then((transformed) => ctx.webex.internal.encryption.example(transformed)),
};

const exampleOutboundTransformer = {
  name: 'exampleOutboundTransformer',
  direction: 'outbound',
  fn: (ctx, data) =>
    ctx
      .transform('exampleGeneralTransformer', ctx, data)
      .then((transformed) => ctx.webex.internal.encryption.example(transformed)),
};

// NOTE - additional predicate examples [end]

const transformers = {
  exampleGeneralTransformer,
  exampleInboundTransformer,
  exampleOutboundTransformer,
};

export default transformers;
