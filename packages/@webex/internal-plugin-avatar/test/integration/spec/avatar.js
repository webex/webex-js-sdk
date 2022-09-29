/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-avatar';

// import {assert} from '@webex/test-helper-chai';
// import sinon from 'sinon';
import fh from '@webex/test-helper-file';
import WebexCore from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';

describe('plugin-avatar', () => {
  let mccoy, webex, spock;

  before('create users', () => testUsers.create({count: 2})
    .then((users) => {
      [spock, mccoy] = users;

      webex = new WebexCore({
        credentials: {
          authorization: spock.token
        }
      });

      mccoy.webex = new WebexCore({
        credentials: {
          authorization: mccoy.token
        }
      });
    }));

  before('register with wdm', () => Promise.all([
    webex.internal.device.register(),
    mccoy.webex.internal.device.register()
  ]));

  let sampleImageSmallOnePng = 'sample-image-small-one.png';

  before(() => fh.fetch(sampleImageSmallOnePng)
    .then((file) => {
      sampleImageSmallOnePng = file;
    }));

  // describe('#setAvatar()', () => {
  //   it('sets a user\'s avatar', () => webex.internal.avatar.setAvatar(sampleImageSmallOnePng)
  //     .then((avatarUrl) => {
  //       // Note: not downloading the avatar because rackspace CDN is too flaky
  //       assert.isDefined(avatarUrl);
  //       assert.match(avatarUrl, /^https?:\/\//);
  //     }));
  //
  //   it('invalidates current user`s cached avatar after uploading a new one', () => {
  //     webex.internal.avatar.store.remove = sinon.spy();
  //     return webex.internal.avatar.setAvatar(sampleImageSmallOnePng)
  //       .then(() => assert.calledWith(webex.internal.avatar.store.remove, {uuid: webex.internal.device.userId}));
  //   });
  // });
  //
  //
  // describe('#retrieveAvatarUrl()', () => {
  //   before(() => Promise.all([
  //     webex.internal.avatar.setAvatar(sampleImageSmallOnePng),
  //     mccoy.webex.internal.avatar.setAvatar(sampleImageSmallOnePng)
  //   ]));
  //
  //   it('retrieves an avatar url by email address', () => webex.internal.avatar.retrieveAvatarUrl(spock.email)
  //     .then((avatarUrl) => {
  //       // Note: not downloading the avatar because rackspace CDN is too flaky
  //       assert.isDefined(avatarUrl);
  //       assert.match(avatarUrl, /^https?:\/\//);
  //     }));
  //
  //   it('retrieves an avatar url by uuid', () => webex.internal.avatar.retrieveAvatarUrl(mccoy.webex.internal.device.userId)
  //     .then((avatarUrl) => {
  //       // Note: not downloading the avatar because rackspace CDN is too flaky
  //       assert.isDefined(avatarUrl);
  //       assert.match(avatarUrl, /^https?:\/\//);
  //     }));
  // });
});
