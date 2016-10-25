/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import fh from '@ciscospark/test-helper-file';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';

describe(`plugin-avatar`, function() {
  describe(`Avatar`, () => {
    this.timeout(120000);
    /* eslint max-statements: [0] */
    let mccoy, spock;
    before(() => testUsers.create({count: 2})
      .then((users) => {
        [mccoy, spock] = users;
        spock.spark = new CiscoSpark({
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
          spock.spark.device.register(),
          mccoy.spark.device.register()
        ]);
      }));

    const party = {
      spock: true,
      mccoy: true
    };

    const files = {
      sampleImageSmallOnePng: `sample-image-small-one.png`
    };

    before(() => fh.fetchFixtures(files));

    describe(`#setAvatar()`, () => {
      it(`sets a user\`s avatar`, () => {
        return party.spock.spark.avatar.setAvatar(files.sampleImageSmallOnePng)
          .then((avatarUrl) => {
            // Note: not downloading the avatar because rackspace CDN is too flaky
            assert.isDefined(avatarUrl);
            assert.match(avatarUrl, /^https?\:\/\//);
          });
      });

      it(`invalidates current user\`s cached avatar after uploading a new one`, () => {
        party.spock.spark.avatar.store.remove = sinon.spy();
        return party.spock.spark.avatar.setAvatar(files.sampleImageSmallOnePng)
          .then(() =>
            assert.calledWith(party.spock.spark.avatar.store.remove, party.spock.spark.device.userId));
      });
    });

    describe(`#retrieveAvatarUrl()`, () => {
      before(() => {
        return Promise.all([
          party.spock.spark.avatar.setAvatar(files.sampleImageSmallOnePng),
          party.mccoy.spark.avatar.setAvatar(files.sampleImageSmallOnePng)
        ]);
      });

      it(`retrieves an avatar url by email address`, () => {
        return party.spock.spark.avatar.retrieveAvatarUrl(party.spock.email)
          .then((avatarUrl) => {
            // Note: not downloading the avatar because rackspace CDN is too flaky
            assert.isDefined(avatarUrl);
            assert.match(avatarUrl, /^https?\:\/\//);
          });
      });

      it(`retrieves an avatar url by uuid`, () => {
        return party.spock.spark.avatar.retrieveAvatarUrl(party.mccoy.spark.device.userId)
          .then((avatarUrl) => {
            // Note: not downloading the avatar because rackspace CDN is too flaky
            assert.isDefined(avatarUrl);
            assert.match(avatarUrl, /^https?\:\/\//);
          });
      });
    });
  });
});
