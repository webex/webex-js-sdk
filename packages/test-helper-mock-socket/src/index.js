/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {EventEmitter} from 'events';
import sinon from 'sinon';
import util from 'util';

/**
  * Mock of Socket Class
  * @returns {MockSocket}
  */
function MockSocket() {
  this.readyState = 1;

  Object.defineProperties(this, {
    close: {
      value: sinon.spy()
    },
    open: {
      value: sinon.stub()
    },
    send: {
      value: sinon.spy()
    }
  });

}

util.inherits(MockSocket, EventEmitter);

export default MockSocket;
