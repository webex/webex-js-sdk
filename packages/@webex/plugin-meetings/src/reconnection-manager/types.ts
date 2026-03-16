/**
 * Used to indicate that the reconnect logic needs to be retried.
 *
 * @class NeedsRetryError
 * @extends {Error}
 */
export class NeedsRetryError extends Error {}

/**
 * Used to indicate that the meeting needs to be rejoined, not just media reconnected
 *
 * @class NeedsRejoinError
 * @extends {Error}
 */
export class NeedsRejoinError extends Error {
  wasSharing: any;

  /**
   * Creates an instance of NeedsRejoinError.
   * @param {Object} params
   * @param {boolean} params.wasSharing
   * @param {Error} params.error
   * @memberof NeedsRejoinError
   */
  constructor({
    wasSharing,
    error = new Error('Meeting needs to be rejoined'),
  }: {
    wasSharing?: boolean;
    error?: Error;
  }) {
    // @ts-ignore
    super(error);

    this.wasSharing = wasSharing;
  }
}
