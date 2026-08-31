import {assert} from '@webex/test-helper-chai';
import sinon, {SinonFakeTimers} from 'sinon';
import uuid from 'uuid';

import config from '@webex/internal-plugin-metrics/src/config';
import * as Telemetry from '@webex/internal-plugin-metrics/src/unhandled-exception-telemetry';

const TEST_USERINFO = ['fixture-user', 'fixture-value'].join(':');

class FakeWindow {
  readonly registrations: Array<{capture: boolean; type: string}> = [];
  readonly removals: Array<{capture: boolean; type: string}> = [];
  private readonly listeners = new Map<string, Array<(event: any) => void>>();

  addEventListener(
    type: string,
    listener: (event: any) => void,
    options?: boolean | {capture?: boolean}
  ) {
    this.registrations.push({
      capture: typeof options === 'boolean' ? options : options?.capture ?? false,
      type,
    });
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(
    type: string,
    listener: (event: any) => void,
    options?: boolean | {capture?: boolean}
  ) {
    this.removals.push({
      capture: typeof options === 'boolean' ? options : options?.capture ?? false,
      type,
    });
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((registeredListener) => registeredListener !== listener)
    );
  }

  dispatch(type: string, event: any) {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  listenerCount(type: string) {
    return this.listeners.get(type)?.length ?? 0;
  }
}

describe('SDK unhandled exception telemetry', () => {
  let browser: FakeWindow;
  let clock: SinonFakeTimers;
  let originalWindow: PropertyDescriptor | undefined;

  const makeWebex = (overrides: Record<string, any> = {}) => ({
    canAuthorize: true,
    version: '4.0.0',
    config: {
      appName: 'test-app',
      appVersion: '1.2.3',
      metrics: {
        unhandledExceptionTelemetry: {
          enabled: true,
          getMetadata: () => ({dataCenter: 'eu-central', orgId: 'org-1', surface: 'meetings'}),
        },
      },
    },
    internal: {
      metrics: {
        submitClientMetrics: sinon.stub().resolves(),
      },
    },
    logger: {
      error: sinon.stub(),
    },
    ...overrides,
  });

  beforeEach(() => {
    clock = sinon.useFakeTimers({now: 1_000, toFake: ['Date', 'setTimeout', 'clearTimeout']});
    sinon.stub(uuid, 'v4').returns('event-1');
    browser = new FakeWindow();
    originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: browser,
    });
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();

    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  });

  it('deduplicates seven matching errors and submits one sanitized event', async () => {
    const webex = makeWebex();
    const error = new TypeError(
      'GET https://api.example.test/media?token=message-secret#fragment failed'
    );

    error.stack =
      'TypeError: GET https://api.example.test/media?token=stack-secret#fragment failed\n at start (https://example.test/app.js?token=filename-secret#fragment:10:20)';
    Telemetry.startUnhandledExceptionTelemetry(webex);
    const errorEvent = {
      error,
      filename: 'https://example.test/app.js?token=secret',
      lineno: 10,
      colno: 20,
    };

    for (let occurrence = 0; occurrence < 7; occurrence += 1) {
      browser.dispatch('error', errorEvent);
    }

    clock.tick(999);
    assert.notCalled(webex.internal.metrics.submitClientMetrics);

    await clock.tickAsync(1);

    const submittedEvent =
      webex.internal.metrics.submitClientMetrics.firstCall.args[1].eventPayload;

    assert.calledOnceWithExactly(
      webex.internal.metrics.submitClientMetrics,
      Telemetry.UNHANDLED_EXCEPTION_METRIC_NAME,
      {
        tags: {
          app_name: 'test-app',
          exception_kind: 'error',
          runtime: 'browser',
        },
        fields: {
          captured_at: 1_000,
          error_fingerprint: submittedEvent.error.fingerprint,
          error_name: 'TypeError',
          event_id: 'event-1',
          occurrence_count: 7,
        },
        eventPayload: submittedEvent,
      },
      undefined
    );
    assert.equal(submittedEvent.error.filename, 'https://example.test/app.js');
    assert.equal(submittedEvent.error.message, 'GET https://api.example.test/media failed');
    assert.equal(
      submittedEvent.error.stack,
      'TypeError: GET https://api.example.test/media failed\n at start (https://example.test/app.js)'
    );
    assert.deepEqual(submittedEvent.metadata, {
      dataCenter: 'eu-central',
      orgId: 'org-1',
      surface: 'meetings',
    });
    assert.include(submittedEvent.common, {
      appName: 'test-app',
      appVersion: '1.2.3',
      runtime: 'browser',
      sdkVersion: '4.0.0',
    });
  });

