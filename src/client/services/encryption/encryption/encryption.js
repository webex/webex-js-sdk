/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var EncryptionServiceBase = require('./encryption-base');
var SCR = require('node-scr');

/**
 * @class
 * @extends {EncryptionServiceBase}
 * @memberof Encryption
 */
var EncryptionService = EncryptionServiceBase.extend({
  _encryptBinary: function _encryptBinary(file) {
    if (!Buffer.isBuffer(file)) {
      return Promise.reject(new Error('`file` must be a buffer'));
    }

    return SCR.create()
      .then(function encryptScr(scr) {
        return scr.encrypt(file)
          .then(function returnResult(cdata) {
            return {
              scr: scr,
              cblob: cdata
            };
          });
      });
  }
});
module.exports = EncryptionService;
