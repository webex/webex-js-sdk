/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import AmpCollection from 'ampersand-collection';

import Call from './call';

const Calls = AmpCollection.extend({
  model: Call,

  mainIndex: 'internalCallId',

  indexes: [
    'correlationId'
  ],

  /**
   * Initializer
   * @private
   * @param {Object} attrs
   * @param {Object} options
   * @returns {undefined}
   */
  initialize(...args) {
    Reflect.apply(AmpCollection.prototype.initialize, this, args);

    this.on('add', (call) => {
      this.listenTo(call, 'change:state', () => {
        if (call.config.enableExperimentalGroupCallingSupport) {
          if (call.state === 'inactive') {
            this.remove(call);
          }
        }
        else if (call.status === 'disconnected') {
          this.remove(call);
        }
      });
    });
  },

  /**
   * Indicates if this collection already contains the specified locus
   * @param {Types~Locus} locus
   * @returns {boolean}
   */
  has(locus) {
    const found = this.get(`${locus.url}_${locus.fullState.lastActive}`);
    if (found) {
      return true;
    }

    if (locus.replaces) {
      for (const replaced of locus.replaces) {
        if (this.get(`${replaced.locusUrl}_${replaced.lastActive}`)) {
          return true;
        }
      }
    }
    return false;
  }
});

export default Calls;
