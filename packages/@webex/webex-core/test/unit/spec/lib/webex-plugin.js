/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin} from '@webex/webex-core';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';

describe('webex-core', () => {
  describe('WebexPlugin', () => {
    let webex;

    beforeEach(() => {
      webex = new MockWebex({});
    });

    /* eslint require-jsdoc: [0] */
    const MockPlugin = WebexPlugin.extend({
      namespace: 'mock',
    });

    describe('#config', () => {
      it('proxies to the namespace-appropriate part of the webex config object', () => {
        webex.config.mock = {};
        const mock = new MockPlugin({}, {parent: webex});

        assert.equal(mock.config, webex.config.mock);
      });
    });

    describe('#logger', () => {
      it('proxies to the webex.logger', () => {
        const mock = new MockPlugin({}, {parent: webex});

        assert.equal(mock.logger, webex.logger);
      });
    });

    describe('#webex', () => {
      it('returns the primary webex instance', () => {
        const mock = new MockPlugin({}, {parent: webex});

        assert.isDefined(mock.webex);
        assert.equal(mock.webex, webex);
      });
    });
  });
});
