/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import chai from 'chai';
import sinon from 'sinon';

chai.config.truncateThreshold = 0;

chai.assert.isRejected = function isRejected(promise, errorLike, errMsgMatcher, msg) {
  if (typeof errorLike === 'string' || errorLike instanceof RegExp) {
    errMsgMatcher = errorLike;
    errorLike = undefined;
  }

  return Promise.resolve(promise).then(
    (value) => {
      chai.assert.fail(
        msg || `expected promise to be rejected but it was fulfilled with ${value}`
      );

      return value;
    },
    (reason) => {
      if (errorLike) {
        chai.assert.instanceOf(reason, errorLike, msg);
      }

      if (reason && errMsgMatcher) {
        const errorMessage = reason.message || String(reason);

        if (errMsgMatcher instanceof RegExp) {
          chai.assert.match(errorMessage, errMsgMatcher, msg);
        } else {
          chai.assert.include(errorMessage, errMsgMatcher, msg);
        }
      }

      return reason;
    }
  );
};

sinon.assert.expose(chai.assert, {prefix: ''});

export const {assert} = chai;
