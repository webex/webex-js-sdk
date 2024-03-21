/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import {base64, retry} from '@webex/common';
import {Buffer} from 'safe-buffer';

// This file doesn't prove anything, but greatly simplifies tooling. Generally
// speaking, items in common are proven by their usage through the rest of
// @webex.

describe('common', () => {
  describe('base64', () => {
    it('is defined', () => {
      assert.isDefined(base64);
    });

    it('base64-encodes a string', () => {
      assert.equal(base64.toBase64Url('abc'), 'YWJj');
    });

    it('base64-encodes a buffer', () => {
      const buffer = Buffer.from('abc');

      assert.equal(base64.toBase64Url(buffer), 'YWJj');
    });

    it('base64-decodes a string', () => {
      const result = base64.fromBase64url('YWJj');

      assert.typeOf(result, 'string', 'decoded result must be type of string');
      assert.equal(result, 'abc');
    });
  });

  describe('retry', () => {
    it('is defined', () => {
      assert.isDefined(retry);
    });
  });
});
