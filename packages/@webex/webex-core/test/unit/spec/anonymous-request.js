/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import Url from 'url';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import WebexCore, {
  AuthInterceptor,
  CatalogUrlInterceptor,
  DefaultOptionsInterceptor,
  RedirectInterceptor,
  WebexPlugin,
  registerPlugin,
} from '@webex/webex-core';
import DefaultLogger from '@webex/webex-core/dist/plugins/logger';
import AnonymousRequestInterceptor from '@webex/webex-core/src/interceptors/anonymous-request';
import {
  applyAnonymousRequestPolicy,
  hasAnonymousRequestRules,
  isAnonymousRequest,
} from '@webex/webex-core/src/lib/anonymous-request';

const PATH = '/wbxappapi/v1/meetingInfo';
const TARGET = `https://site.example.com${PATH}`;
const SOURCE = `https://trusted.example.test${PATH}`;
const RULES = [{domain: 'example.com', paths: [PATH]}];

const assertAnonymous = (options) => {
  assert.isFalse(
    Object.keys(options.headers).some((name) => name.toLowerCase() === 'authorization')
  );
  ['auth', 'oauth', 'hawk', 'httpSignature', 'aws'].forEach((key) => {
    assert.strictEqual(options[key], false);
  });
  assert.strictEqual(options.addAuthHeader, false);
  assert.strictEqual(options.shouldRefreshAccessToken, false);
};

const createMock = () => ({
  config: {services: {allowedWithoutAuthHeader: RULES}},
  credentials: {
    getUserToken: sinon.stub().resolves({toString: () => 'Bearer user-token'}),
    refresh: sinon.stub().resolves(),
    canRefresh: true,
  },
  internal: {
    services: {
      validateDomains: true,
      getServiceFromUrl: sinon.stub().returns({name: 'trusted'}),
      hasAllowedDomains: sinon.stub().returns(true),
      isAllowedDomainUrl: sinon.stub().returns(true),
      waitForService: sinon.stub().resolves(SOURCE),
    },
  },
  logger: {info: sinon.stub(), warn: sinon.stub()},
});

