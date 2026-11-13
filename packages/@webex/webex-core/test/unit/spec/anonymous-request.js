/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import WebexCore, {
  AuthInterceptor,
  CatalogUrlInterceptor,
  WebexPlugin,
  registerPlugin,
} from '@webex/webex-core';
import DefaultLogger from '@webex/webex-core/dist/plugins/logger';

const PATH = '/wbxappapi/v1/meetingInfo';
const TARGET = `https://site.example.com${PATH}`;
const SOURCE = `https://trusted.example.test${PATH}`;
const DOMAINS = ['example.com'];

const assertNoSdkBearer = (options) => {
  assert.isFalse(Object.values(options.headers).some((value) => value === 'Bearer user-token'));
  assert.strictEqual(options.addAuthHeader, false);
  assert.strictEqual(options.shouldRefreshAccessToken, false);
};

const createMock = () => ({
  config: {services: {allowedWithoutAuthHeader: DOMAINS}},
  credentials: {
    getUserToken: sinon.stub().resolves({toString: () => 'Bearer user-token'}),
    refresh: sinon.stub().resolves(),
    canRefresh: true,
  },
  internal: {
    services: {
      validateDomains: true,
      getServiceFromUrl: sinon.stub().returns(undefined),
      hasAllowedDomains: sinon.stub().returns(false),
      isAllowedDomainUrl: sinon.stub().returns(false),
      waitForService: sinon.stub().resolves(SOURCE),
    },
  },
  logger: {info: sinon.stub(), warn: sinon.stub()},
});

const authorize = (options, domains, services) => {
  const webex = createMock();
  webex.config.services.allowedWithoutAuthHeader = domains;
  if (services) {
    webex.internal.services = services;
  }
  return Reflect.apply(AuthInterceptor.create, webex, []).onRequest(options);
};

