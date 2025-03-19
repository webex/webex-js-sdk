import {PRODUCT_NAME} from '../../../../src/constants';
import MetricsManager from '../../../../src/metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../../src/metrics/constants';
import {WebexSDK} from '../../../../src/types';
import {EventPayload} from '@webex/internal-plugin-metrics/src/metrics.types';

describe('MetricsManager', () => {
  let webex: WebexSDK;
  let metricsManager: MetricsManager;

  beforeEach(() => {
    webex = {
      internal: {
        newMetrics: {
          submitBehavioralEvent: jest.fn(),
          submitOperationalEvent: jest.fn(),
          submitBusinessEvent: jest.fn(),
        },
      },
      once: jest.fn(),
      ready: true,
    } as unknown as WebexSDK;

    metricsManager = MetricsManager.getInstance({webex});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('trackEvent', () => {

    it('should submit a behavioral, operational and business event when newMetrics is available', () => {
      const eventName = METRIC_EVENT_NAMES.STATION_LOGIN;
      const data: EventPayload = {key: 'value'};

      metricsManager.trackEvent(eventName, data, ['behavioral', 'operational', 'business']);

      expect(webex.internal.newMetrics.submitBehavioralEvent).toHaveBeenCalledTimes(1);
      expect(webex.internal.newMetrics.submitOperationalEvent).toHaveBeenCalledTimes(1);
      expect(webex.internal.newMetrics.submitBusinessEvent).toHaveBeenCalledTimes(1);

      expect(webex.internal.newMetrics.submitBehavioralEvent).toHaveBeenCalledWith({
        product: PRODUCT_NAME,
        agent: 'user',
        target: 'station',
        verb: 'login',
        payload: data,
      });

      expect(webex.internal.newMetrics.submitOperationalEvent).toHaveBeenCalledWith({
        name: METRIC_EVENT_NAMES.STATION_LOGIN,
        payload: data,
      });

      expect(webex.internal.newMetrics.submitBusinessEvent).toHaveBeenCalledWith({
        name: METRIC_EVENT_NAMES.STATION_LOGIN,
        payload: data,
      });
    });

    it('should not submit a behavioral, operational and business event if array is invalid', () => {
      const eventName = METRIC_EVENT_NAMES.STATION_LOGIN;
      const data: EventPayload = {key: 'value'};

      metricsManager.trackEvent(eventName, data, ['nonexistent']);

      expect(webex.internal.newMetrics.submitBehavioralEvent).toHaveBeenCalledTimes(0);
      expect(webex.internal.newMetrics.submitOperationalEvent).toHaveBeenCalledTimes(0);
      expect(webex.internal.newMetrics.submitBusinessEvent).toHaveBeenCalledTimes(0);
    });
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = MetricsManager.getInstance({webex});
      const instance2 = MetricsManager.getInstance({webex});

      expect(instance1).toBe(instance2);
    });

    it('should create a new instance if none exists', () => {
      MetricsManager['instance'] = undefined;

      const instance = MetricsManager.getInstance({webex});

      expect(instance).toBeInstanceOf(MetricsManager);
    });
  });

  describe('timeEvent', () => {
    it('should add a start time to the event payload', () => {
      const eventName = METRIC_EVENT_NAMES.STATION_LOGIN;
      const data: EventPayload = {key: 'value'};

      metricsManager.timeEvent(eventName);
    });
  });
});
