/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import {persist, WebexPlugin} from '@webex/webex-core';

describe('webex-core', () => {
  describe('@persist', () => {
    it('writes the identified value into the store when the value changes', () => {
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
      });

      const webex = new MockWebex({
        children: {
          mockChild: MockChild,
        },
      });

      webex.internal.mockChild.test = true;

      return new Promise((resolve) => setTimeout(resolve, 1))
        .then(() => {
          assert.isTrue(webex.boundedStorage.data.MockChild['@'].test);
          webex.internal.mockChild.test = true;

          return new Promise((resolve) => setTimeout(resolve, 1));
        })
        .then(() => {
          assert.isTrue(webex.boundedStorage.data.MockChild['@'].test);
        });
    });
  });
});
