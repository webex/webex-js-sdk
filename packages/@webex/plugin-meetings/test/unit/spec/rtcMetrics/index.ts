import 'jsdom-global/register';
import RtcMetrics from '@webex/plugin-meetings/src/rtcMetrics';
import MockWebex from '@webex/test-helper-mock-webex';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import RTC_METRICS from '../../../../src/rtcMetrics/constants';

const FAKE_METRICS_ITEM = {payload: ['{"type":"string","value":"fake-metrics","id":""}']};
const FAILURE_METRICS_ITEM = {
  name: "onconnectionstatechange",
  payload: ['{"type":"string","value":"failed","id":""}'],
  timestamp: 1707929986667
};

const STATS_WITH_IP = '{"id":"RTCIceCandidate_/kQs0ZNU","type":"remote-candidate","transportId":"RTCTransport_0_1","isRemote":true,"ip":"11.22.111.255","address":"11.22.111.255","port":5004,"protocol":"udp","candidateType":"host","priority":2130706431}';
const STATS_WITH_IP_RESULT = '{"id":"RTCIceCandidate_/kQs0ZNU","type":"remote-candidate","transportId":"RTCTransport_0_1","isRemote":true,"ip":"11.22.111.240","address":"11.22.111.240","port":5004,"protocol":"udp","candidateType":"host","priority":2130706431}';

describe('RtcMetrics', () => {
  let metrics: RtcMetrics;
  let webex: MockWebex;
  let clock;
  let anonymizeIpSpy;

  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    webex = new MockWebex();
    metrics = new RtcMetrics(webex, 'mock-meeting-id', 'mock-correlation-id');
    anonymizeIpSpy = sandbox.spy(metrics, 'anonymizeIp');
  });

  afterEach(() => {
    sandbox.restore();
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

  it('should clear out metrics on failure', () => {
    assert.notCalled(webex.request);

    metrics.addMetrics(FAILURE_METRICS_ITEM);

    assert.callCount(webex.request, 1);
  });

  it('should have the same connectionId on success', () => {
    const originalId = metrics.connectionId;

    metrics.addMetrics(FAKE_METRICS_ITEM);

    assert.strictEqual(originalId, metrics.connectionId);
  });

  it('should have a new connectionId on failure', () => {
    const originalId = metrics.connectionId;

    metrics.addMetrics(FAILURE_METRICS_ITEM);

    assert.notEqual(originalId, metrics.connectionId);
  });

  it('should anonymize IP addresses', () => {
    assert.strictEqual(metrics.anonymizeIp(STATS_WITH_IP), STATS_WITH_IP_RESULT);
  });

  it('should call anonymizeIp', () => {
    metrics.addMetrics({ name: 'stats-report', payload: [STATS_WITH_IP] });
    assert.calledOnce(anonymizeIpSpy);
  })

  it('should send metrics on first stats-report', () => {
    assert.callCount(webex.request, 0);

    metrics.addMetrics(FAKE_METRICS_ITEM);
    assert.callCount(webex.request, 0);

    // first stats-report should trigger a call to webex.request
    metrics.addMetrics({ name: 'stats-report', payload: [STATS_WITH_IP] });
    assert.callCount(webex.request, 1);
  });

  it('should send metrics on first stats-report after a new connection', () => {
    assert.callCount(webex.request, 0);

    // first stats-report should trigger a call to webex.request
    metrics.addMetrics({ name: 'stats-report', payload: [STATS_WITH_IP] });
    assert.callCount(webex.request, 1);

    // subsequent stats-report doesn't trigger it
    metrics.addMetrics({ name: 'stats-report', payload: [STATS_WITH_IP] });
    assert.callCount(webex.request, 1);

    // now, simulate a failure - that triggers a new connection and upload of the metrics
    metrics.addMetrics(FAILURE_METRICS_ITEM);
    assert.callCount(webex.request, 2);

    // and another stats-report should trigger another upload of the metrics
    metrics.addMetrics({ name: 'stats-report', payload: [STATS_WITH_IP] });
    assert.callCount(webex.request, 3);
  });
});
