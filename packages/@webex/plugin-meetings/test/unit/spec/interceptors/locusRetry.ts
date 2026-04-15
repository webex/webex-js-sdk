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

            const hashTreeOptions = {
              method: 'GET',
              headers: {
                trackingid: 'test',
                'retry-after': 1000,
              },
              uri: `https://locus-test.webex.com/locus/api/v1/loci/12345/session/abc/datasets/main/hashtree`,
              body: undefined,
            };

            const syncOptions = {
              method: 'POST',
              headers: {
                trackingid: 'test',
                'retry-after': 1000,
              },
              uri: `https://locus-test.webex.com/locus/api/v1/loci/12345/session/abc/datasets/main/sync`,
              body: 'foo',
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
              const handleRetryStub = sinon.stub(
                interceptor,
                'handleRetryRequestLocusServiceError'
              );
              handleRetryStub.returns(Promise.resolve());

              return interceptor.onResponseError(options, reason2).then(() => {
                expect(handleRetryStub.calledWith(options, 1000)).to.be.true;
              });
            });

            [429, 500, 502, 503, 504].forEach((statusCode) => {
              it(`does not retry /hashtree requests on ${statusCode}`, () => {
                const reason = new WebexHttpError.MethodNotAllowed({
                  statusCode,
                  options: {
                    headers: {trackingid: 'test', 'retry-after': 1000},
                    uri: hashTreeOptions.uri,
                  },
                  body: {error: `Fake ${statusCode}`},
                });

                const handleRetryStub = sinon.stub(
                  interceptor,
                  'handleRetryRequestLocusServiceError'
                );
                handleRetryStub.returns(Promise.resolve());

                return interceptor.onResponseError(hashTreeOptions, reason).then(
                  () => assert.fail('Expected promise to be rejected'),
                  (err) => {
                    expect(err).to.equal(reason);
                    expect(handleRetryStub.called).to.be.false;
                    handleRetryStub.restore();
                  }
                );
              });

              it(`does not retry /sync requests on ${statusCode}`, () => {
                const reason = new WebexHttpError.MethodNotAllowed({
                  statusCode,
                  options: {
                    headers: {trackingid: 'test', 'retry-after': 1000},
                    uri: syncOptions.uri,
                  },
                  body: {error: `Fake ${statusCode}`},
                });

                const handleRetryStub = sinon.stub(
                  interceptor,
                  'handleRetryRequestLocusServiceError'
                );
                handleRetryStub.returns(Promise.resolve());

                return interceptor.onResponseError(syncOptions, reason).then(
                  () => assert.fail('Expected promise to be rejected'),
                  (err) => {
                    expect(err).to.equal(reason);
                    expect(handleRetryStub.called).to.be.false;
                    handleRetryStub.restore();
                  }
                );
              });
            });

            it('still retries other locus requests on 429', () => {
              const reason429 = new WebexHttpError.MethodNotAllowed({
                statusCode: 429,
                options: {
                  headers: {trackingid: 'test', 'retry-after': 1000},
                  uri: options.uri,
                },
                body: {error: 'Too Many Requests'},
              });

              interceptor.webex.request = sinon.stub().returns(Promise.resolve());
              const handleRetryStub = sinon.stub(
                interceptor,
                'handleRetryRequestLocusServiceError'
              );
              handleRetryStub.returns(Promise.resolve());

              return interceptor.onResponseError(options, reason429).then(() => {
                expect(handleRetryStub.calledOnce).to.be.true;
                handleRetryStub.restore();
              });
            });

            it('still retries other locus requests on 503', () => {
              interceptor.webex.request = sinon.stub().returns(Promise.resolve());
              const handleRetryStub = sinon.stub(
                interceptor,
                'handleRetryRequestLocusServiceError'
              );
              handleRetryStub.returns(Promise.resolve());

              return interceptor.onResponseError(options, reason2).then(() => {
                expect(handleRetryStub.calledOnce).to.be.true;
                handleRetryStub.restore();
              });
            });

            describe('URI parsing edge cases', () => {
              const make503Reason = (uri) =>
                new WebexHttpError.MethodNotAllowed({
                  statusCode: 503,
                  options: {headers: {trackingid: 'test', 'retry-after': 1000}, uri},
                  body: {error: 'Service Unavailable'},
                });

              const makeOptions = (uri) => ({
                method: 'GET',
                headers: {trackingid: 'test', 'retry-after': 1000},
                uri,
                body: undefined,
              });

              [
                'https://locus.webex.com/locus/api/v1/loci/123/session/abc/datasets/main/hashtree?rootHash=xyz',
                'https://locus.webex.com/locus/api/v1/loci/123/session/abc/datasets/main/sync?seq=5',
              ].forEach((uri) => {
                it(`skips retry even with query params: ${uri.split('/').pop()}`, () => {
                  const opts = makeOptions(uri);
                  const reason = make503Reason(uri);
                  const stub = sinon
                    .stub(interceptor, 'handleRetryRequestLocusServiceError')
                    .returns(Promise.resolve());

                  return interceptor.onResponseError(opts, reason).then(
                    () => assert.fail('Expected promise to be rejected'),
                    (err) => {
                      expect(err).to.equal(reason);
                      expect(stub.called).to.be.false;
                      stub.restore();
                    }
                  );
                });
              });

              [
                'https://locus.webex.com/locus/api/v1/loci/123/hashtree-v2',
                'https://locus.webex.com/locus/api/v1/loci/123/syncData',
                'https://locus.webex.com/locus/api/v1/loci/123/async',
                'https://locus.webex.com/locus/api/v1/loci/123/hashtree/metadata',
              ].forEach((uri) => {
                it(`still retries when path only partially matches: ${uri
                  .split('/')
                  .pop()}`, () => {
                  const opts = makeOptions(uri);
                  const reason = make503Reason(uri);
                  interceptor.webex.request = sinon.stub().returns(Promise.resolve());
                  const stub = sinon
                    .stub(interceptor, 'handleRetryRequestLocusServiceError')
                    .returns(Promise.resolve());

                  return interceptor.onResponseError(opts, reason).then(() => {
                    expect(stub.calledOnce).to.be.true;
                    stub.restore();
                  });
                });
              });

              it('still retries when /hashtree is on a non-locus host', () => {
                const uri = 'https://other-service.webex.com/api/v1/hashtree';
                const opts = makeOptions(uri);
                const reason = make503Reason(uri);

                return interceptor.onResponseError(opts, reason).then(
                  () => assert.fail('Expected promise to be rejected'),
                  (err) => {
                    expect(err).to.equal(reason);
                  }
                );
              });

              it('still retries when URI is malformed', () => {
                const uri = 'not-a-valid-url';
                const opts = makeOptions(uri);
                const reason = make503Reason(uri);

                return interceptor.onResponseError(opts, reason).then(
                  () => assert.fail('Expected promise to be rejected'),
                  (err) => {
                    expect(err).to.equal(reason);
                  }
                );
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

