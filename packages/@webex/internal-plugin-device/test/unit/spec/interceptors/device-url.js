/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {DeviceUrlInterceptor} from '@webex/internal-plugin-device';

describe('plugin-device', () => {
  describe('DeviceUrlInterceptor', () => {
    let fixture;
    let interceptor;
    let waitForService;
    let getServiceFromUrl;
    let options;

    beforeEach(() => {
      interceptor = new DeviceUrlInterceptor();

      fixture = {
        api: 'example-api',
        resource: '/example/resource/',
        service: 'example',
        serviceUrl: 'https://www.example-service.com/',
        uri: 'https://www.example-uri.com/'
      };

      interceptor.webex = {
        internal: {
          device: {
            url: fixture.uri
          },
          services: {
            waitForService: sinon.stub().resolves(fixture.serviceUrl),
            getServiceFromUrl: sinon.stub().returns({name: fixture.service})
          }
        }
      };

      waitForService = interceptor.webex.internal.services.waitForService;
      getServiceFromUrl = interceptor.webex.internal.services.getServiceFromUrl;

      options = {};
    });

    describe('#onRequest()', () => {
      describe('when `cisco-device-url` header is are already set', () => {
        it('should return the options unchanged', () => {
          interceptor.webex.internal.device.url = undefined;
          options = {
            headers: {
              'cisco-device-url': fixture.url
            },
            ...options
          };

          return interceptor.onRequest({...options})
            .then((results) => assert.deepEqual(results, options));
        });

        describe('when `cisco-device-url` header exists but is not set', () => {
          it('should return the options unchanged', () => {
            interceptor.webex.internal.device.url = undefined;
            options = {
              headers: {
                'cisco-device-url': undefined
              },
              ...options
            };

            return interceptor.onRequest({...options})
              .then((results) => assert.deepEqual(results, options));
          });
        });

        describe('when service does not exist', () => {
          it('should return the options', () => {
            interceptor.webex.internal.device.url = 'http://device-url.com/';
            interceptor.webex.internal.services.waitForService =
              sinon.stub().resolves('http://example-url.com/');
            interceptor.webex.internal.services.getServiceFromUrl =
              sinon.stub().returns();

            return interceptor.onRequest({...options})
              .then((results) => assert.deepEqual(results, options));
          });
        });
      });

      describe('adds cisco-device-url to the request header for service catalog services', () => {
        it('when only the service property is provided', () => {
          options.service = fixture.service;

          interceptor.onRequest(options)
            .then((results) => {
              assert.calledWith(
                waitForService,
                {
                  service: options.service,
                  url: undefined
                }
              );
              assert.calledWith(
                getServiceFromUrl,
                fixture.serviceUrl
              );
              assert.isDefined(options.headers['cisco-device-url']);
              assert.equal(results.headers['cisco-device-url'], fixture.uri);
            });
        });

        it('when only the uri property is provided', () => {
          options = {
            uri: fixture.uri,
            ...options
          };

          interceptor.onRequest(options)
            .then((results) => {
              assert.calledWith(
                waitForService,
                {
                  service: undefined,
                  url: options.uri
                }
              );
              assert.calledWith(
                getServiceFromUrl,
                fixture.serviceUrl
              );
              assert.isDefined(results.headers['cisco-device-url']);
              assert.equal(results.headers['cisco-device-url'], fixture.uri);
            });
        });

        it('when both the service and uri properties are provided', () => {
          options = {
            services: fixture.service,
            uri: fixture.uri,
            ...options
          };

          interceptor.onRequest(options)
            .then((results) => {
              assert.calledWith(
                waitForService,
                {
                  service: options.service,
                  url: options.uri
                }
              );
              assert.calledWith(
                getServiceFromUrl,
                fixture.serviceUrl
              );
              assert.isDefined(results.headers['cisco-device-url']);
              assert.equal(results.headers['cisco-device-url'], fixture.uri);
            });
        });

        describe('does not add cisco-device-url due to invalid service name', () => {
          it('service is `idbroker` and returns the original object', () => {
            getServiceFromUrl.returns({name: 'idbroker'});

            options = {
              services: fixture.service,
              uri: fixture.uri,
              ...options
            };

            interceptor.onRequest(options)
              .then((results) => {
                assert.calledWith(
                  waitForService,
                  {
                    service: options.service,
                    url: options.uri
                  }
                );
                assert.calledWith(
                  getServiceFromUrl,
                  fixture.serviceUrl
                );
                assert.isUndefined(results.headers);
              });
          });

          it('service is `oauth` returns the original object', () => {
            getServiceFromUrl.returns({name: 'saml'});

            options = {
              services: fixture.service,
              uri: fixture.uri,
              ...options
            };

            interceptor.onRequest(options)
              .then((results) => {
                assert.calledWith(
                  waitForService,
                  {
                    service: options.service,
                    url: options.uri
                  }
                );
                assert.calledWith(
                  getServiceFromUrl,
                  fixture.serviceUrl
                );
                assert.isUndefined(results.headers);
              });
          });

          it('service is `saml` returns the original object', () => {
            getServiceFromUrl.returns({name: 'saml'});

            options = {
              services: fixture.service,
              uri: fixture.uri,
              ...options
            };

            interceptor.onRequest(options)
              .then((results) => {
                assert.calledWith(
                  waitForService,
                  {
                    service: options.service,
                    url: options.uri
                  }
                );
                assert.calledWith(
                  getServiceFromUrl,
                  fixture.serviceUrl
                );
                assert.isUndefined(results.headers);
              });
          });
        });


        describe('waitForService returns a rejection', () => {
          beforeEach(() => {
            waitForService.rejects();
          });

          it('returns an error', () => {
            const promise = interceptor.onRequest(options);

            assert.isRejected(promise);
          });
        });
      });
    });
  });
});
