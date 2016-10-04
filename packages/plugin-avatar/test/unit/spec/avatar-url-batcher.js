/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */
import {assert} from '@ciscospark/test-helper-chai';
import Avatar from '../../';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';


describe(`Services`, () => {
  describe(`Avatar`, () => {
    describe(`AvatarUrlBatcher`, () => {
      let batcher;
      let spark;

      beforeEach(() => {
        spark = new MockSpark({
          children: {
            avatar: Avatar
          }
        });
        console.warn('spark: <' + JSON.stringify(spark) + '>');
        batcher = spark.avatar.batcher;
      });

      describe(`#fingerprintRequest(item)`, () => {
        it(`returns 'uuid - size'`, () => {
          return batcher.fingerprintRequest({uuid: `uuid1`, size: 80})
            .then((res) => assert.equal(res, `uuid1 - 80`));
        });
      });
    });
  });
});
