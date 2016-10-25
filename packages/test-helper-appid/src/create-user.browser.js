/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

'use strict';

var makeLocalUrl = require('@ciscospark/test-helper-make-local-url');

/* eslint-env browser */

module.exports = function createUser(options) {
  return fetch(makeLocalUrl('/jwt'), {
    method: 'POST',
    headers: new Headers({
      'content-type': 'application/json'
    }),
    body: JSON.stringify(options)
  })
  .then((res) => res.json());
};
