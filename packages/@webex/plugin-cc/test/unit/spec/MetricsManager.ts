import MetricsManager from '../../../src/MetricsManager';
import { WebexSDK } from '../../../src/types';
import { EventPayload } from '@webex/internal-plugin-metrics/src/metrics.types';

describe('MetricsManager', () => {
  let webex: WebexSDK;
  let metricsManager: MetricsManager;

  beforeEach(() => {
    webex = {
      internal: {
        newMetrics: {
          submitBehavioralEvent: jest.fn(),
          submitOperationalEvent: jest.fn(),
        },
      },
    } as unknown as WebexSDK;

    metricsManager = MetricsManager.getInstance({ webex });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('trackBehavioralMetric', () => {
    it('should submit a behavioral event when newMetrics is available', () => {
      const eventName = 'login';
      const data: EventPayload = { key: 'value' };

      metricsManager.trackBehavioralMetric(eventName, data);

      expect(webex.internal.newMetrics.submitBehavioralEvent).toHaveBeenCalledWith({
        product: 'wxcc_desktop',
        agent: 'sdk',
        target: eventName,
        verb: 'load',
        payload: data,
      });
    });

    // it('should not submit a behavioral event when newMetrics is not available', () => {
    //   webex.internal.newMetrics = undefined;

    //   metricsManager.trackBehavioralMetric('login');

    //   expect(webex.internal.newMetrics?.submitBehavioralEvent).not.toHaveBeenCalled();
    // });
  });

  // describe('trackOperationalMetric', () => {
  //   it('should submit an operational event when newMetrics is available', () => {
  //     metricsManager.trackOperationalMetric();

  //     expect(webex.internal.newMetrics.submitOperationalEvent).toHaveBeenCalledWith({
  //       name: 'ccsdk.event',
  //       payload: {
  //         action: 'load',
  //       },
  //     });
  //   });

  // });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = MetricsManager.getInstance({ webex });
      const instance2 = MetricsManager.getInstance({ webex });

      expect(instance1).toBe(instance2);
    });

    it('should create a new instance if none exists', () => {
      MetricsManager['instance'] = undefined;

      const instance = MetricsManager.getInstance({ webex });

      expect(instance).toBeInstanceOf(MetricsManager);
    });
  });
});
