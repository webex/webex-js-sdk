/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {EventEmitter} from 'events';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import WebexCore, {
  MemoryStoreAdapter,
  registerPlugin,
  WebexPlugin,
  PayloadTransformerInterceptor,
  RequestTimingInterceptor,
} from '@webex/webex-core';
import {set} from 'lodash';
import {version} from '@webex/webex-core/package';
import {proxyEvents} from '@webex/common/src/events';
// TODO:  fix circular dependency core->metrics->core https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-515520
require('@webex/internal-plugin-metrics');

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

  describe('#request', () => {
    it('exists', () => {
      assert.property(webex, 'request');
    });
  });

  describe('#prepareFetchOptions', () => {
    it('exists', () => {
      assert.property(webex, 'prepareFetchOptions');
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

  describe('initializes with interceptors', () => {
    [
      // 4 pre, 4 post, 10 remaining default = 18
      [
        'defaults to existing interceptors if undefined',
        undefined,
        18,
        [
          'RequestTimingInterceptor',
          'RequestEventInterceptor',
          'WebexTrackingIdInterceptor',
          'RateLimitInterceptor',
          'ServiceInterceptor',
          'UserAgentInterceptor',
          'ProxyInterceptor',
          'WebexUserAgentInterceptor',
          'AuthInterceptor',
          'PayloadTransformerInterceptor',
          'RedirectInterceptor',
          'DefaultOptionsInterceptor',
          'HostMapInterceptor',
          'ServerErrorInterceptor',
          'HttpStatusInterceptor',
          'NetworkTimingInterceptor',
          'EmbargoInterceptor',
          'RateLimitInterceptor',
        ],
      ],
      [
        'only adds PayloadTransformerInterceptor',
        {interceptors: {PayloadTransformerInterceptor: PayloadTransformerInterceptor.create}},
        1,
        ['PayloadTransformerInterceptor'],
      ],
      [
        'adds multiple interceptors',
        {
          interceptors: {
            PayloadTransformerInterceptor: PayloadTransformerInterceptor.create,
            RequestTimingInterceptor: RequestTimingInterceptor.create,
          },
        },
        2,
        ['PayloadTransformerInterceptor', 'RequestTimingInterceptor'],
      ],
      [
        'adds no interceptors',
        {
          interceptors: [],
        },
        0,
        [],
      ],
    ].forEach(
      ([message, interceptorsConfig, expectedNumberOfInterceptors, expectedInterceptorNames]) => {
        it(message, async () => {
          const requestOptions = {method: 'GET', url: 'https://fake-url.webex.com'};
          const webex = new WebexCore({
            config: interceptorsConfig,
          });
          try {
            await webex.request(requestOptions);
          } catch (error) {
          } finally {
            assert.equal(requestOptions.interceptors.length, expectedNumberOfInterceptors);
            assert.deepEqual(
              requestOptions.interceptors.map((int) => int.constructor.name),
              expectedInterceptorNames
            );
          }
        });
      }
    );
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

  describe('#upload()', () => {
    it('rejects when no object is specified', () => {
      return webex.upload().catch((err) => {
        assert.equal(err.message, '`options.file` is required');
      });
    });

    it('rejects when no file is specified', () => {
      return webex.upload({}).catch((err) => {
        assert.equal(err.message, '`options.file` is required');
      });
    });

    it('passes through progress events to caller', () => {
      const uploadEventEmitter = new EventEmitter();

      webex._uploadPhaseInitialize = sinon.stub().callsFake(() => {
        return Promise.resolve();
      });
      webex._uploadPhaseUpload = sinon.stub().callsFake(() => {
        const promise = Promise.resolve();

        proxyEvents(uploadEventEmitter, promise);

        return promise;
      });
      webex._uploadPhaseFinalize = sinon.stub().callsFake(() => {
        return Promise.resolve({
          body: {
            url: 'https://example.com/download',
          },
          headers: {
            'Content-Type': 'image/png',
          },
        });
      });

      const uploader = webex.upload({file: {}});

      assert.isFunction(uploader.on);

      return uploader.then((res) => {
        const progressStub = sinon.stub();
        uploader.on('progress', progressStub);

        uploadEventEmitter.emit('progress', {percent: 25});

        assert.isTrue(progressStub.calledOnce);
        assert.isTrue(webex._uploadPhaseInitialize.calledOnce);
        assert.isTrue(webex._uploadPhaseUpload.calledOnce);
        assert.isTrue(webex._uploadPhaseFinalize.calledOnce);
        assert.equal(res.url, 'https://example.com/download');
        assert.equal(res['Content-Type'], 'image/png');
      });
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
      // Set services.ready to true since it now blocks webex.ready
      webex.internal.services.ready = true;
      webex.test.ready = true;
      assert.isTrue(webex.test.ready);
      assert.isTrue(webex.ready);
      assert.called(changeSpy);
      assert.called(readySpy);
    });
  });
});