  it('keeps stackless errors from different source coordinates separate', async () => {
    const webex = makeWebex();

    Telemetry.startUnhandledExceptionTelemetry(webex);
    browser.dispatch('error', {
      message: 'script failed',
      filename: 'https://example.test/app.js',
      lineno: 10,
      colno: 20,
    });
    browser.dispatch('error', {
      message: 'script failed',
      filename: 'https://example.test/app.js',
      lineno: 11,
      colno: 20,
    });

    await clock.tickAsync(1_000);

    assert.calledTwice(webex.internal.metrics.submitClientMetrics);
    assert.deepEqual(
      webex.internal.metrics.submitClientMetrics.args.map(
        ([, properties]: [string, any]) => properties.eventPayload.error.line
      ),
      [10, 11]
    );
    webex.internal.metrics.submitClientMetrics.args.forEach(([, properties]: [string, any]) => {
      assert.equal(properties.eventPayload.occurrenceCount, 1);
    });
  });

  it('removes listeners and flushes pending events from a superseded SDK instance', async () => {
    const staleWebex = makeWebex();
    const currentWebex = makeWebex({
      config: {
        appName: 'current-app',
        metrics: {unhandledExceptionTelemetry: {enabled: true}},
      },
    });

    Telemetry.startUnhandledExceptionTelemetry(staleWebex);
    browser.dispatch('error', {message: 'stale failure'});
    Telemetry.startUnhandledExceptionTelemetry(currentWebex);

    assert.equal(browser.listenerCount('error'), 1);
    assert.equal(browser.listenerCount('unhandledrejection'), 1);

    browser.dispatch('error', {message: 'current failure'});
    await clock.tickAsync(1_000);

    assert.calledOnce(staleWebex.internal.metrics.submitClientMetrics);
    assert.equal(
      staleWebex.internal.metrics.submitClientMetrics.firstCall.args[1].eventPayload.error.message,
      'stale failure'
    );
    assert.calledOnce(currentWebex.internal.metrics.submitClientMetrics);
    assert.equal(
      currentWebex.internal.metrics.submitClientMetrics.firstCall.args[1].eventPayload.error.message,
      'current failure'
    );
  });

  it('removes query parameters and fragments from relative URLs', async () => {
    const webex = makeWebex();
    const error = new Error(
      'GET /api/messages?token=root-secret#fragment or api/messages?token=bare-secret#fragment or GET api?token=single-secret#fragment failed'
    );

    error.stack =
      'Error: GET /api/messages?token=stack-secret#fragment failed\n at load (../scripts/app.js?token=dot-secret#fragment:10:20)\n at retry (scripts/retry.js?token=bare-secret#fragment:30:40)\n at main (app.js?token=single-secret#fragment:50:60)';
    Telemetry.startUnhandledExceptionTelemetry(webex);
    browser.dispatch('error', {error});

    await clock.tickAsync(1_000);

    const submittedError =
      webex.internal.metrics.submitClientMetrics.firstCall.args[1].eventPayload.error;

    assert.equal(submittedError.message, 'GET /api/messages or api/messages or GET api failed');
    assert.equal(
      submittedError.stack,
      'Error: GET /api/messages failed\n at load (../scripts/app.js)\n at retry (scripts/retry.js)\n at main (app.js)'
    );
  });

  it('gives each distinct error a full deduplication window', async () => {
    const webex = makeWebex();

    Telemetry.startUnhandledExceptionTelemetry(webex);
    browser.dispatch('error', {message: 'first failure'});
    clock.tick(500);
    browser.dispatch('error', {message: 'second failure'});

    await clock.tickAsync(500);

    assert.calledOnce(webex.internal.metrics.submitClientMetrics);
    assert.equal(
      webex.internal.metrics.submitClientMetrics.firstCall.args[1].eventPayload.error.message,
      'first failure'
    );

    clock.tick(499);
    assert.calledOnce(webex.internal.metrics.submitClientMetrics);

    await clock.tickAsync(1);

    assert.calledTwice(webex.internal.metrics.submitClientMetrics);
    assert.equal(
      webex.internal.metrics.submitClientMetrics.secondCall.args[1].eventPayload.error.message,
      'second failure'
    );
  });

