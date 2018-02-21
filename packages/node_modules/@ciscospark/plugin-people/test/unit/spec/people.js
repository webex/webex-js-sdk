/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import People from '@ciscospark/plugin-people';
import MockSpark from '@ciscospark/test-helper-mock-spark';

describe('plugin-people', () => {
  describe('People', () => {
    let spark;

    beforeEach(() => {
      spark = new MockSpark({
        children: {
          people: People
        }
      });
    });

    describe('#get()', () => {
      it('requires a person parameter', () => assert.isRejected(spark.people.get(), /A person with an id is required/));
    });
  });
});
