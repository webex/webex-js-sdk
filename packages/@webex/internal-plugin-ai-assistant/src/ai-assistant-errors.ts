import {Exception} from '@webex/common';
import {RequestOptions} from './types';

interface AIAssistantTimeoutErrorParams
  extends Required<Pick<RequestOptions, 'resource' | 'params'>> {
  requestId: string;
  timeout: number;
}

/**
 * Thrown when an expected AI Assistant response is not received in a timely manner.
 */
export class AIAssistantTimeoutError extends Exception {
  /**
   * Construct AIAssistantTimeoutError
   * @param {AIAssistantTimeoutErrorParams} details
   */
  // eslint-disable-next-line no-useless-constructor
  constructor(details: AIAssistantTimeoutErrorParams) {
    super(details);
  }

  /**
   * Parse Error details
   *
   * @param {AIAssistantTimeoutErrorParams} details
   * @returns {string}
   */
  parse(details: AIAssistantTimeoutErrorParams) {
    return (
      `The AI assistant did not respond within ${details.timeout} ms.` +
      `\n Request Id: ${details.requestId}` +
      `\n Resource: ${details.resource}` +
      `\n Params: ${JSON.stringify(details.params)}`
    );
  }
}
