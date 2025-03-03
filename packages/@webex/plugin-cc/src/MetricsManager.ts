import {EventPayload} from '@webex/internal-plugin-metrics/src/metrics.types';

import {WebexSDK} from './types';

type eventNames = 'login' | 'agent-login' | 'agent-logout';

class MetricsManager {
  private webex: WebexSDK;
  // eslint-disable-next-line no-use-before-define
  private static instance: MetricsManager;

  private constructor({webex}: {webex: WebexSDK}) {
    this.webex = webex;
  }

  public trackBehavioralMetric(eventName: eventNames, data?: EventPayload) {
    if (this.webex?.internal?.newMetrics) {
      this.webex.internal.newMetrics.submitBehavioralEvent({
        product: 'wxcc_desktop',
        agent: 'sdk',
        target: eventName,
        verb: 'load',
        payload: data,
      });
    }
  }

  public trackOperationalMetric(eventName: string, payload?: EventPayload) {
    if (this.webex?.internal?.newMetrics) {
      this.webex.internal.newMetrics.submitOperationalEvent({
        name: eventName,
        payload,
      });
    }
  }

  // Make the class a singleton
  public static getInstance(options: {webex: WebexSDK}): MetricsManager {
    if (!MetricsManager.instance) {
      MetricsManager.instance = new MetricsManager(options);
    }

    return MetricsManager.instance;
  }
}

export default MetricsManager;
