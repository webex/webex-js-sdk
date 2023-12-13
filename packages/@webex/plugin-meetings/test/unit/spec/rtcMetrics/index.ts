import RtcMetrics from '@webex/plugin-meetings/src/rtcMetrics';
import MockWebex from '@webex/test-helper-mock-webex';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import RTC_METRICS from '../../../../src/rtcMetrics/constants';

const FAKE_METRICS_ITEM = {payload: ['fake-metrics']};

describe.only('RtcMetrics', () => {
  let metrics: RtcMetrics;
  let webex: MockWebex;
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    webex = new MockWebex();
    metrics = new RtcMetrics(webex, 'mock-meeting-id', 'mock-correlation-id');
  });

  it('sendMetrics should send a webex request', () => {
    assert.notCalled(webex.request);

    metrics.addMetrics(FAKE_METRICS_ITEM);
    (metrics as any).sendMetrics();

    assert.callCount(webex.request, 1);
    assert.calledWithMatch(webex.request, sinon.match.has('headers', {
      type: 'webrtcMedia',
      appId: RTC_METRICS.APP_ID,
    }));
    assert.calledWithMatch(webex.request, sinon.match.hasNested('body.metrics[0].data[0].payload', FAKE_METRICS_ITEM.payload));
    assert.calledWithMatch(webex.request, sinon.match.hasNested('body.metrics[0].meetingId', 'mock-meeting-id'));
    assert.calledWithMatch(webex.request, sinon.match.hasNested('body.metrics[0].correlationId', 'mock-correlation-id'));
  });

  it('should have a defined sendMetricsInQueue function which is public', () => {
    assert.isDefined(metrics.sendMetricsInQueue);
    assert.isFunction(metrics.sendMetricsInQueue);
  });

  it('should send metrics requests over time', () => {
    assert.notCalled(webex.request);

    metrics.addMetrics(FAKE_METRICS_ITEM);
    assert.deepEqual(metrics.metricsQueue, [FAKE_METRICS_ITEM]);
    clock.tick(60 * 1000);

    assert.callCount(webex.request, 1);
  });

  it('should not send requests with no items in the queue', () => {
    clock.tick(60 * 1000);
    assert.notCalled(webex.request);
  });

  it('sendMetricsInQueue should send metrics if any exist in the queue', () => {
    assert.notCalled(webex.request);

    metrics.addMetrics(FAKE_METRICS_ITEM);
    (metrics as any).sendMetricsInQueue();

    assert.callCount(webex.request, 1);
  });

  it('should clear out metrics on close', () => {
    assert.notCalled(webex.request);

    metrics.addMetrics(FAKE_METRICS_ITEM);
    metrics.closeMetrics();

    assert.callCount(webex.request, 1);
  });
});
