import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import {
  EmbargoInterceptor,
  WebexHttpError
} from '@webex/webex-core';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('webex-core', () => {
  describe('EmbargoInterceptor', () => {
    let interceptor;

    before('create interceptor', () => {
      interceptor = new EmbargoInterceptor();
    });

    describe('#onResponseError()', () => {
      let credentialsClear;
      let loggerInfo;
      let loggerMessage;
      let options;
      let reason;

      beforeEach('create options object', () => {
        options = {
          uri: 'http://not-a-url.com/embargoed'
        };

        interceptor.webex = {
          credentials: {
            clear: sinon.spy()
          },
          internal: {},
          logger: {
            info: sinon.spy()
          }
        };

        credentialsClear = interceptor.webex.credentials.clear;
        loggerInfo = interceptor.webex.logger.info;
        loggerMessage = [
          'Received `HTTP 451 Unavailable For Legal Reasons`, ',
          'discarding credentials and device registration'
        ].join('');
      });

      describe('when the reason does have a \'451\' status code', () => {
        beforeEach('set appropriate status code and spys', () => {
          reason = new WebexHttpError.InternalServerError({
            message: 'test message',
            statusCode: 451,
            options: {
              url: 'http://not-a-url.com/',
              headers: {
                trackingId: 'tid'
              }
            }
          });
        });

        it('should return a rejected promise with the reason', () =>
          assert.isRejected(interceptor.onResponseError(options, reason))
            .then((error) => assert.equal(reason, error)));

        it('should clear credentials', () =>
          assert.isRejected(interceptor.onResponseError(options, reason))
            .then(() => assert.called(credentialsClear)));

        it('should present an appropriate logger message', () =>
          assert.isRejected(interceptor.onResponseError(options, reason))
            .then(() => assert.calledWith(loggerInfo, loggerMessage)));

        describe('when the device plugin is mounted', () => {
          let deviceClear;

          beforeEach('set up the device plugin', () => {
            interceptor.webex.internal.device = {
              clear: sinon.spy()
            };

            deviceClear = interceptor.webex.internal.device.clear;
          });

          it('should clear the device', () =>
            assert.isRejected(interceptor.onResponseError(options, reason))
              .then(() => assert.called(deviceClear)));
        });
      });

      describe('when the reason does not have a \'451\' status code', () => {
        beforeEach('set appropriate status code and spys', () => {
          reason = new WebexHttpError.InternalServerError({
            message: 'test message',
            statusCode: 452,
            options: {
              url: 'http://not-a-url.com/',
              headers: {
                trackingId: 'tid'
              }
            }
          });
        });

        it('should return a rejected promise with the reason', () =>
          assert.isRejected(interceptor.onResponseError(options, reason))
            .then((error) => assert.equal(reason, error)));

        it('should not clear credentials', () =>
          assert.isRejected(interceptor.onResponseError(options, reason))
            .then(() => assert.notCalled(credentialsClear)));

        it('should not present any logger message', () =>
          assert.isRejected(interceptor.onResponseError(options, reason))
            .then(() => assert.notCalled(loggerInfo)));

        describe('when the device plugin is mounted', () => {
          let deviceClear;

          beforeEach('set up the device plugin', () => {
            interceptor.webex.internal.device = {
              clear: sinon.spy()
            };

            deviceClear = interceptor.webex.internal.device.clear;
          });

          it('should not clear the device', () =>
            assert.isRejected(interceptor.onResponseError(options, reason))
              .then(() => assert.notCalled(deviceClear)));
        });
      });
    });
  });
});
