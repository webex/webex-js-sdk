/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import ConversationRetryAfterInterceptor, {
  DEFAULT_RETRY_AFTER_DELAY,
  getRetryAfterDelay,
  MAX_REPLAYS,
  MAX_RETRY_AFTER_DELAY,
} from '../../../../src/interceptors/conversation-retry-after';

describe('ConversationRetryAfterInterceptor', () => {
  let clock;
  let interceptor;
  let webex;

  const conversationOptions = {
    method: 'GET',
    service: 'conversation',
  };
  const rateLimitReason = {
    headers: {'retry-after': '1'},
    statusCode: 429,
  };

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    webex = {
      internal: {
        services: {
          getServiceFromUrl: sinon.stub(),
        },
      },
      request: sinon.stub(),
    };
    interceptor = Reflect.apply(ConversationRetryAfterInterceptor.create, webex, []);
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  describe('getRetryAfterDelay()', () => {
    [
      [{headers: {'Retry-After': '2'}}, 2_000],
      [{retryAfter: '3'}, 3_000],
      [{headers: {'retry-after': 'Fri, 01 Jan 2100 00:00:00 GMT'}}, MAX_RETRY_AFTER_DELAY],
      [{headers: {'retry-after': 'Wed, 31 Dec 1969 23:59:59 GMT'}}, 0],
      [{headers: {}}, DEFAULT_RETRY_AFTER_DELAY],
      [{headers: {'retry-after': 'invalid'}}, DEFAULT_RETRY_AFTER_DELAY],
      [{headers: {'retry-after': '7200'}}, MAX_RETRY_AFTER_DELAY],
    ].forEach(([reason, expectedDelay]) => {
      it(`returns ${expectedDelay}ms for ${JSON.stringify(reason)}`, () => {
        assert.equal(getRetryAfterDelay(reason), expectedDelay);
      });
    });
  });

  it('replays a Conversation GET after Retry-After', async () => {
    const response = {body: {items: []}};

    webex.request.resolves(response);

    const replay = interceptor.onResponseError(conversationOptions, rateLimitReason);

    await clock.tickAsync(999);
    assert.notCalled(webex.request);

    await clock.tickAsync(1);

    assert.deepEqual(await replay, response);
    assert.calledOnceWithExactly(webex.request, conversationOptions);
  });

  it('recognizes a Conversation URL through the service catalog', async () => {
    const options = {
      method: 'GET',
      url: 'https://conversation.example.com/conversation/api/v1/conversations',
    };
    const response = {body: {items: []}};

    webex.internal.services.getServiceFromUrl.returns({name: 'conversation'});
    webex.request.resolves(response);

    const replay = interceptor.onResponseError(options, rateLimitReason);

    await clock.tickAsync(1_000);

    assert.deepEqual(await replay, response);
    assert.calledOnceWithExactly(webex.internal.services.getServiceFromUrl, options.url);
  });

  it('replays concurrent rate-limited requests independently', async () => {
    let resolveFirstRequest;
    const firstOptions = {...conversationOptions, resource: 'conversations/first'};
    const secondOptions = {...conversationOptions, resource: 'conversations/second'};
    const firstResponse = {body: {id: 'first'}};
    const secondResponse = {body: {id: 'second'}};
    const firstRequest = new Promise((resolve) => {
      resolveFirstRequest = resolve;
    });

    webex.request.onFirstCall().returns(firstRequest);
    webex.request.onSecondCall().resolves(secondResponse);

    const firstReplay = interceptor.onResponseError(firstOptions, rateLimitReason);
    const secondReplay = interceptor.onResponseError(secondOptions, rateLimitReason);

    await clock.tickAsync(1_000);
    assert.calledTwice(webex.request);
    assert.calledWithExactly(webex.request.firstCall, firstOptions);
    assert.calledWithExactly(webex.request.secondCall, secondOptions);
    assert.deepEqual(await secondReplay, secondResponse);

    resolveFirstRequest(firstResponse);
    assert.deepEqual(await firstReplay, firstResponse);
  });

  it('replays a later request first when its Retry-After is shorter', async () => {
    const firstOptions = {...conversationOptions, resource: 'conversations/first'};
    const secondOptions = {...conversationOptions, resource: 'conversations/second'};
    const firstResponse = {body: {id: 'first'}};
    const secondResponse = {body: {id: 'second'}};

    webex.request.withArgs(firstOptions).resolves(firstResponse);
    webex.request.withArgs(secondOptions).resolves(secondResponse);

    const firstReplay = interceptor.onResponseError(firstOptions, {
      ...rateLimitReason,
      headers: {'retry-after': '10'},
    });

    await clock.tickAsync(1_000);

    const secondReplay = interceptor.onResponseError(secondOptions, {
      ...rateLimitReason,
      headers: {'retry-after': '2'},
    });

    await clock.tickAsync(1_999);
    assert.notCalled(webex.request);

    await clock.tickAsync(1);
    assert.deepEqual(await secondReplay, secondResponse);
    assert.calledOnceWithExactly(webex.request, secondOptions);

    await clock.tickAsync(6_999);
    assert.calledOnce(webex.request);

    await clock.tickAsync(1);
    assert.deepEqual(await firstReplay, firstResponse);
    assert.calledTwice(webex.request);
    assert.calledWithExactly(webex.request.secondCall, firstOptions);
  });

  it('bounds replay attempts per request', async () => {
    webex.request.rejects(rateLimitReason);

    const replay = interceptor
      .onResponseError(conversationOptions, rateLimitReason)
      .catch((reason) => reason);

    for (let replayIndex = 0; replayIndex < MAX_REPLAYS; replayIndex += 1) {
      // eslint-disable-next-line no-await-in-loop
      await clock.tickAsync(1_000);
    }

    const rejection = await replay;

    assert.strictEqual(rejection, rateLimitReason);
    assert.callCount(webex.request, MAX_REPLAYS);
  });

  ['POST', 'PUT', 'PATCH', 'DELETE'].forEach((method) => {
    it(`does not replay Conversation ${method} requests`, async () => {
      const reason = await interceptor
        .onResponseError({...conversationOptions, method}, rateLimitReason)
        .catch((error) => error);

      assert.strictEqual(reason, rateLimitReason);
      assert.notCalled(webex.request);
    });
  });

  [400, 500, 503].forEach((statusCode) => {
    it(`does not replay HTTP ${statusCode} responses`, async () => {
      const reason = {...rateLimitReason, statusCode};
      const rejection = await interceptor
        .onResponseError(conversationOptions, reason)
        .catch((error) => error);

      assert.strictEqual(rejection, reason);
      assert.notCalled(webex.request);
    });
  });

  it('does not replay another service request', async () => {
    const options = {method: 'GET', service: 'people'};
    const reason = await interceptor
      .onResponseError(options, rateLimitReason)
      .catch((error) => error);

    assert.strictEqual(reason, rateLimitReason);
    assert.notCalled(webex.request);
  });
});
