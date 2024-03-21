/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import {persist, WebexPlugin, waitForValue} from '@webex/webex-core';

describe('webex-core', () => {
  describe('@waitForValue', () => {
    it('prevents the method from executing until the specified value changes', () => {
      const MockChild = WebexPlugin.extend({
        props: {
          test: {
            default: false,
            type: 'boolean',
          },
        },

        namespace: 'MockChild',

        @persist('@')
        initialize(...args) {
          return Reflect.apply(WebexPlugin.prototype.initialize, this, args);
        },

        @waitForValue('@')
        testMethod() {
          return this.webex.request().then(() => {
            this.test = true;
          });
        },
      });

      const webex = new MockWebex({
        children: {
          mockChild: MockChild,
        },
      });

      let resolve;

      sinon.stub(webex.boundedStorage, 'get').returns(
        new Promise((r) => {
          resolve = r;
        })
      );

      webex.request.returns(
        Promise.resolve({
          body: {
            access_token: 'fake token @waitForValue',
            token_type: 'Bearer',
          },
        })
      );

      const promise = webex.internal.mockChild.testMethod();

      assert.notCalled(webex.request);
      assert.isFalse(webex.internal.mockChild.test);

      return new Promise((resolve) => setTimeout(resolve, 1))
        .then(() => {
          assert.notCalled(webex.request);
          assert.isFalse(webex.internal.mockChild.test);
          resolve();

          return new Promise((resolve) => setTimeout(resolve, 1));
        })
        .then(promise)
        .then(() => {
          assert.isTrue(webex.internal.mockChild.test);
          assert.called(webex.request);
        });
    });
  });
});
