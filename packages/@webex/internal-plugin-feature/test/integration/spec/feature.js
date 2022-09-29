/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-feature';

import {assert} from '@webex/test-helper-chai';
import WebexCore from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';
import {expectEvent, flaky} from '@webex/test-helper-mocha';
import sinon from 'sinon';

describe('plugin-feature', function () {
  this.timeout(30000);
  let webex, spock;

  describe('#setFeature()', () => {
    before(() => testUsers.create({count: 1})
      .then(async (users) => {
        spock = users[0];

        // Pause for 5 seconds for CI
        await new Promise((done) => setTimeout(done, 5000));

        webex = new WebexCore({
          credentials: {
            authorization: spock.token
          }
        });

        return webex.internal.device.register();
      }));

    [
      'developer',
      'user'
    ].forEach((keyType) => {
      it(`sets a value for a ${keyType} feature toggle`, () => webex.internal.feature.setFeature(keyType, 'testFeature', false)
        .then((res) => {
          assert.equal(res.key, 'testFeature');
          assert.equal(res.val, 'false');
          assert.equal(res.value, false);
          assert.equal(res.type, 'boolean');

          assert.equal(webex.internal.device.features[keyType].get({key: 'testFeature'}).val, 'false');

          return webex.internal.feature.getFeature(keyType, 'testFeature')
            .then((result) => assert.deepEqual(result, false));
        }));
    });
  });

  describe('#setBundledFeatures()', () => {
    before(() => testUsers.create({count: 1})
      .then((users) => {
        spock = users[0];
        webex = new WebexCore({
          credentials: {
            authorization: spock.token
          }
        });

        return webex.internal.device.register();
      }));

    const featureUpdateArray = [{
      key: 'key1',
      val: 'value1',
      type: 'USER',
      mutable: 'true'
    }, {
      key: 'key2',
      val: 'value2',
      mutable: 'false'
    }];

    it('sets a value for two user feature toggle', () => {
      webex.internal.feature.setFeature('user', 'key1', false);

      return webex.internal.feature.setBundledFeatures(featureUpdateArray)
        .then(() => Promise.all([
          webex.internal.feature.getFeature('user', 'key1')
            .then((result) => assert.deepEqual(result, 'value1')),
          webex.internal.feature.getFeature('user', 'key2')
            .then((result) => assert.deepEqual(result, 'value2'))
        ]));
    });
  });

  describe('when feature toggle update event is received', () => {
    before(() => testUsers.create({count: 1})
      .then(async (users) => {
        spock = users[0];

        // Pause for 5 seconds for CI
        await new Promise((done) => setTimeout(done, 5000));

        webex = new WebexCore({
          credentials: {
            authorization: spock.token
          }
        });

        sinon.spy(webex.internal.feature, 'handleFeatureUpdate');

        return webex.internal.device.register()
          .then(() => webex.internal.mercury.connect());
      }));

    after(() => webex.internal.mercury.disconnect());

    flaky(it, process.env.SKIP_FLAKY_TESTS)('updates the feature toggle', () => {
      const featureUpdateArray = [{
        key: 'mention-notifications',
        val: false,
        type: 'USER',
        mutable: true
      }];

      webex.internal.feature.listen();

      return webex.internal.feature.getFeature('user', 'mention-notifications')
        .then((result) => assert.deepEqual(result, true))
        .then(() => webex.internal.feature.setBundledFeatures(featureUpdateArray))
        .then(() => expectEvent(10000, 'event:featureToggle_update', webex.internal.mercury))
        .then(() => assert.called(webex.internal.feature.handleFeatureUpdate))
        .then(() => webex.internal.feature.getFeature('user', 'mention-notifications'))
        .then((result) => assert.deepEqual(result, false));
    });
  });
});
