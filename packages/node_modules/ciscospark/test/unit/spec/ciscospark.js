/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from 'ciscospark';

import {version} from 'ciscospark/package';

describe('ciscospark', () => {
  describe('CiscoSpark', () => {
    describe('.version', () => {
      it('exists', () => {
        assert.property(CiscoSpark, 'version');
        assert.equal(CiscoSpark.version, version);
      });
    });

    describe('#version', () => {
      it('exists', () => {
        const spark = new CiscoSpark();
        assert.property(spark, 'version');
        assert.equal(spark.version, version);
      });
    });
  });
});
