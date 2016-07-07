/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint-env browser */
/* global ArrayBuffer, Uint8Array */

var EncryptionServiceBase = require('./encryption-base');
var SCR = require('node-scr');

/**
 * @class
 * @extends {EncryptionServiceBase}
 * @memberof Encryption
 */
var EncryptionService = EncryptionServiceBase.extend(
  /** @lends Encryption.EncryptionService.prototype */
  {
  _encryptBinary: function _encryptBinary(file) {
    var promise = (file instanceof ArrayBuffer) ? Promise.resolve(file) : new Promise(function executor(resolve, reject) {
      var fr = new FileReader();

      fr.onload = function onload() {
        resolve(new Uint8Array(this.result));
      };

      fr.onerror = reject;

      fr.readAsArrayBuffer(file);
    });

    return promise
      .then(function createScr(buffer) {
        return SCR.create()
          .then(function encryptScr(scr) {
            return scr.encrypt(buffer)
              .then(function returnResult(cdata) {
                var blob = new Blob([cdata.buffer]);
                return {
                  scr: scr,
                  cblob: blob
                };
              });
          });
      });
  }
});

module.exports = EncryptionService;
