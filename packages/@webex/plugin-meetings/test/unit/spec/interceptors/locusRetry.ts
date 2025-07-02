/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable camelcase */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import { expect } from "@webex/test-helper-chai";
import MockWebex from '@webex/test-helper-mock-webex';
import {LocusRetryStatusInterceptor} from "@webex/plugin-meetings/src/interceptors";
import {WebexHttpError} from '@webex/webex-core';
import Meetings from '@webex/plugin-meetings';
import sinon from 'sinon';

describe('plugin-meetings', () => {
    describe('Interceptors', () => {
      describe('LocusRetryStatusInterceptor', () => {
        let interceptor, webex;
        beforeEach(() => {
            webex = new MockWebex({
                children: {
                    meeting: Meetings,
                  },
            });
            interceptor = Reflect.apply(LocusRetryStatusInterceptor.create, {
                sessionId: 'mock-webex_uuid',
              }, []);
          });
        describe('#onResponseError', () => {
            const options = {
                method: 'POST',
                headers: {
                    trackingid: 'test',
                    'retry-after': 1000,
                },
                uri: `https://locus-test.webex.com/locus/api/v1/loci/call`,
                body: 'foo'
                };
            const reason1 = new WebexHttpError.MethodNotAllowed({
                statusCode: 403,
                options: {
                    headers: {
                        trackingid: 'test',
                        'retry-after': 1000,
                    },
                    uri: `https://locus-test.webex.com/locus/api/v1/loci/call`,
                    },
                body: {
                    error: 'POST not allwed',
                },
                });
            const reason2 = new WebexHttpError.MethodNotAllowed({
                statusCode: 503,
                options: {
                    headers: {
                        trackingid: 'test',
                        'retry-after': 1000,
                    },
                    uri: `https://locus-test.webex.com/locus/api/v1/loci/call`,
                    },
                body: {
                    error: 'Service Unavailable',
                    },
                });

            it('rejects when not locus service unavailable error', () => {
                return assert.isRejected(interceptor.onResponseError(options, reason1));
            });

            it('calls handleRetryRequestLocusServiceError with correct retry time when locus service unavailable error', () => {
                interceptor.webex.request = sinon.stub().returns(Promise.resolve());
                const handleRetryStub = sinon.stub(interceptor, 'handleRetryRequestLocusServiceError');
                handleRetryStub.returns(Promise.resolve());

                return interceptor.onResponseError(options, reason2).then(() => {
                    expect(handleRetryStub.calledWith(options, 1000)).to.be.true;

                });
            });
        });

        describe('#handleRetryRequestLocusServiceError', () => {
            const options = {
                method: 'POST',
                headers: {
                    trackingid: 'test',
                },
                uri: `https://locus-test.webex.com/locus/api/v1/loci/call`,
                body: 'foo'
                };
            const retryAfterTime = 2000;

            it('returns the correct resolved value when the request is successful', () => {
                const mockResponse = 'mock response'
                interceptor.webex.request = sinon.stub().returns(Promise.resolve(mockResponse));

                return interceptor.handleRetryRequestLocusServiceError(options, retryAfterTime)
                  .then((response) => {
                    expect(response).to.equal(mockResponse);
                  });
              });

            it('rejects the promise when the request is unsuccessful', () => {
              const rejectionReason = 'Service Unavaialble after retry';

              interceptor.webex.request = sinon.stub().returns(Promise.reject(rejectionReason));

              return interceptor.handleRetryRequestLocusServiceError(options, retryAfterTime)
                .catch((error) => {
                  expect(error).to.equal(rejectionReason);
                });
            });

            it('retries the request after the specified time', () => {
                let clock;
                clock = sinon.useFakeTimers();
                const mockResponse = 'mock response'

                interceptor.webex.request = sinon.stub().returns(Promise.resolve(mockResponse));
                const promise = interceptor.handleRetryRequestLocusServiceError(options, retryAfterTime);

                clock.tick(retryAfterTime);

                return promise.then(() => {
                    expect(interceptor.webex.request.calledOnce).to.be.true;
                    });
            });
        });
    });
    });
});