  it('starts a new window for a matching error when the previous timer is delayed', async () => {
    const webex = makeWebex();
    const errorEvent = {message: 'repeated failure'};

    Telemetry.startUnhandledExceptionTelemetry(webex);
    browser.dispatch('error', errorEvent);
    browser.dispatch('error', errorEvent);

    // Simulate browser timer throttling by advancing wall-clock time without running timers.
    clock.setSystemTime(2_500);
    browser.dispatch('error', errorEvent);

    assert.calledOnce(webex.internal.metrics.submitClientMetrics);
    assert.equal(
      webex.internal.metrics.submitClientMetrics.firstCall.args[1].eventPayload.occurrenceCount,
      2
    );

    await clock.tickAsync(1_000);

    assert.calledTwice(webex.internal.metrics.submitClientMetrics);
    assert.equal(
      webex.internal.metrics.submitClientMetrics.secondCall.args[1].eventPayload.occurrenceCount,
      1
    );
  });

  it('truncates error messages to 4096 characters', async () => {
    const webex = makeWebex();

    Telemetry.startUnhandledExceptionTelemetry(webex);
    browser.dispatch('error', {message: 'x'.repeat(4_097)});

    await clock.tickAsync(1_000);

    assert.lengthOf(
      webex.internal.metrics.submitClientMetrics.firstCall.args[1].eventPayload.error.message,
      4_096
    );
  });

  it('captures promise rejections and resource failures', async () => {
    const webex = makeWebex();

    Telemetry.startUnhandledExceptionTelemetry(webex);
    browser.dispatch('unhandledrejection', {reason: 'promise failed'});
    browser.dispatch('error', {
      target: {
        tagName: 'SCRIPT',
        src: 'https://cdn.example.test/webex.js?token=secret',
      },
    });

    await clock.tickAsync(1_000);

    const errors = webex.internal.metrics.submitClientMetrics.args.map(
      ([, properties]: [string, any]) => properties.eventPayload.error
    );

    assert.include(errors[0], {
      kind: 'unhandledrejection',
      message: 'promise failed',
      name: 'UnhandledRejection',
    });
    assert.include(errors[1], {
      kind: 'resource_error',
      resourceType: 'SCRIPT',
      resourceUrl: 'https://cdn.example.test/webex.js',
    });
  });

  it('contains rejection reasons whose property getters throw', async () => {
    const webex = makeWebex();
    const reason = new Proxy(
      {},
      {
        get() {
          throw new Error('unreadable rejection');
        },
      }
    );

    Telemetry.startUnhandledExceptionTelemetry(webex);

    assert.doesNotThrow(() => browser.dispatch('unhandledrejection', {reason}));

    await clock.tickAsync(1_000);

    assert.notCalled(webex.internal.metrics.submitClientMetrics);
    assert.calledOnceWithExactly(
      webex.logger.error,
      'Unhandled Exception Telemetry -->',
      'Failed to extract an unhandled rejection.'
    );
  });

  it('registers and removes error and rejection listeners in the capture phase', () => {
    Telemetry.startUnhandledExceptionTelemetry(makeWebex());

    assert.deepEqual(browser.registrations, [
      {capture: true, type: 'error'},
      {capture: true, type: 'unhandledrejection'},
    ]);

    Telemetry.startUnhandledExceptionTelemetry(
      makeWebex({config: {metrics: {unhandledExceptionTelemetry: {enabled: false}}}})
    );

    assert.deepEqual(browser.removals, [
      {capture: true, type: 'error'},
      {capture: true, type: 'unhandledrejection'},
    ]);
  });

  it('sanitizes and truncates rejection names before submission', async () => {
    const webex = makeWebex();

    Telemetry.startUnhandledExceptionTelemetry(webex);
    browser.dispatch('unhandledrejection', {
      reason: {
        name: `GET https://${TEST_USERINFO}@example.test/path?token=query-secret ${'x'.repeat(
          300
        )}`,
        message: 'promise failed',
      },
    });

    await clock.tickAsync(1_000);

    const properties = webex.internal.metrics.submitClientMetrics.firstCall.args[1];
    const errorName = properties.eventPayload.error.name;

    assert.lengthOf(errorName, 256);
    assert.match(errorName, /^GET https:\/\/example\.test\/path x+$/);
    assert.equal(properties.fields.error_name, errorName);
    assert.notInclude(JSON.stringify(properties), 'secret');
  });