describe('anonymous domain fallback', () => {
  afterEach(() => sinon.restore());

  describe('shared domain policy', () => {
    [
      `https://example.com${PATH}`,
      TARGET,
      'https://nested.site.example.com/another/path?format=json',
      `https://SITE.EXAMPLE.COM:443${PATH}`,
      `https://site.example.com.${PATH}`,
      'http://site.example.com:8080/another/path',
    ].forEach((uri) => {
      it(`uses ordinary domain matching for ${uri}`, async () => {
        const options = {uri, headers: {}};

        await authorize(options, DOMAINS);
        assertNoSdkBearer(options);
      });
    });

    [
      `https://example.com.attacker.test${PATH}`,
      `https://notexample.com${PATH}`,
      `https://%73ite.example.com${PATH}`,
      'not a URL',
      undefined,
    ].forEach((uri) => {
      it(`does not grant new permission to ${uri}`, async () => {
        const options = {uri, headers: {Authorization: 'Bearer explicit'}};

        await authorize(options, DOMAINS);
        assert.deepEqual(options, {uri, headers: {Authorization: 'Bearer explicit'}});
      });
    });

    [undefined, [], null, ['another.test']].forEach((domains) => {
      it(`preserves existing behavior for unmatched configuration ${JSON.stringify(
        domains
      )}`, async () => {
        const options = {uri: TARGET, headers: {Authorization: 'Bearer explicit'}};

        await authorize(options, domains);
        assert.deepEqual(options, {uri: TARGET, headers: {Authorization: 'Bearer explicit'}});
      });
    });

    it('uses existing domain normalization without a separate schema', async () => {
      const options = {url: TARGET};

      await authorize(options, [null, 42, 'EXAMPLE.COM.']);
      assertNoSdkBearer(options);
    });

    ['catalog', 'allowedDomains'].forEach((trust) => {
      it(`preserves existing ${trust} credential trust on an overlapping domain`, async () => {
        const webex = createMock();
        const services = webex.internal.services;
        if (trust === 'catalog') {
          services.getServiceFromUrl.returns({name: 'home'});
        } else {
          services.hasAllowedDomains.returns(true);
          services.isAllowedDomainUrl.returns(true);
        }
        const options = {uri: TARGET, headers: {authorization: 'Bearer trusted'}};

        await authorize(options, DOMAINS, services);
        assert.deepEqual(options, {uri: TARGET, headers: {authorization: 'Bearer trusted'}});
      });
    });

    it('does not grant disabled ordinary domain trust precedence', async () => {
      const services = createMock().internal.services;
      services.validateDomains = false;
      services.hasAllowedDomains.returns(true);
      services.isAllowedDomainUrl.returns(true);
      const options = {uri: TARGET};

      await authorize(options, DOMAINS, services);
      assertNoSdkBearer(options);
    });

    it('removes bearer headers from a redirect and preserves source headers', async () => {
      const webex = createMock();
      webex.internal.services.getServiceFromUrl.callsFake((uri) =>
        uri === SOURCE ? {name: 'home'} : undefined
      );
      const auth = Reflect.apply(AuthInterceptor.create, webex, []);
      const source = {
        uri: SOURCE,
        headers: {accept: 'application/json', 'x-context': 'Bearer metadata'},
      };

      await auth.onRequest(source);
      source.headers.Authorization = 'Basic caller';
      source.headers.AUTHORIZATION = 'Bearer caller-uppercase';
      const redirected = {...source, uri: TARGET};

      await auth.onRequest(redirected);
      assertNoSdkBearer(redirected);
      assert.deepEqual(redirected.headers, {
        accept: 'application/json',
        'x-context': 'Bearer metadata',
        Authorization: 'Basic caller',
      });
      assert.deepEqual(source.headers, {
        accept: 'application/json',
        'x-context': 'Bearer metadata',
        authorization: 'Bearer user-token',
        Authorization: 'Basic caller',
        AUTHORIZATION: 'Bearer caller-uppercase',
      });
      assert.calledOnceWithExactly(webex.credentials.getUserToken);
    });

    ['Bearer caller', 'Bearer user-token', 'bEaReR caller'].forEach((authorization) => {
      it(`strips supplied bearer Authorization ${authorization}`, async () => {
        const webex = createMock();
        const auth = Reflect.apply(AuthInterceptor.create, webex, []);
        const headers = {authorization};
        const options = {uri: TARGET, headers};

        await auth.onRequest(options);
        assert.deepEqual(options.headers, {});
        assert.deepEqual(headers, {authorization});
        assertNoSdkBearer(options);
        assert.notCalled(webex.credentials.getUserToken);
      });
    });

    it('preserves a caller-supplied Basic authorization header', async () => {
      const webex = createMock();
      const auth = Reflect.apply(AuthInterceptor.create, webex, []);
      const options = {uri: TARGET, headers: {authorization: 'Basic caller'}};

      await auth.onRequest(options);
      assert.deepEqual(options.headers, {authorization: 'Basic caller'});
      assertNoSdkBearer(options);
      assert.notCalled(webex.credentials.getUserToken);
    });

    it('strips a caller replacement bearer on a fallback redirect', async () => {
      const webex = createMock();
      webex.internal.services.getServiceFromUrl.callsFake((uri) =>
        uri === SOURCE ? {name: 'home'} : undefined
      );
      const auth = Reflect.apply(AuthInterceptor.create, webex, []);
      const source = {uri: SOURCE};
      await auth.onRequest(source);
      source.headers.authorization = 'Bearer caller-replacement';
      const redirected = {...source, uri: TARGET};

      await auth.onRequest(redirected);
      assert.deepEqual(redirected.headers, {});
      assertNoSdkBearer(redirected);
      assert.calledOnceWithExactly(webex.credentials.getUserToken);
    });

    ['user', 'user:password'].forEach((userinfo) => {
      it(`does not add a URL-credential policy for ${userinfo}`, async () => {
        const uri = `https://${userinfo}@site.example.com${PATH}`;
        const options = {uri};

        await authorize(options, DOMAINS);
        assert.equal(options.uri, uri);
        assertNoSdkBearer(options);
      });
    });
  });

  describe('interceptor contracts', () => {
    it('skips SDK token lookup and refresh for a request-only domain', async () => {
      const webex = createMock();
      const auth = Reflect.apply(AuthInterceptor.create, webex, []);
      const options = {uri: TARGET};

      await auth.onRequest(options).then((result) => assert.strictEqual(result, options));
      assertNoSdkBearer(options);
      assert.isFalse(await auth.shouldAttemptReauth({statusCode: 401}, options));
      assert.notCalled(webex.credentials.getUserToken);
      assert.notCalled(webex.internal.services.waitForService);
    });

    it('admits an anonymous fallback without adding catalog or credential trust', async () => {
      const webex = createMock();
      const catalog = Reflect.apply(CatalogUrlInterceptor.create, webex, []);
      const options = {uri: TARGET};

      await catalog.onRequest(options).then((result) => assert.strictEqual(result, options));
      assert.deepEqual(options, {uri: TARGET});
      assert.isFalse(webex.internal.services.isAllowedDomainUrl(TARGET));
    });
  });

  describe('normal SDK request pipeline', () => {
    const QuietLogger = WebexPlugin.extend({
      namespace: 'Logger',
      error() {},
      warn() {},
      info() {},
      debug() {},
      log() {},
      trace() {},
    });
    beforeAll(() => registerPlugin('logger', QuietLogger, {replace: true}));
    afterAll(() => registerPlugin('logger', DefaultLogger, {replace: true}));

    const createCore = async (configuration = {}) => {
      const {services, ...rest} = configuration;
      const webex = new WebexCore({
        config: {
          fedramp: true,
          ...rest,
          services: {
            skipPreauthCatalogOnUnauthenticated: true,
            validateCatalogUrls: true,
            allowedWithoutAuthHeader: DOMAINS,
            ...services,
          },
        },
      });
      sinon
        .stub(webex.internal.services, 'getServiceFromUrl')
        .callsFake((url) =>
          url?.startsWith('https://trusted.example.test/') ? {name: 'trusted'} : undefined
        );
      sinon.stub(webex.internal.services, 'waitForService').resolves(SOURCE);
      sinon.stub(webex.internal.services, 'hasAllowedDomains').returns(false);
      sinon.stub(webex.internal.services, 'isAllowedDomainUrl').returns(false);
      sinon.stub(webex.internal.services, 'replaceHostFromHostmap').callsFake((url) => url);
      sinon.stub(webex.credentials, 'getUserToken').resolves({toString: () => 'Bearer user-token'});
      if (!webex.loaded) {
        await new Promise((resolve) => webex.once('loaded', resolve));
      }
      return webex;
    };

    const respond = (options) => ({statusCode: 200, headers: {}, body: {ok: true}, options});

    [true, false].forEach((validateCatalogUrls) => {
      it(`skips SDK bearer but preserves other caller authentication with catalog validation ${validateCatalogUrls}`, async () => {
        const webex = await createCore({
          services: {validateCatalogUrls},
          defaultRequestOptions: {
            auth: {user: 'default', pass: 'password'},
            oauth: {token: 'oauth-token'},
            hawk: {credentials: {key: 'hawk-key'}},
            httpSignature: {key: 'signature-key'},
            aws: {key: 'aws-key'},
          },
        });
        const transport = sinon.spy((options) => {
          assertNoSdkBearer(options);
          assert.deepEqual(options.auth, {user: 'default', pass: 'password'});
          assert.deepEqual(options.oauth, {token: 'oauth-token'});
          assert.deepEqual(options.hawk, {credentials: {key: 'hawk-key'}});
          assert.deepEqual(options.httpSignature, {key: 'signature-key'});
          assert.deepEqual(options.aws, {key: 'aws-key'});
          assert.equal(options.headers.Authorization, 'Basic supplied');
          return respond(options);
        });

        await webex.request({
          uri: TARGET,
          headers: {Authorization: 'Basic supplied'},
          request: transport,
        });
        assert.calledOnce(transport);
        assert.notCalled(webex.credentials.getUserToken);
      });
    });

    it('retains automatic auth for a catalogued home site covered by the new domain list', async () => {
      const webex = await createCore();
      const home = `https://home.example.com${PATH}`;
      webex.internal.services.getServiceFromUrl.callsFake((url) =>
        [home, SOURCE].includes(url) ? {name: 'home'} : undefined
      );
      const options = {uri: home};

      await webex.prepareFetchOptions(options);
      assert.equal(options.headers.authorization, 'Bearer user-token');
      assert.calledOnceWithExactly(webex.credentials.getUserToken);
    });

    it('retains automatic auth for an ordinary allowed domain covered by the new list', async () => {
      const webex = await createCore();
      webex.internal.services.hasAllowedDomains.returns(true);
      webex.internal.services.isAllowedDomainUrl.returns(true);
      const options = {uri: TARGET};

      await webex.prepareFetchOptions(options);
      assert.equal(options.headers.authorization, 'Bearer user-token');
      assert.calledOnceWithExactly(webex.credentials.getUserToken);
    });

    it('keeps an anonymous request anonymous through downstream host mapping', async () => {
      const webex = await createCore();
      const mapped = `https://routed.example.com${PATH}`;
      webex.internal.services.replaceHostFromHostmap.returns(mapped);
      const options = {uri: TARGET};

      await webex.prepareFetchOptions(options);
      assert.equal(options.uri, mapped);
      assertNoSdkBearer(options);
      assert.notCalled(webex.credentials.getUserToken);
    });

    it('uses the existing interceptor chain with the anonymous domain list configured', async () => {
      const normal = await createCore({services: {allowedWithoutAuthHeader: []}});
      const anonymous = await createCore();
      const normalOptions = {uri: SOURCE};
      const anonymousOptions = {uri: TARGET};

      await normal.prepareFetchOptions(normalOptions);
      await anonymous.prepareFetchOptions(anonymousOptions);

      assert.deepEqual(
        anonymousOptions.interceptors.map((interceptor) => interceptor.constructor.name),
        normalOptions.interceptors.map((interceptor) => interceptor.constructor.name)
      );
      assertNoSdkBearer(anonymousOptions);
    });

    ['header', 'locus', 'appapi'].forEach((redirectType) => {
      it(`strips inherited auth on ${redirectType} redirect to a request-only domain`, async () => {
        const webex = await createCore();
        const sent = [];
        const transport = sinon.spy((options) => {
          sent.push({uri: options.uri, headers: {...options.headers}});
          if (options.uri === SOURCE) {
            const response = {statusCode: 200, headers: {}, body: {}, options};
            if (redirectType === 'header') {
              response.headers['cisco-location'] = TARGET;
            } else if (redirectType === 'locus') {
              response.body = {errorCode: 2000002, location: TARGET};
            } else {
              response.statusCode = 404;
              response.body = {code: 404100, data: {siteFullUrl: 'site.example.com'}};
            }
            return response;
          }
          assertNoSdkBearer(options);
          return respond(options);
        });

        await webex.request({uri: SOURCE, method: 'POST', request: transport});
        assert.equal(sent.length, 2);
        assert.equal(sent[0].headers.authorization, 'Bearer user-token');
        assert.isFalse(
          Object.keys(sent[1].headers).some((name) => name.toLowerCase() === 'authorization')
        );
        assert.calledOnceWithExactly(webex.credentials.getUserToken);
      });
    });

    it('keeps the bearer absent across two fallback redirects', async () => {
      const webex = await createCore();
      const final = `https://other.example.com${PATH}`;
      const sent = [];
      const transport = sinon.spy((options) => {
        sent.push({uri: options.uri, headers: {...options.headers}});
        if (options.uri === SOURCE) {
          return {...respond(options), headers: {'cisco-location': TARGET}};
        }
        assertNoSdkBearer(options);
        if (options.uri === TARGET) {
          return {...respond(options), headers: {'cisco-location': final}};
        }
        return respond(options);
      });

      await webex.request({uri: SOURCE, request: transport});
      assert.deepEqual(
        sent.map(({uri}) => uri),
        [SOURCE, TARGET, final]
      );
      assert.equal(sent[0].headers.authorization, 'Bearer user-token');
      sent.slice(1).forEach(({headers}) => assert.notProperty(headers, 'authorization'));
      assert.calledOnceWithExactly(webex.credentials.getUserToken);
    });

    it('blocks a redirect outside all allowed domains', async () => {
      const webex = await createCore();
      const transport = sinon.spy((options) => ({
        statusCode: 200,
        headers: {'cisco-location': `https://example.com.attacker.test${PATH}`},
        body: {},
        options,
      }));

      await assert.isRejected(webex.request({uri: TARGET, request: transport}), /Request blocked/);
      assert.calledOnce(transport);
      assert.notCalled(webex.credentials.getUserToken);
    });

    it('does not refresh credentials after an anonymous401', async () => {
      const webex = await createCore();
      const refresh = sinon.stub(webex.credentials, 'refresh').resolves();
      const transport = sinon.spy((options) => ({statusCode: 401, headers: {}, body: {}, options}));

      await assert.isRejected(webex.request({uri: TARGET, request: transport}));
      assert.calledOnce(transport);
      assert.notCalled(webex.credentials.getUserToken);
      assert.notCalled(refresh);
    });

    ['request', 'prepareFetchOptions'].forEach((method) => {
      it(`leaves URL credentials unchanged through ${method}`, async () => {
        const webex = await createCore();
        const uri = `https://user:password@site.example.com${PATH}`;
        const options = {uri, request: respond};

        await webex[method](options);
        assert.equal(options.uri, uri);
        assertNoSdkBearer(options);
        assert.notCalled(webex.credentials.getUserToken);
      });
    });

    it('leaves the existing custom chain unchanged when the new list is empty', async () => {
      const webex = await createCore({interceptors: {}, services: {allowedWithoutAuthHeader: []}});
      const options = {uri: TARGET, headers: {Authorization: 'Bearer explicit'}};

      await webex.prepareFetchOptions(options);
      assert.deepEqual(options.interceptors, []);
      assert.equal(options.headers.Authorization, 'Bearer explicit');
    });
  });
});
