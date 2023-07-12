import RtcMetrics from '@webex/plugin-meetings/src/rtcMetrics';
import MockWebex from '@webex/test-helper-mock-webex';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

const FAKE_METRICS_ITEM = {payload: ['fake-metrics']};

describe('RtcMetrics', () => {
  let metrics: RtcMetrics;
  let webex: MockWebex;
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    webex = new MockWebex();
    metrics = new RtcMetrics(webex, 'mock-correlation-id');
  });

  it('should send metrics requests', () => {
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
});
