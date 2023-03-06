/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import WebexCore, {MemoryStoreAdapter, registerPlugin, WebexPlugin} from '@webex/webex-core';
import {set} from 'lodash';
import {version} from '@webex/webex-core/package';

describe('Webex', () => {
  let webex;

  beforeEach(() => {
    webex = new WebexCore();
  });

  describe('#logger', () => {
    it('exists', () => {
      assert.property(webex, 'logger');
      assert.doesNotThrow(() => {
        webex.logger.log('test');
      });
    });
  });

  describe('.config.fedramp', () => {
    it('exists', () => {
      assert.property(webex.config, 'fedramp');
    });
  });

  describe('.version', () => {
    it.skip('exists', () => {
      assert.property(WebexCore, 'version');
      assert.equal(WebexCore.version, version);
    });
  });

  describe('#version', () => {
    it.skip('exists', () => {
      assert.property(webex, 'version');
      assert.equal(webex.version, version);
    });
  });

  describe('#credentials', () => {
    describe('#version', () => {
      it.skip('exists', () => {
        assert.property(webex, 'credentials');
        assert.property(webex.credentials, 'version');
        assert.equal(webex.credentials.version, version);
      });
    });
  });

  describe('#initialize()', () => {
    it('initializes without arguments', () => {
      let webex;

      assert.doesNotThrow(() => {
        webex = new WebexCore();
      });
      assert.isFalse(webex.canAuthorize);
      assert.property(webex, 'credentials');
      assert.property(webex, 'canAuthorize');
      assert.property(webex.credentials, 'canAuthorize');
      assert.isFalse(webex.credentials.canAuthorize);
      assert.isFalse(webex.canAuthorize);
    });

    [
      'data',
      'data.access_token',
      'data.supertoken',
      'data.supertoken.access_token',
      'data.authorization',
      'data.authorization.supertoken',
      'data.authorization.supertoken.access_token',
      'data.credentials',
      'data.credentials.access_token',
      'data.credentials.supertoken',
      'data.credentials.supertoken.access_token',
      'data.credentials.authorization',
      'data.credentials.authorization.access_token',
      'data.credentials.authorization.supertoken',
      'data.credentials.authorization.supertoken.access_token',
    ]
      .reduce(
        (acc, path) =>
          acc.concat(
            ['ST', 'Bearer ST'].map((str) => {
              const obj = {
                msg: `accepts token string "${str}" at path "${path
                  .split('.')
                  .slice(1)
                  .join('.')}"`,
              };

              set(obj, path, str);

              return obj;
            })
          ),
        []
      )
      .forEach(({msg, data}) => {
        it(msg, () => {
          const webex = new WebexCore(data);

          assert.isTrue(webex.credentials.canAuthorize);
          assert.equal(webex.credentials.supertoken.access_token, 'ST');
          assert.equal(webex.credentials.supertoken.token_type, 'Bearer');
          assert.isTrue(webex.canAuthorize);
        });
      });
  });

  describe('initializes with Bearer Token', () => {
    [
      ['initializes with a correctly formatted token', 'Bearer 1234'],
      [
        'initializes and removes extra space from a token that has an extra space after Bearer',
        'Bearer  1234',
      ],
      [
        'initializes and adds a space after Bearer from a token that has no spaces after Bearer',
        'Bearer1234',
      ],
      [
        'initializes and trims whitespace from a token that has spaces before Bearer and after token',
        ' Bearer 1234 ',
      ],
      [
        'initializes and removes extra space and trims whitespace from a token that has spaces before and after Bearer and after token',
        ' Bearer  1234 ',
      ],
      [
        'initializes and trims whitspace and adds a space after Bearer from a token that has spaces before Bearer and after token and no spaces after Bearer',
        ' Bearer1234 ',
      ],
    ].forEach(([msg, token]) => {
      it(msg, () => {
        const webex = new WebexCore({
          credentials: {
            access_token: token,
          },
        });

        assert.isTrue(webex.credentials.canAuthorize);
        assert.equal(webex.credentials.supertoken.access_token, '1234');
        assert.equal(webex.credentials.supertoken.token_type, 'Bearer');
        assert.isTrue(webex.canAuthorize);
      });
    });
  });

  describe('#setConfig()', () => {
    it('updates the config', () => {
      const config = {credentials: {prop: true}};

      const webex = new WebexCore();

      assert.isUndefined(webex.config.credentials.prop);

      webex.setConfig(config);

      assert.isTrue(webex.config.credentials.prop);
    });
  });

  it('emits the `loaded` event when the storage layer has loaded all data', () => {
    // I'd love to do this with mock webex, or at least, a mock plugin, but I
    // couldn't get it to work. We do get better coverage this way, but it means
    // that the storage tests are dependent on the credentials implementation.
    const webex = new WebexCore({
      config: {
        storage: {
          boundedAdapter: MemoryStoreAdapter.preload({
            Credentials: {
              '@': {
                supertoken: {
                  // eslint-disable-next-line camelcase
                  access_token: 'AT',
                },
              },
            },
          }),
        },
      },
    });

    assert.isFalse(webex.loaded);
    assert.isFalse(webex.canAuthorize);

    return new Promise((resolve) => {
      webex.once('loaded', resolve);
    }).then(() => {
      assert.isTrue(webex.loaded);
      assert.equal(webex.credentials.supertoken.access_token, 'AT');
      assert.isTrue(webex.canAuthorize);
    });
  });

  it('emits the ready event when the storage layer has loaded and all plugins signal ready', () => {
    const webex = new WebexCore();

    assert.isFalse(webex.ready);

    return new Promise((resolve) => {
      webex.once('ready', resolve);
    }).then(() => assert.isTrue(webex.ready));
  });

  it('allows plugins to control ready status', () => {
    registerPlugin(
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

    const webex = new WebexCore();

    const changeSpy = sinon.spy();

    webex.on('change:ready', changeSpy);

    const readySpy = sinon.spy();

    webex.on('ready', readySpy);

    assert.isFalse(webex.test.ready);
    assert.isFalse(webex.ready);

    return new Promise((resolve) => webex.once('loaded', resolve)).then(() => {
      assert.isFalse(webex.ready);
      assert.isFalse(webex.test.ready);
      webex.test.ready = true;
      assert.isTrue(webex.test.ready);
      assert.isTrue(webex.ready);
      assert.called(changeSpy);
      assert.called(readySpy);
    });
  });
});
