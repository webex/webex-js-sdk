/**
 * @extends Error
 * @property {number} code - Error code
 */
export default class WebexMeetingsError extends Error {
  code: any;

  /**
   * Creates a new {@link WebexMeetingsError}
   * @param {number} code - Error code
   * @param {string} [message] - Error message
   * @param {string} [fileName] - Name of the script file where error was generated
   * @param {number} [lineNumber] - Line number of the script file where error was generated
   */
  constructor(code: number, ...args: any[]) {
    super(...args);

    this.name = 'WebexMeetingsError';

    Object.defineProperty(this, 'code', {
      value: code,
      enumerable: true,
    });
  }

  /**
   * Returns human readable string describing the error.
   * @returns {string}
   */
  toString() {
    const message = this.message ? `: ${this.message}` : '';

    return `${this.name} ${this.code}${message}`;
  }
}
