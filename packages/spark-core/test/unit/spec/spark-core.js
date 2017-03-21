/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import Spark, {Credentials} from '../..';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import State from 'ampersand-state';
import {get} from 'lodash';

describe(`Spark`, () => {
  let spark;
  beforeEach(() => {
    spark = new Spark();
  });

  describe(`#logger`, () => {
    it(`exists`, () => {
      assert.property(spark, `logger`);
      assert.doesNotThrow(() => {
        spark.logger.log(`test`);
      });
    });
  });

  describe.skip(`.version`, () => {
    it(`exists`, () => {
      assert.property(Spark, `version`);
    });
  });

  describe.skip(`#version`, () => {
    it(`exists`, () => {
      assert.property(spark, `version`);
    });
  });

  it(`emits the \`loaded\` event when the storage layer has loaded all data`, () => {
    process.on(`unhandledRejection`, (r) => console.log(r));

    // I'm not sure why I need to put a state object in the mock storage layer
    // (as opposed to a POJO), but I blame it on the mock storage layer and not
    // the real storage layer; if it were a bug in the real storage layer, the
    // selenium tests wouldn't work.
    const S = State.extend({
      props: {
        // eslint-disable-next-line camelcase
        access_token: `string`,
        type: `string`
      }
    });

    const spark = new MockSpark({
      children: {
        credentials: Credentials
      },
      attrs: {
        initialBoundedStorage: {
          Credentials: {
            authorization: new S({
              // eslint-disable-next-line camelcase
              access_token: `A Token`,
              type: `FAKE`
            })
          }
        }
      }
    });

    assert.isUndefined(get(spark, `credentials.authorization.access_token`));
    return new Promise((resolve) => {
      spark.on(`loaded`, resolve);
    })
      .then(() => {
        assert.isDefined(spark.credentials.authorization.access_token);
        assert.equal(spark.credentials.authorization.access_token, `A Token`);
      });
  });
});
