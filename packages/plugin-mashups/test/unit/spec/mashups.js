
/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Mashups from '../..';
import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';

describe(`plugin-mashups`, () => {
  let spark;
  beforeEach(() => {
    spark = new MockSpark({
      children: {
        mashups: Mashups
      }
    });

    spark.request = (options) => {
      return Promise.resolve({
        statusCode: 204,
        body: undefined,
        options
      });
    };

    sinon.spy(spark, `request`);
  });

  afterEach(() => {
    spark.request.restore();
  });

  describe(`#create()`, () => {
    it(`throws an error when a type is not provided`, () => assert.isRejected(spark.mashups.create({
      displayName: `mashupName`
    }), /options.type is required/));

    it(`throws an error when a roomId is not provided`, () => assert.isRejected(spark.mashups.create({
      displayName: `mashupName`,
      type: `test`
    }), /options.roomId is required/));

    it(`create request sent`, () => spark.mashups.create({type: `TYPE`, roomId: `ROOM-ID`})
      .then(() => {
        assert.calledOnce(spark.request);
        const req = spark.request.args[0][0];

        assert.equal(req.service, `mashups`);
        assert.equal(req.resource, `integrations/TYPE`);
        assert.equal(req.method, `POST`);
        assert.equal(req.body.roomId, `ROOM-ID`);
      })
    );
  });

  describe(`#remove()`, () => {
    it(`throws an error when a type is not provided`, () => assert.isRejected(spark.mashups.remove({
      displayName: `mashupName`
    }), /options.type is required/));

    it(`throws an error when a mashup id is not provided`, () => assert.isRejected(spark.mashups.remove({
      displayName: `mashupName`,
      type: `test`
    }), /options.id is required/));

    it(`remove request sent`, () => spark.mashups.remove({id: `ID`, type: `TYPE`})
      .then(() => {
        assert.calledOnce(spark.request);
        const req = spark.request.args[0][0];

        assert.equal(req.service, `mashups`);
        assert.equal(req.resource, `integrations/TYPE/ID`);
        assert.equal(req.method, `DELETE`);
      })
    );
  });

  describe(`#get()`, () => {
    it(`throws an error when a type or id not provided`, () => assert.isRejected(spark.mashups.get(), /options.roomId or option.id is required/));

    it(`get request sent`, () => spark.mashups.get({id: `ID`})
      .then(() => {
        assert.calledOnce(spark.request);
        const req = spark.request.args[0][0];

        assert.equal(req.service, `mashups`);
        assert.equal(req.resource, `integrations/rooms/ID`);
        assert.equal(req.method, `GET`);
      }));
  });
  describe(`#list()`, () => {
    it(`list request sent`, () => spark.mashups.list()
      .then(() => {
        assert.calledOnce(spark.request);
        const req = spark.request.args[0][0];

        assert.equal(req.service, `mashups`);
        assert.equal(req.resource, `integrations`);
        assert.equal(req.method, `GET`);
      }));
  });
});
