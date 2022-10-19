/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * Base Exception class
 */
export default class Exception extends Error {
  static defaultMessage = 'An error occurred';

  /**
   * constructor
   * @param {mixed} args
   * @returns {Exception}
   */
  constructor(...args) {
    super(...args);

    let message;

    if (this.parse) {
      message = this.parse(...args);
    }
    else if (this.constructor.parse) {
      message = this.constructor.parse(...args);
    }

    if (!message) {
      message = this.constructor.defaultMessage;
    }

    this.name = this.constructor.name;

    this.message = message;
  }

  /**
   * Generates the value assigned to `this.message`. You'll probably want to
   * override this in your custom Exception
   * @param {mixed} args
   * @returns {string}
   */
  static parse(...args) {
    return args[0];
  }
}