  it('redacts non-network URLs from error messages and stacks', async () => {
    const webex = makeWebex();
    const error = new Error(
      `url=https://${TEST_USERINFO}@example.test/path?token=message-secret payload=data:text/plain,inline-secret`
    );

    error.stack =
      'Error: resource failed\n at load (payload=blob:https://example.test/stack-secret)';
    Telemetry.startUnhandledExceptionTelemetry(webex);
    browser.dispatch('error', {error});

    await clock.tickAsync(1_000);

    const submittedError =
      webex.internal.metrics.submitClientMetrics.firstCall.args[1].eventPayload.error;

    assert.equal(
      submittedError.message,
      'url=https://example.test/path payload=[redacted-url]'
    );
    assert.equal(
      submittedError.stack,
      'Error: resource failed\n at load (payload=[redacted-url])'
    );
    assert.notInclude(JSON.stringify(submittedError), 'secret');
  });

  it('captures the selected srcset candidate instead of the fallback image source', async () => {
    const webex = makeWebex();

    Telemetry.startUnhandledExceptionTelemetry(webex);
    browser.dispatch('error', {
      target: {
        tagName: 'IMG',
        currentSrc: 'https://cdn.example.test/responsive-image.png?token=secret',
        src: 'https://cdn.example.test/fallback-image.png',
      },
    });

    await clock.tickAsync(1_000);

    const error = webex.internal.metrics.submitClientMetrics.firstCall.args[1].eventPayload.error;

    assert.include(error, {
      kind: 'resource_error',
      resourceType: 'IMG',
      resourceUrl: 'https://cdn.example.test/responsive-image.png',
    });
  });

  it('ignores resource failures from non-network URL schemes', async () => {
    const webex = makeWebex();

    Telemetry.startUnhandledExceptionTelemetry(webex);
    browser.dispatch('error', {
      target: {
        tagName: 'IMG',
        src: 'data:image/svg+xml,<svg>inline-content</svg>',
      },
    });

    await clock.tickAsync(1_000);

    assert.notCalled(webex.internal.metrics.submitClientMetrics);
  });

  it('caps resource URLs before submission', async () => {
    const webex = makeWebex();

    Telemetry.startUnhandledExceptionTelemetry(webex);
    browser.dispatch('error', {
      target: {
        tagName: 'SCRIPT',
        src: `https://cdn.example.test/${'x'.repeat(3_000)}?token=secret`,
      },
    });

    await clock.tickAsync(1_000);

    const resourceUrl =
      webex.internal.metrics.submitClientMetrics.firstCall.args[1].eventPayload.error.resourceUrl;

    assert.lengthOf(resourceUrl, 2_048);
    assert.notInclude(resourceUrl, 'secret');
  });

  it('removes URL userinfo from error and resource telemetry', async () => {
    const webex = makeWebex();
    const error = new Error(
      `GET https://${TEST_USERINFO}@api.example.test/messages?token=query-secret failed`
    );

    error.stack =
      `Error: request failed\n at load (https://${TEST_USERINFO}@example.test/app.js?token=query-secret:10:20)`;
    Telemetry.startUnhandledExceptionTelemetry(webex);
    browser.dispatch('error', {
      error,
      filename: `https://${TEST_USERINFO}@example.test/app.js?token=query-secret#fragment`,
    });

    await clock.tickAsync(1_000);

    const errorTelemetry =
      webex.internal.metrics.submitClientMetrics.firstCall.args[1].eventPayload.error;

    assert.equal(
      errorTelemetry.message,
      'GET https://api.example.test/messages failed'
    );
    assert.equal(
      errorTelemetry.stack,
      'Error: request failed\n at load (https://example.test/app.js)'
    );
    assert.equal(errorTelemetry.filename, 'https://example.test/app.js');

    browser.dispatch('error', {
      target: {
        tagName: 'SCRIPT',
        src: `https://${TEST_USERINFO}@cdn.example.test/app.js?token=query-secret`,
      },
    });

    await clock.tickAsync(1_000);

    const resourceTelemetry =
      webex.internal.metrics.submitClientMetrics.secondCall.args[1].eventPayload.error;

    assert.equal(resourceTelemetry.resourceUrl, 'https://cdn.example.test/app.js');
    assert.notInclude(JSON.stringify({errorTelemetry, resourceTelemetry}), 'secret');
  });