describe('anonymous request policy', () => {
  afterEach(() => sinon.restore());

  describe('endpoint rules', () => {
    [
      `https://example.com${PATH}`,
      TARGET,
      `https://nested.site.example.com${PATH}?format=json`,
      `https://SITE.EXAMPLE.COM:443${PATH}`,
      `https://site.example.com.${PATH}`,
    ].forEach((url) => {
      it(`matches the configured HTTPS endpoint ${url}`, () => {
        assert.isTrue(isAnonymousRequest(url, RULES));
      });
    });

    [
      `https://example.com.attacker.test${PATH}`,
      `https://notexample.com${PATH}`,
      `https://other.test${PATH}`,
      `${TARGET}/extra`,
      'https://site.example.com/wbxappapi/v1/users/me',
      'not a URL',
      undefined,
    ].forEach((url) => {
      it(`does not grant anonymous permission to ${url}`, () => {
        assert.isFalse(isAnonymousRequest(url, RULES));
      });
    });

    [
      `http://site.example.com${PATH}`,
      `ftp://site.example.com${PATH}`,
      `https://site.example.com:8443${PATH}`,
      `https://user@site.example.com${PATH}`,
      `https://user:password@site.example.com${PATH}`,
      `https://site.example.com/other/..${PATH}`,
      `https://site.example.com/other/%2e%2e${PATH}`,
    ].forEach((url) => {
      it(`rejects an unsafe form of a configured endpoint ${url}`, () => {
        assert.throws(() => isAnonymousRequest(url, RULES), /unsafe URL for an anonymous request/);
      });
    });

    [
      null,
      'example.com',
      {},
      [null],
      ['example.com'],
      [{domain: '*.example.com', paths: [PATH]}],
      [{domain: 'example.com/other', paths: [PATH]}],
      [{domain: 'example.com', paths: []}],
      [{domain: 'example.com', paths: ['relative']}],
      [{domain: 'example.com', paths: [`${PATH}?query=true`]}],
      [{domain: 'example.com', paths: [PATH, undefined]}],
    ].forEach((rules) => {
      it(`rejects malformed policy configuration ${JSON.stringify(rules)}`, () => {
        assert.throws(() => hasAnonymousRequestRules(rules), TypeError);
      });
    });

    it('preserves an unmatched request and supports an absent or empty configuration', () => {
      const options = {uri: SOURCE, headers: {Authorization: 'Bearer source-token'}};

      assert.isFalse(hasAnonymousRequestRules(undefined));
      assert.isFalse(hasAnonymousRequestRules([]));
      assert.isFalse(isAnonymousRequest(TARGET, []));
      assert.isFalse(applyAnonymousRequestPolicy(options, RULES));
      assert.deepEqual(options, {uri: SOURCE, headers: {Authorization: 'Bearer source-token'}});
    });

    it('serializes native URL input into the actual anonymous transport URI', () => {
      const uri = new URL(TARGET);
      Object.defineProperty(uri, 'href', {value: SOURCE});
      const options = {uri, headers: {Authorization: 'Bearer inherited'}};

      assert.isTrue(applyAnonymousRequestPolicy(options, RULES));
      assert.equal(options.uri, TARGET);
      assertAnonymous(options);
    });

    [
      Url.parse(TARGET),
      {href: TARGET, protocol: 'https:', hostname: 'attacker.test', pathname: PATH},
      {protocol: 'https:', hostname: 'site.example.com', pathname: PATH},
    ].forEach((uri) => {
      it(`rejects ambiguous transport URL objects ${JSON.stringify(uri)}`, () => {
        assert.throws(
          () =>
            applyAnonymousRequestPolicy({uri, headers: {Authorization: 'Bearer inherited'}}, RULES),
          /string or native URL/
        );
      });
    });

    [
      {baseUrl: 'https://site.example.com', uri: PATH},
      {baseUrl: 'https://site.example.com/', uri: PATH},
      {baseUrl: 'https://site.example.com', uri: PATH.slice(1)},
      {baseUrl: 'https://site.example.com/', uri: PATH.slice(1)},
      {baseUrl: TARGET, uri: ''},
    ].forEach((request) => {
      it(`checks the effective baseUrl destination ${JSON.stringify(request)}`, () => {
        const options = {...request, headers: {Authorization: 'Bearer inherited'}};

        assert.isTrue(applyAnonymousRequestPolicy(options, RULES));
        assert.equal(options.uri, TARGET);
        assert.strictEqual(options.baseUrl, false);
        assertAnonymous(options);
      });
    });

    it('removes every Authorization casing without mutating inherited source headers', () => {
      const headers = {
        authorization: 'Bearer inherited',
        Authorization: 'Bearer alternate',
        AUTHORIZATION: 'Basic credentials',
        'content-type': 'application/json',
      };
      const options = {url: TARGET, headers, auth: {user: 'user', pass: 'password'}};

      assert.isTrue(applyAnonymousRequestPolicy(options, RULES));
      assertAnonymous(options);
      assert.deepEqual(options.headers, {'content-type': 'application/json'});
      assert.deepEqual(headers, {
        authorization: 'Bearer inherited',
        Authorization: 'Bearer alternate',
        AUTHORIZATION: 'Basic credentials',
        'content-type': 'application/json',
      });
    });
  });

  describe('auth and catalog interceptors', () => {
    [
      {headers: {}},
      {headers: {authorization: 'Bearer inherited'}},
      {headers: {Authorization: 'Bearer alternate'}},
      {headers: {}, auth: {user: 'user', pass: 'password'}},
    ].forEach((credentials) => {
      it(`overrides catalog and domain auth trust for ${JSON.stringify(credentials)}`, async () => {
        const webex = createMock();
        const auth = Reflect.apply(AuthInterceptor.create, webex, []);
        const options = {uri: TARGET, ...credentials};

        await auth.onRequest(options);

        assertAnonymous(options);
        assert.notCalled(webex.credentials.getUserToken);
        assert.notCalled(webex.internal.services.getServiceFromUrl);
      });
    });

    it('does not retrieve or refresh a token for a direct credential/401 check', async () => {
      const webex = createMock();
      const auth = Reflect.apply(AuthInterceptor.create, webex, []);
      const options = {uri: TARGET, headers: {Authorization: 'Bearer inherited'}};
      const reason = {statusCode: 401, options};

      assert.isFalse(await auth.requiresCredentials({uri: TARGET}));
      assert.isFalse(await auth.shouldAttemptReauth(reason, options));
      await assert.isRejected(auth.onResponseError(options, reason));
      assertAnonymous(options);
      assert.notCalled(webex.credentials.getUserToken);
      assert.notCalled(webex.credentials.refresh);
    });

    it('preserves normal automatic authorization for unmatched endpoints', async () => {
      const webex = createMock();
      const auth = Reflect.apply(AuthInterceptor.create, webex, []);
      const options = {uri: SOURCE};

      await auth.onRequest(options);

      assert.deepEqual(options, {uri: SOURCE, headers: {authorization: 'Bearer user-token'}});
      assert.calledOnceWithExactly(webex.credentials.getUserToken);
    });

    it('admits an anonymous URL without adding it to catalog or domain trust', async () => {
      const webex = createMock();
      webex.internal.services.getServiceFromUrl.returns(undefined);
      webex.internal.services.isAllowedDomainUrl.returns(false);
      webex.internal.services.validateDomains = false;
      const catalog = Reflect.apply(CatalogUrlInterceptor.create, webex, []);
      const options = {uri: TARGET};

      await catalog.onRequest(options);

      assertAnonymous(options);
      assert.notCalled(webex.internal.services.getServiceFromUrl);
      assert.notCalled(webex.internal.services.isAllowedDomainUrl);
    });

    [
      `https://example.com.attacker.test${PATH}`,
      `${TARGET}/extra`,
      `https://unknown.test${PATH}`,
    ].forEach((uri) => {
      it(`does not grant catalog admission to ${uri}`, async () => {
        const webex = createMock();
        webex.internal.services.getServiceFromUrl.returns(undefined);
        webex.internal.services.hasAllowedDomains.returns(false);
        const catalog = Reflect.apply(CatalogUrlInterceptor.create, webex, []);

        await assert.isRejected(catalog.onRequest({uri}), /Request blocked/);
      });
    });

    [AuthInterceptor, CatalogUrlInterceptor, AnonymousRequestInterceptor].forEach((Interceptor) => {
      it(`prevents unsafe configured URLs regaining trust through ${Interceptor.name}`, async () => {
        const webex = createMock();
        const interceptor = Reflect.apply(Interceptor.create, webex, []);

        await assert.isRejected(
          Promise.resolve().then(() =>
            interceptor.onRequest({uri: `https://user@site.example.com${PATH}`})
          ),
          /unsafe URL for an anonymous request/
        );
        assert.notCalled(webex.credentials.getUserToken);
        assert.notCalled(webex.internal.services.getServiceFromUrl);
      });
    });
  });

  describe('complete request pipeline', () => {
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
            allowedWithoutAuthHeader: RULES,
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

    const respond = (options, body = {ok: true}) => ({
      statusCode: 200,
      headers: {},
      body,
      options,
    });

    [true, false].forEach((validateCatalogUrls) => {
      it(`keeps requests anonymous with catalog validation ${validateCatalogUrls}`, async () => {
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
          assertAnonymous(options);

          return respond(options);
        });

        await webex.request({
          uri: TARGET,
          headers: {Authorization: 'Bearer explicit'},
          request: transport,
        });

        assert.calledOnce(transport);
        assert.notCalled(webex.credentials.getUserToken);
      });
    });

    it('sanitizes the final destination after a late host rewrite', async () => {
      const webex = await createCore();
      webex.internal.services.replaceHostFromHostmap.returns(TARGET);
      const options = {uri: SOURCE};

      await webex.prepareFetchOptions(options);

      assert.equal(options.uri, TARGET);
      assertAnonymous(options);
      assert.calledOnceWithExactly(webex.credentials.getUserToken);
    });

    it('enforces the final safeguard after custom interceptors inject credentials', async () => {
      const webex = await createCore({
        interceptors: {
          injectCredentials() {
            return {
              logOptions() {},
              onRequest(options) {
                options.headers.Authorization = 'Bearer late';
                options.auth = {user: 'late', pass: 'password'};
                options.oauth = {token: 'late-oauth-token'};
                options.aws = {key: 'late-aws-key'};

                return options;
              },
            };
          },
          DefaultOptionsInterceptor: DefaultOptionsInterceptor.create,
        },
      });
      const options = {uri: TARGET};

      await webex.prepareFetchOptions(options);

      assertAnonymous(options);
      assert.equal(options.interceptors.at(-1).constructor.name, 'AnonymousRequestInterceptor');
    });

    ['request', 'prepareFetchOptions'].forEach((method) => {
      it(`retains anonymous enforcement with per-request replacement for ${method}`, async () => {
        const webex = await createCore();
        const options = {
          uri: TARGET,
          headers: {Authorization: 'Bearer caller'},
          auth: {user: 'user', pass: 'password'},
          interceptors: [
            {
              logOptions() {},
              onRequest(request) {
                request.headers.AUTHORIZATION = 'Bearer injected';
                request.hawk = {credentials: {key: 'late-key'}};

                return request;
              },
            },
          ],
          request: (request) => respond(request),
        };

        await webex[method](options);

        assertAnonymous(options);
        assert.equal(options.interceptors.at(-1).constructor.name, 'AnonymousRequestInterceptor');
        assert.notCalled(webex.credentials.getUserToken);
      });
    });

    it('enforces no-auth after Node baseUrl resolution with a replaced request chain', async () => {
      const webex = await createCore();
      const transport = sinon.spy((options) => {
        assert.equal(options.uri, TARGET);
        assert.strictEqual(options.baseUrl, false);
        assertAnonymous(options);

        return respond(options);
      });

      await webex.request({
        baseUrl: 'https://site.example.com',
        uri: PATH,
        headers: {Authorization: 'Bearer supplied'},
        interceptors: [],
        request: transport,
      });

      assert.calledOnce(transport);
    });

    it('supports URI-string shorthand and native URL request options', async () => {
      const webex = await createCore();
      const transport = sinon.spy((options) => {
        assert.equal(options.uri, TARGET);
        assertAnonymous(options);

        return respond(options);
      });

      await webex.request(TARGET, {
        request: transport,
        headers: {Authorization: 'Bearer inherited'},
      });
      await webex.request({url: new URL(TARGET), request: transport});

      assert.calledTwice(transport);
      assert.notCalled(webex.credentials.getUserToken);
    });

    it('supports adding, replacing, and clearing anonymous rules through setConfig', async () => {
      const webex = await createCore({services: {allowedWithoutAuthHeader: []}});
      const replacement = [{domain: 'other.test', paths: ['/public']}];

      webex.setConfig({services: {allowedWithoutAuthHeader: RULES}});
      const anonymous = {uri: SOURCE};
      webex.internal.services.replaceHostFromHostmap.returns(TARGET);
      await webex.prepareFetchOptions(anonymous);
      assertAnonymous(anonymous);

      webex.setConfig({services: {allowedWithoutAuthHeader: replacement}});
      replacement[0].paths.push('/mutated-after-update');
      assert.deepEqual(webex.config.services.allowedWithoutAuthHeader, [
        {domain: 'other.test', paths: ['/public']},
      ]);

      webex.setConfig({services: {allowedWithoutAuthHeader: []}});
      webex.internal.services.replaceHostFromHostmap.returns(SOURCE);
      const authenticated = {uri: SOURCE};
      await webex.prepareFetchOptions(authenticated);
      assert.equal(authenticated.headers.authorization, 'Bearer user-token');
      assert.isFalse(
        authenticated.interceptors.some(
          (item) => item.constructor.name === 'AnonymousRequestInterceptor'
        )
      );
    });

    it('rejects invalid rule updates without changing the active policy', async () => {
      const webex = await createCore();

      assert.throws(
        () => webex.setConfig({services: {allowedWithoutAuthHeader: ['example.com']}}),
        TypeError
      );
      assert.deepEqual(webex.config.services.allowedWithoutAuthHeader, RULES);
    });

    ['header', 'locus', 'appapi'].forEach((redirectType) => {
      it(`rechecks and strips inherited auth on ${redirectType} redirect replay`, async () => {
        const webex = await createCore();
        const sent = [];
        const transport = sinon.spy((options) => {
          sent.push({uri: options.uri, headers: {...options.headers}, auth: options.auth});
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
          assertAnonymous(options);

          return respond(options);
        });

        await webex.request({uri: SOURCE, method: 'POST', request: transport});

        assert.equal(sent.length, 2);
        assert.equal(sent[0].headers.authorization, 'Bearer user-token');
        assert.isFalse(
          Object.keys(sent[1].headers).some((key) => key.toLowerCase() === 'authorization')
        );
        assert.strictEqual(sent[1].auth, false);
        assert.calledOnceWithExactly(webex.credentials.getUserToken);
      });
    });

    it('does not extend anonymous admission to an unknown redirect target', async () => {
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

    it('does not authenticate or refresh a rejected anonymous request', async () => {
      const webex = await createCore();
      const refresh = sinon.stub(webex.credentials, 'refresh').resolves();
      const transport = sinon.spy((options) => ({statusCode: 401, headers: {}, body: {}, options}));

      await assert.isRejected(webex.request({uri: TARGET, request: transport}));

      assert.calledOnce(transport);
      assert.notCalled(webex.credentials.getUserToken);
      assert.notCalled(refresh);
    });

    it('retains the existing custom-chain behavior with the new option empty', async () => {
      const webex = await createCore({interceptors: {}, services: {allowedWithoutAuthHeader: []}});
      const options = {uri: TARGET, headers: {Authorization: 'Bearer explicit'}};

      await webex.prepareFetchOptions(options);

      assert.deepEqual(options.interceptors, []);
      assert.equal(options.headers.Authorization, 'Bearer explicit');
    });
  });
});
