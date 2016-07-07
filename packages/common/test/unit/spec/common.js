/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from 'chai';
import {base64, oneFlight, retry} from '../..';

// This file doesn't prove anything, but greatly simplifies tooling. Generally
// speaking, items in common are proven by their usage through the rest of
// @ciscospark.

describe(`Common`, () => {
  describe(`base64`, () => {
    it(`is defined`, () => {
      assert.isDefined(base64);
    });

    it(`does btoa transforms`, () => {
      assert.equal(base64.toBase64Url(`abc`), `YWJj`);
    });

    it(`does atob transforms`, () => {
      assert.equal(base64.fromBase64url(`YWJj`), `abc`);
    });
  });

  describe(`oneFlight`, () => {
    it(`is defined`, () => {
      assert.isDefined(oneFlight);
    });
  });

  describe(`retry`, () => {
    it(`is defined`, () => {
      assert.isDefined(retry);
    });
  });

});
