import {Exception} from '@webex/common';
import {RequestOptions} from './types';

interface DssTimeoutErrorParams extends Required<Pick<RequestOptions, 'resource' | 'params'>> {
  requestId: string;
  timeout: number;
}

/**
 * Thrown when an expected DSS respond is not received in a timely manner.
 */
export class DssTimeoutError extends Exception {
  /**
   * Construct DssTimeoutError
   * @param {DssTimeoutErrorParams} details
   */
  // eslint-disable-next-line no-useless-constructor
  constructor(details: DssTimeoutErrorParams) {
    super(details);
  }

  /**
   * Parse Error details
   *
   * @param {DssTimeoutErrorParams} details
   * @returns {string}
   */
  parse(details: DssTimeoutErrorParams) {
    return (
      `The DSS did not respond within ${details.timeout} ms.` +
      `\n Request Id: ${details.requestId}` +
      `\n Resource: ${details.resource}` +
      `\n Params: ${JSON.stringify(details.params)}`
    );
  }
}
