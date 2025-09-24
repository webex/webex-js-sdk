/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import util from 'util';

import {WebexEventEmitter} from '@webex/common';

/**
 * WebexInternalCore is an extra layer of nesting to make it blatantly clear that
 * private plugins are, in fact, private.
 * @class
 */
class WebexInternalCore extends WebexEventEmitter {
  // Properties from plugin system that may be attached
  [key: string]: any;

  /**
   * Constructor for WebexInternalCore
   * @param {any} attrs - Initial attributes to set on the instance
   * @param {any} options - Configuration options for initialization
   */
  constructor(attrs: any = {}, options: any = {}) {
    super();

    // Initialize any passed attributes
    Object.keys(attrs).forEach((key) => {
      this[key] = attrs[key];
    });
  }

  /**
   * Computed property that indicates if all child plugins are ready
   */
  get ready(): boolean {
    const children = (this.constructor as any).prototype._children || {};

    return Object.keys(children).reduce(
      (ready: boolean, name: string) => ready && this[name] && this[name].ready !== false,
      true
    );
  }

  /**
   * @instance
   * @memberof WebexInternalCore
   * @param {number} depth
   * @private
   * @returns {Object}
   */
  inspect(depth?: number): string {
    return util.inspect(this.toJSON?.() || {}, {depth});
  }

  /**
   * Serialize method that mimics Ampersand behavior
   * @returns {any} Plain object representation of the instance
   */
  toJSON(): any {
    const result: any = {};

    // Include all enumerable properties
    Object.keys(this).forEach((key) => {
      if (typeof this[key] !== 'function' && !key.startsWith('_')) {
        result[key] = this[key];
      }
    });

    return result;
  }
}

export default WebexInternalCore;
