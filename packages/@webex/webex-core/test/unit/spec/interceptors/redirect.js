/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable camelcase */

import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import {
  AuthInterceptor,
  RedirectInterceptor,
  config,
  Credentials,
  Services,
  ServicesV2,
  Token,
} from '@webex/webex-core';
import {cloneDeep, merge} from 'lodash';

describe('webex-core', () => {
  describe('Interceptors', () => {
    describe('RedirectInterceptor', () => {
      let interceptor, webex;

      beforeEach(() => {
        webex = new MockWebex({
          children: {
            credentials: Credentials,
          },
          config: merge(cloneDeep(config), {credentials: {client_secret: 'fake'}}),
          request: sinon.stub().resolves({}),
        });

        interceptor = Reflect.apply(RedirectInterceptor.create, webex, []);
      });

      describe('#onResponse', () => {
        it('redirects GET requests to new url on locus redirect error', () => {
          const response = {
            statusCode: 404,
            headers: {},
            body: {
              errorCode: 2000002,
              location: 'http://newlocus.example.com',
            },
          };

          interceptor.onResponse({$redirectCount: 0}, response);
          sinon.assert.calledWith(webex.request, {
            $redirectCount: 1,
            uri: 'http://newlocus.example.com',
          });
        });

        it('redirects POST requests to new url on locus redirect error', () => {
          const response = {
            statusCode: 404,
            headers: {},
            body: {
              errorCode: 2000002,
              location: 'http://newlocus.example.com?alternate=true',
            },
            options: {
              qs: true,
            },
          };

          interceptor.onResponse({$redirectCount: 4}, response);
          sinon.assert.calledWith(webex.request, {
            $redirectCount: 5,
            uri: 'http://newlocus.example.com',
          });
        });

        it('does not redirect on reaching max redirects', () => {
          const response = {
            statusCode: 404,
            headers: {},
            body: {
              errorCode: 2000002,
              location: 'http://newlocus.example.com?alternate=true',
            },
            options: {
              qs: true,
            },
          };

          assert.isRejected(interceptor.onResponse({$redirectCount: 5}, response));
        });

        it('returns when locus redirect is not encountered', () => {
          const response = {
            statusCode: 404,
            headers: {},
            body: {
              errorCode: 20000,
              location: 'http://newlocus.example.com?alternate=true',
            },
            options: {
              qs: true,
            },
          };

          assert.equal(interceptor.onResponse({$redirectCount: 5}, response), response);
        });

        it('returns when a locus redirect body arrives on a response that is not a 404', () => {
          const response = {
            statusCode: 200,
            headers: {},
            body: {
              errorCode: 2000002,
              location: 'http://newlocus.example.com',
            },
          };

          assert.equal(interceptor.onResponse({$redirectCount: 0}, response), response);
          assert.notCalled(webex.request);
        });

        it('redirects GET requests to new url on appapi redirect error', () => {
          const response = {
            statusCode: 404,
            headers: {},
            body: {
              code: 404100,
              data: {
                siteFullUrl: 'newlocus.example.com'
              },
            },
          };

          interceptor.onResponse({$redirectCount: 0, uri: 'https://test.webex.com/meet/v1/join'}, response);
          sinon.assert.calledWith(webex.request, {
            $redirectCount: 1,
            uri: 'https://newlocus.example.com/meet/v1/join',
          });
        });
        it('returns when appapi redirect is not encountered', () => {
          const response = {
            statusCode: 404,
            headers: {},
            body: {
              code: 404101,
              data: {
                siteFullUrl: 'http://newlocus.example.com?alternate=true'
              },
            },
          };

          assert.equal(interceptor.onResponse({$redirectCount: 5}, response), response);
        });
        it('does not redirect on reaching max redirects', () => {
          const response = {
            statusCode: 404,
            headers: {},
            body: {
              code: 404100,
              data: {
                siteFullUrl: 'http://newlocus.example.com?alternate=true'
              },
            },
            options: {
              qs: true,
            },
          };

          assert.isRejected(interceptor.onResponse({$redirectCount: 5}, response));
        });

        it('redirects POST requests to new url on appapi redirect error', () => {
          const response = {
            statusCode: 404,
            headers: {},
            body: {
              code: 404100,
              data: {
                siteFullUrl: 'http://newlocus.example.com?alternate=true'
              },
            },
            options: {
              qs: true,
            },
          };

          interceptor.onResponse({$redirectCount: 4}, response);
          sinon.assert.calledWith(webex.request, {
            $redirectCount: 5,
            uri: 'http://newlocus.example.com',
          });
        });

        it('returns when an appapi redirect body arrives on a response that is not a 404', () => {
          const response = {
            statusCode: 200,
            headers: {},
            body: {
              code: 404100,
              data: {
                siteFullUrl: 'newlocus.example.com'
              },
            },
          };

          assert.equal(
            interceptor.onResponse(
              {$redirectCount: 0, uri: 'https://test.webex.com/meet/v1/join'},
              response
            ),
            response
          );
          assert.notCalled(webex.request);
        });

        it('removes authorization header when redirecting preJoin request to webex-appapi-service', () => {
          const response = {
            statusCode: 404,
            headers: {},
            body: {
              code: 404100,
              data: {
                siteFullUrl: 'newlocus.example.com'
              },
            },
          };

          const options = {
            $redirectCount: 0,
            uri: 'https://test.webex.com/meet/v1/preJoin',
            resource: 'preJoin',
            service: 'webex-appapi-service',
            headers: {
              authorization: 'Bearer token123',
            },
          };

          interceptor.onResponse(options, response);
          sinon.assert.calledWith(webex.request, sinon.match({
            $redirectCount: 1,
            uri: 'https://newlocus.example.com/meet/v1/preJoin',
            resource: 'preJoin',
            service: 'webex-appapi-service',
            headers: {
              authorization: false,
            },
          }));
        });

        it('does not forward the authorization header for non-preJoin requests on appapi redirect', () => {
          const response = {
            statusCode: 404,
            headers: {},
            body: {
              code: 404100,
              data: {
                siteFullUrl: 'newlocus.example.com'
              },
            },
          };

          const options = {
            $redirectCount: 0,
            uri: 'https://test.webex.com/meet/v1/join',
            resource: 'join',
            service: 'webex-appapi-service',
            headers: {
              authorization: 'Bearer token123',
            },
          };

          interceptor.onResponse(options, response);
          sinon.assert.calledWith(webex.request, sinon.match({
            $redirectCount: 1,
            uri: 'https://newlocus.example.com/meet/v1/join',
          }));
          assert.notProperty(webex.request.firstCall.args[0].headers, 'authorization');
          // the options of the request being redirected are left untouched
          assert.equal(options.headers.authorization, 'Bearer token123');
        });

        it('does not forward the authorization header for preJoin requests to non-webex-appapi-service', () => {
          const response = {
            statusCode: 404,
            headers: {},
            body: {
              code: 404100,
              data: {
                siteFullUrl: 'newlocus.example.com'
              },
            },
          };

          const options = {
            $redirectCount: 0,
            uri: 'https://test.webex.com/meet/v1/preJoin',
            resource: 'preJoin',
            service: 'other-service',
            headers: {
              authorization: 'Bearer token123',
            },
          };

          interceptor.onResponse(options, response);
          sinon.assert.calledWith(webex.request, sinon.match({
            $redirectCount: 1,
            uri: 'https://newlocus.example.com/meet/v1/preJoin',
          }));
          assert.notProperty(webex.request.firstCall.args[0].headers, 'authorization');
          assert.equal(options.headers.authorization, 'Bearer token123');
        });
      });

      describe('#onResponse() against a real service catalog', () => {
        // Whether a request carries credentials is decided by the auth
        // interceptor, and it returns early when the request already has an
        // authorization header. So asserting that the header is not forwarded
        // is only half of it: these cases run the redirected request back
        // through the auth interceptor, with a real catalog and real
        // allowed-domain methods, to show that the decision is remade against
        // the uri taken from the response.
        const inheritedToken = 'Bearer inherited-token';
        const allowedHost = 'locus-eu.webex.com';
        const otherHost = 'unrelated.example';

        const responses = {
          'a cisco-location header': (host) => ({
            statusCode: 404,
            headers: {'cisco-location': `https://${host}/resource`},
          }),
          'a locus redirect error': (host) => ({
            statusCode: 404,
            headers: {},
            body: {
              errorCode: 2000002,
              location: `https://${host}/resource`,
            },
          }),
          'an appapi redirect error': (host) => ({
            statusCode: 404,
            headers: {},
            body: {
              code: 404100,
              data: {siteFullUrl: host},
            },
          }),
        };

        [
          {name: 'Services', Constructor: Services},
          {name: 'ServicesV2', Constructor: ServicesV2},
        ].forEach(({name, Constructor}) => {
          describe(name, () => {
            let authInterceptor, getUserToken;

            beforeEach(() => {
              const services = new Constructor(undefined, {parent: webex});

              services._getCatalog().setAllowedDomains(['webex.com']);
              // the catalog holds no services, so a url that is not covered by
              // an allowed domain has nothing else to authorize it
              services.waitForService = sinon.stub().rejects(new Error('no such service'));

              webex.internal.services = services;
              webex.credentials.supertoken = new Token(
                {
                  access_token: 'ST1',
                  token_type: 'Bearer',
                },
                {parent: webex}
              );

              getUserToken = sinon.spy(webex.credentials, 'getUserToken');
              authInterceptor = Reflect.apply(AuthInterceptor.create, webex, []);
            });

            afterEach(() => {
              getUserToken.restore();
              delete webex.internal.services;
            });

            Object.keys(responses).forEach((trigger) => {
              describe(`redirected by ${trigger}`, () => {
                // Redirects the request and returns the options the redirected
                // request was issued with.
                const redirect = (host) => {
                  const options = {
                    $redirectCount: 0,
                    uri: 'https://api.webex.com/resource',
                    headers: {authorization: inheritedToken},
                  };

                  interceptor.onResponse(options, responses[trigger](host));

                  assert.calledOnce(webex.request);
                  // the options of the request being redirected are left untouched
                  assert.equal(options.headers.authorization, inheritedToken);

                  return webex.request.firstCall.args[0];
                };

                it('does not forward the authorization header', () => {
                  assert.notProperty(redirect(allowedHost).headers, 'authorization');
                });

                it('authorizes the redirected request when the new uri is under an allowed domain', () =>
                  authInterceptor.onRequest(redirect(allowedHost)).then((options) => {
                    assert.equal(options.uri, `https://${allowedHost}/resource`);
                    assert.equal(
                      options.headers.authorization,
                      webex.credentials.supertoken.toString()
                    );
                    assert.calledOnce(getUserToken);
                  }));

                it('does not authorize the redirected request when the new uri is not', () =>
                  authInterceptor.onRequest(redirect(otherHost)).then((options) => {
                    assert.equal(options.uri, `https://${otherHost}/resource`);
                    assert.notProperty(options.headers, 'authorization');
                    assert.notCalled(getUserToken);
                  }));
              });
            });
          });
        });
      });
    });
  });
});
