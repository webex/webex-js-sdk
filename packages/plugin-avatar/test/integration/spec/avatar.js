/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import fh from '@ciscospark/test-helper-file';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';

describe(`plugin-avatar`, () => {

  let mccoy, spark, spock;

  before(() => testUsers.create({count: 2})
    .then((users) => {
      [spock, mccoy] = users;

      spark = new CiscoSpark({
        credentials: {
          authorization: spock.token
        }
      });

      mccoy.spark = new CiscoSpark({
        credentials: {
          authorization: mccoy.token
        }
      });

      return Promise.all([
        spark.device.register(),
        mccoy.spark.device.register()
      ]);
    }));

  let sampleImageSmallOnePng = `sample-image-small-one.png`;

  before(() => fh.fetch(sampleImageSmallOnePng)
    .then((file) => {
      sampleImageSmallOnePng = file;
    }));

  describe(`#setAvatar()`, () => {
    it(`sets a user's avatar`, () => spark.avatar.setAvatar(sampleImageSmallOnePng)
      .then((avatarUrl) => {
        // Note: not downloading the avatar because rackspace CDN is too flaky
        assert.isDefined(avatarUrl);
        assert.match(avatarUrl, /^https?\:\/\//);
      }));

    it(`invalidates current user\`s cached avatar after uploading a new one`, () => {
      spark.avatar.store.remove = sinon.spy();
      return spark.avatar.setAvatar(sampleImageSmallOnePng)
        .then(() => assert.calledWith(spark.avatar.store.remove, spark.device.userId));
    });
  });


  describe(`#retrieveAvatarUrl()`, () => {
    before(() => Promise.all([
      spark.avatar.setAvatar(sampleImageSmallOnePng),
      mccoy.spark.avatar.setAvatar(sampleImageSmallOnePng)
    ]));

    it(`retrieves an avatar url by email address`, () => spark.avatar.retrieveAvatarUrl(spock.email)
      .then((avatarUrl) => {
        // Note: not downloading the avatar because rackspace CDN is too flaky
        assert.isDefined(avatarUrl);
        assert.match(avatarUrl, /^https?\:\/\//);
      }));

    it(`retrieves an avatar url by uuid`, () => spark.avatar.retrieveAvatarUrl(mccoy.spark.device.userId)
      .then((avatarUrl) => {
        // Note: not downloading the avatar because rackspace CDN is too flaky
        assert.isDefined(avatarUrl);
        assert.match(avatarUrl, /^https?\:\/\//);
      }));
  });
});