  it('does not install browser listeners when disabled', () => {
    const webex = makeWebex({
      config: {
        metrics: {
          unhandledExceptionTelemetry: {enabled: false},
        },
      },
    });

    Telemetry.startUnhandledExceptionTelemetry(webex);
    assert.isEmpty(browser.registrations);
  });

  it('stops an active reporter when a new SDK instance disables telemetry', async () => {
    const enabledWebex = makeWebex();
    const disabledWebex = makeWebex({
      config: {
        metrics: {
          unhandledExceptionTelemetry: {enabled: false},
        },
      },
    });

    Telemetry.startUnhandledExceptionTelemetry(enabledWebex);
    browser.dispatch('error', {message: 'pending failure'});

    Telemetry.startUnhandledExceptionTelemetry(disabledWebex);
    assert.equal(browser.listenerCount('error'), 0);
    assert.equal(browser.listenerCount('unhandledrejection'), 0);

    browser.dispatch('error', {message: 'ignored failure'});
    await clock.tickAsync(1_000);

    assert.notCalled(enabledWebex.internal.metrics.submitClientMetrics);
    assert.notCalled(disabledWebex.internal.metrics.submitClientMetrics);
  });

  it('does not install browser listeners when not configured', () => {
    const webex = makeWebex({config: {metrics: {}}});

    Telemetry.startUnhandledExceptionTelemetry(webex);
    assert.isEmpty(browser.registrations);
  });

  it('stops an active reporter and discards pending events when the environment is unsupported', async () => {
    const enabledWebex = makeWebex();

    Telemetry.startUnhandledExceptionTelemetry(enabledWebex);
    browser.dispatch('error', {message: 'pending failure'});
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {},
    });

    Telemetry.startUnhandledExceptionTelemetry(makeWebex());
    assert.equal(browser.listenerCount('error'), 0);
    assert.equal(browser.listenerCount('unhandledrejection'), 0);

    await clock.tickAsync(1_000);

    assert.notCalled(enabledWebex.internal.metrics.submitClientMetrics);
  });

  it('contains metadata and submission failures', async () => {
    const webex = makeWebex({
      config: {
        metrics: {
          unhandledExceptionTelemetry: {
            enabled: true,
            getMetadata: () => {
              throw new Error('metadata unavailable');
            },
          },
        },
      },
      internal: {
        metrics: {
          submitClientMetrics: sinon.stub().rejects(new Error('metrics unavailable')),
        },
      },
    });

    Telemetry.startUnhandledExceptionTelemetry(webex);
    browser.dispatch('error', {message: 'application failed'});

    await clock.tickAsync(1_000);

    assert.equal(
      webex.internal.metrics.submitClientMetrics.firstCall.args[1].eventPayload
        .metadataCaptureStatus,
      'provider_error'
    );
    assert.calledOnceWithExactly(
      webex.logger.error,
      'Unhandled Exception Telemetry -->',
      'Failed to submit exception telemetry.'
    );
  });

  it('routes telemetry through pre-login metrics before authentication', async () => {
    const webex = makeWebex({canAuthorize: false});

    Telemetry.startUnhandledExceptionTelemetry(webex);
    browser.dispatch('error', {message: 'pre-login failure'});

    await clock.tickAsync(1_000);

    assert.equal(webex.internal.metrics.submitClientMetrics.firstCall.args[2], 'event-1');
  });

  it('omits metadata that does not serialize to an object', async () => {
    const webex = makeWebex({
      config: {
        metrics: {
          unhandledExceptionTelemetry: {
            enabled: true,
            getMetadata: () => ['not', 'an', 'object'],
          },
        },
      },
    });

    Telemetry.startUnhandledExceptionTelemetry(webex);
    browser.dispatch('error', {message: 'application failed'});

    await clock.tickAsync(1_000);

    const submittedEvent =
      webex.internal.metrics.submitClientMetrics.firstCall.args[1].eventPayload;

    assert.isUndefined(submittedEvent.metadata);
    assert.equal(submittedEvent.metadataCaptureStatus, 'invalid_type');
  });

  it('is disabled by default', () => {
    assert.isFalse(config.metrics.unhandledExceptionTelemetry.enabled);
  });
});
