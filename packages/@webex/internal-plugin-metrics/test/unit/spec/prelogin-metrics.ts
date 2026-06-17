import PreLoginMetricsBatcher from '../../../src/prelogin-metrics-batcher';
import {PreLoginMetrics} from '@webex/internal-plugin-metrics';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';

describe('internal-plugin-metrics', () => {
  const mockedWebex: MockWebex = new MockWebex();
  const fakedPreLoginMetricsBatcher: typeof PreLoginMetricsBatcher = new PreLoginMetricsBatcher({}, {parent: mockedWebex});

  describe('prelogin-metrics', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('Should send metrics to preloginMetricsBatcher', async () => {
      const testEvent = 'test';
      const testId = 'abc123';
      const preLoginMetrics = new PreLoginMetrics(fakedPreLoginMetricsBatcher, {}, {parent: mockedWebex});

      sinon.stub(fakedPreLoginMetricsBatcher, 'savePreLoginId');
      const requestSpy = sinon.stub(fakedPreLoginMetricsBatcher, 'request');

      await preLoginMetrics.submitPreLoginEvent({name: testEvent, preLoginId: testId, payload: {}});

      assert.calledOnceWithMatch(requestSpy, {
        type: ['business'],
        eventPayload: {metricName: testEvent, value: {preLoginId: testId}},
      });
    });

    it('Should send metadata to preloginMetricsBatcher', async () => {
      const testEvent = 'test';
      const testId = 'abc123';
      const testMetadata = { 'testKey': 'test-value' };
      const preLoginMetrics = new PreLoginMetrics(fakedPreLoginMetricsBatcher, {}, {parent: mockedWebex});

      sinon.stub(fakedPreLoginMetricsBatcher, 'savePreLoginId');
      const requestSpy = sinon.stub(fakedPreLoginMetricsBatcher, 'request');

      await preLoginMetrics.submitPreLoginEvent({name: testEvent, preLoginId: testId, payload: {}, metadata: testMetadata});

      assert.calledOnceWithMatch(requestSpy, {
        type: ['business'],
        eventPayload: {metricName: testEvent, value: {preLoginId: testId, ...testMetadata}},
      });
    });

    it('Should send payload to preloginMetricsBatcher', async () => {
      const testEvent = 'test';
      const testId = 'abc123';
      const testPayload = { 'testKey': 'test-value' };
      const preLoginMetrics = new PreLoginMetrics(fakedPreLoginMetricsBatcher, {}, {parent: mockedWebex});

      sinon.stub(fakedPreLoginMetricsBatcher, 'savePreLoginId');
      const requestSpy = sinon.stub(fakedPreLoginMetricsBatcher, 'request');

      await preLoginMetrics.submitPreLoginEvent({name: testEvent, preLoginId: testId, payload: testPayload});

      assert.calledOnceWithMatch(requestSpy, {
        type: ['business'],
        eventPayload: {metricName: testEvent, value: {preLoginId: testId, ...testPayload}},
      });
    });

    it('Should fill appType if not defined', async () => {
      const testEvent = 'test';
      const preLoginMetrics = new PreLoginMetrics(fakedPreLoginMetricsBatcher, {}, {parent: mockedWebex});

      sinon.stub(fakedPreLoginMetricsBatcher, 'savePreLoginId');
      const requestSpy = sinon.stub(fakedPreLoginMetricsBatcher, 'request');

      await preLoginMetrics.submitPreLoginEvent({name: testEvent, preLoginId: 'abc123', payload: {}});

      assert.calledOnceWithMatch(requestSpy, {
        type: ['business'],
        eventPayload: {metricName: testEvent, value: {appType: 'Web Client'}},
      });
    });

    it('Should add browser details', async () => {
      const testEvent = 'test';
      const testBrowserDetails = { browser: 'Firefox', domain: 'test.example.com' };
      const preLoginMetrics = new PreLoginMetrics(fakedPreLoginMetricsBatcher, {}, {parent: mockedWebex});

      sinon.stub(preLoginMetrics, 'getBrowserDetails').returns(testBrowserDetails);
      sinon.stub(fakedPreLoginMetricsBatcher, 'savePreLoginId');
      const requestSpy = sinon.stub(fakedPreLoginMetricsBatcher, 'request');

      await preLoginMetrics.submitPreLoginEvent({name: testEvent, preLoginId: 'abc123', payload: {}});

      assert.calledOnceWithMatch(requestSpy, {
        type: ['business'],
        eventPayload: {browserDetails: testBrowserDetails, metricName: testEvent},
      });
    });

    it('Should add context', async () => {
      const testEvent = 'test';
      const testContext = { device: { id: 'abc123' }};
      const preLoginMetrics = new PreLoginMetrics(fakedPreLoginMetricsBatcher, {}, {parent: mockedWebex});

      sinon.stub(preLoginMetrics, 'getContext').returns(testContext);
      sinon.stub(fakedPreLoginMetricsBatcher, 'savePreLoginId');
      const requestSpy = sinon.stub(fakedPreLoginMetricsBatcher, 'request');

      await preLoginMetrics.submitPreLoginEvent({name: testEvent, preLoginId: 'abc123', payload: {}});

      assert.calledOnceWithMatch(requestSpy, {
        type: ['business'],
        eventPayload: {context: testContext, metricName: testEvent},
      });
    });

    it('Should add timestamp', async () => {
      const testEvent = 'test';
      const testTime = 1234;
      const preLoginMetrics = new PreLoginMetrics(fakedPreLoginMetricsBatcher, {}, {parent: mockedWebex});

      sinon.useFakeTimers(testTime);
      sinon.stub(fakedPreLoginMetricsBatcher, 'savePreLoginId');
      const requestSpy = sinon.stub(fakedPreLoginMetricsBatcher, 'request');

      await preLoginMetrics.submitPreLoginEvent({name: testEvent, preLoginId: 'abc123', payload: {}});

      assert.calledOnceWithMatch(requestSpy, {
        type: ['business'],
        eventPayload: {metricName: testEvent, timestamp: testTime},
      });
    });
  });
});
