/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import WebexCore, {WebexPlugin, registerInternalPlugin} from '@webex/webex-core';

describe('Webex', () => {
  describe('#internal', () => {
    it('grants plugins access to their namepace config', () => {
      registerInternalPlugin(
        'test',
        WebexPlugin.extend({
          namespace: 'test',
        }),
        {replace: true}
      );

      const webex = new WebexCore({
        config: {
          test: {
            reachable: true,
          },
        },
      });

      assert.isTrue(webex.internal.test.config.reachable);
      webex.config.test.reachable = false;
      assert.isFalse(webex.internal.test.config.reachable);
    });

    it('controls ready status', () => {
      registerInternalPlugin(
        'test',
        WebexPlugin.extend({
          namespace: 'test',
          session: {
            ready: {
              default: false,
              type: 'boolean',
            },
          },
        }),
        {replace: true}
      );

      const webex = new WebexCore({
        config: {
          test: {
            reachable: true,
          },
        },
      });

      webex.internal.on('all', (ev) =>
        console.info(
          'YYY',
          ev,
          webex.credentials.ready,
          webex.internal.test.ready,
          webex.internal.ready,
          webex.ready
        )
      );

      const changeSpy = sinon.spy();

      webex.on('change:ready', changeSpy);

      const readySpy = sinon.spy();

      webex.on('ready', readySpy);

      assert.isFalse(webex.internal.test.ready);
      assert.isFalse(webex.internal.ready);
      assert.isFalse(webex.ready);

      return new Promise((resolve) => webex.once('loaded', resolve)).then(() => {
        assert.isFalse(webex.internal.test.ready);
        assert.isFalse(webex.internal.ready);
        assert.isFalse(webex.ready);
        webex.internal.test.ready = true;
        assert.isTrue(webex.internal.ready);
        assert.isTrue(webex.ready);
        assert.called(changeSpy);
        assert.called(readySpy);
      });
    });
  });
});
