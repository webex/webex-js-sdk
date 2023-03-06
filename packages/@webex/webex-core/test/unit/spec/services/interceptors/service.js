/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import {ServiceInterceptor} from '@webex/webex-core';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('webex-core', () => {
  describe('ServiceInterceptor', () => {
    let fixture;
    let interceptor;
    let options;

    beforeEach(() => {
      interceptor = new ServiceInterceptor();

      fixture = {
        api: 'example-api',
        resource: '/example/resource/',
        service: 'example',
        serviceUrl: 'https://www.example-service.com/',
        uri: 'https://www.example-uri.com/',
      };

      options = {};
    });

    describe('#generateUri()', () => {
      let uri;

      beforeEach(() => {
        uri = interceptor.generateUri(
          fixture.serviceUrl,
          fixture.resource
        );
      });
      it('should remove all trailing slashes', () => assert.equal(uri.split('//').length, 2));

      it('should combine the service url and the resource', () => {
        assert.isTrue(uri.includes(fixture.serviceUrl));
        assert.isTrue(uri.includes(fixture.resource));
      });
    });

    describe('#normalizeOptions()', () => {
      describe('when the api parameter is defined', () => {
        beforeEach(() => {
          options.api = fixture.api;
        });

        it('should assign the service parameter the api value', () => {
          interceptor.normalizeOptions(options);

          assert.equal(options.service, fixture.api);
        });

        describe('when the service parameter is defined', () => {
          beforeEach(() => {
            options.service = fixture.service;
          });

          it('should maintain the service parameter', () => {
            interceptor.normalizeOptions(options);

            assert.equal(options.service, fixture.service);
          });
        });
      });
    });

    describe('#onRequest()', () => {
      describe('when the uri parameter is defined', () => {
        beforeEach(() => {
          options.uri = fixture.uri;
        });

        it('should return the options', () => {
          const initialOptions = {...options};

          interceptor.onRequest(options);

          assert.deepEqual(options, initialOptions);
        });
      });

      describe('when the uri parameter is not defined', () => {
        let waitForService;

        beforeEach(() => {
          interceptor.normalizeOptions = sinon.stub();
          interceptor.validateOptions = sinon.stub();
          interceptor.generateUri = sinon.stub();

          interceptor.webex = {
            internal: {
              services: {
                waitForService: sinon.stub(),
              },
            },
          };

          waitForService = interceptor.webex.internal.services.waitForService;
          waitForService.resolves(fixture.serviceUrl);

          options.service = fixture.service;
          options.resource = fixture.resource;
        });

        it('should normalize the options', () =>
          interceptor.onRequest(options).then(() => assert.called(interceptor.normalizeOptions)));

        it('should validate the options', () =>
          interceptor.onRequest(options).then(() => assert.called(interceptor.validateOptions)));

        it('should attempt to collect the service url', () =>
          interceptor
            .onRequest(options)
            .then(() => assert.calledWith(waitForService, {name: options.service})));

        describe('when the service url was collected successfully', () => {
          it('should attempt to generate the full uri', () =>
            interceptor
              .onRequest(options)
              .then(() =>
                assert.calledWith(interceptor.generateUri, fixture.serviceUrl, fixture.resource)
              ));

          it('should return a resolved promise', () => {
            const promise = interceptor.onRequest(options);

            assert.isFulfilled(promise);
          });
        });

        describe('when the service url was not collected successfully', () => {
          beforeEach(() => {
            waitForService.rejects();
          });

          it('should return a rejected promise', () => {
            const promise = interceptor.onRequest(options);

            assert.isRejected(promise);
          });
        });
      });
    });

    describe('#validateOptions()', () => {
      describe('when the resource parameter is not defined', () => {
        beforeEach(() => {
          options.service = fixture.service;
        });

        it('should throw an error', () => {
          assert.throws(() => interceptor.validateOptions(options));
        });
      });

      describe('when the service parameter is not defined', () => {
        beforeEach(() => {
          options.resource = fixture.resource;
        });

        it('should throw an error', () => {
          assert.throws(() => interceptor.validateOptions(options));
        });
      });

      describe('when the service and resource parameters are defined', () => {
        beforeEach(() => {
          options.service = fixture.service;
          options.resource = fixture.resource;
        });

        it('should not throw an error', () => {
          assert.doesNotThrow(() => interceptor.validateOptions(options));
        });
      });
    });
  });
});
