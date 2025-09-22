import {PRODUCT_NAME} from '../../../../src/constants';
import MetricsManager from '../../../../src/metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../../src/metrics/constants';
import {WebexSDK} from '../../../../src/types';
import {EventPayload} from '@webex/internal-plugin-metrics/src/metrics.types';

describe('MetricsManagerImplementation', () => {
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

    MetricsManager.resetInstance();
    metricsManager = MetricsManager.getInstance({webex});
    metricsManager.setMetricsDisabled(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('trackEvent', () => {
    it('should submit a behavioral, operational and business event when newMetrics is available', () => {
      const eventName = METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS;
      const data: EventPayload = {key: 'value'};

      metricsManager.trackEvent(eventName, data, ['behavioral', 'operational', 'business']);

      expect(webex.internal.newMetrics.submitBehavioralEvent).toHaveBeenCalledTimes(1);
      expect(webex.internal.newMetrics.submitOperationalEvent).toHaveBeenCalledTimes(1);
      expect(webex.internal.newMetrics.submitBusinessEvent).toHaveBeenCalledTimes(1);

      expect(webex.internal.newMetrics.submitBehavioralEvent).toHaveBeenCalledWith({
        product: PRODUCT_NAME,
        agent: 'user',
        target: 'station_login',
        verb: 'complete',
        payload: data,
      });

      expect(webex.internal.newMetrics.submitOperationalEvent).toHaveBeenCalledWith({
        name: PRODUCT_NAME.toUpperCase() + "_" + METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS.replace(/ /g, '_').toUpperCase(),
        payload: data,
      });

      expect(webex.internal.newMetrics.submitBusinessEvent).toHaveBeenCalledWith({
        name: PRODUCT_NAME.toUpperCase() + "_" + METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS.replace(/ /g, '_').toUpperCase(),
        payload: data,
        metadata: {
          appType: PRODUCT_NAME,
        }
      });
    });

    it('should not submit a behavioral, operational and business event if array is invalid', () => {
      const eventName = METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS;
      const data: EventPayload = {key: 'value'};

      metricsManager.trackEvent(eventName, data, ['nonexistent']);

      expect(webex.internal.newMetrics.submitBehavioralEvent).toHaveBeenCalledTimes(0);
      expect(webex.internal.newMetrics.submitOperationalEvent).toHaveBeenCalledTimes(0);
      expect(webex.internal.newMetrics.submitBusinessEvent).toHaveBeenCalledTimes(0);
    });

    it('should not submit a behavioral, operational and business event if metricsDisabled is true', () => {
      const eventName = METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS;
      const data: EventPayload = {key: 'value'};

      metricsManager.setMetricsDisabled(true);
      metricsManager.trackEvent(eventName, data, ['behavioral', 'operational', 'business']);

      expect(webex.internal.newMetrics.submitBehavioralEvent).toHaveBeenCalledTimes(0);
      expect(webex.internal.newMetrics.submitOperationalEvent).toHaveBeenCalledTimes(0);
      expect(webex.internal.newMetrics.submitBusinessEvent).toHaveBeenCalledTimes(0);
    });

    it('should not submit a behavioral event if metricsDisabled is true', () => {
      const eventName = METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS;
      const data: EventPayload = {key: 'value'};

      metricsManager.setMetricsDisabled(true);
      metricsManager.trackBehavioralEvent(eventName, data);

      expect(webex.internal.newMetrics.submitBehavioralEvent).toHaveBeenCalledTimes(0);
    });

    it('should not submit a operational event if metricsDisabled is true', () => {
      const eventName = METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS;
      const data: EventPayload = {key: 'value'};

      metricsManager.setMetricsDisabled(true);
      metricsManager.trackOperationalEvent(eventName, data);

      expect(webex.internal.newMetrics.submitOperationalEvent).toHaveBeenCalledTimes(0);
    });

    it('should not submit a business event if metricsDisabled is true', () => {
      const eventName = METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS;
      const data: EventPayload = {key: 'value'};

      metricsManager.setMetricsDisabled(true);
      metricsManager.trackBusinessEvent(eventName, data);

      expect(webex.internal.newMetrics.submitBusinessEvent).toHaveBeenCalledTimes(0);
    });
  });

  describe('clearPendingEvents', () => {
    it('should clear pending events', () => {
      metricsManager['pendingBehavioralEvents'] = [
        {taxonomy: {product: 'wxcc_sdk', agent: 'user', target: 'test', verb: 'get'}, payload: {}},
      ];
      metricsManager['pendingOperationalEvents'] = [{name: 'TEST', payload: {}}];
      metricsManager['pendingBusinessEvents'] = [{name: 'TEST', payload: {}}];
      metricsManager['readyToSubmitEvents'] = true;
      metricsManager['submittingEvents'] = true;
      metricsManager['clearPendingEvents']();
      expect(metricsManager['pendingBehavioralEvents']).toEqual([]);
      expect(metricsManager['pendingOperationalEvents']).toEqual([]);
      expect(metricsManager['pendingBusinessEvents']).toEqual([]);
    });
  });

  describe('setMetricsDisabled', () => {
    it('should set metricsDisabled to true', () => {
      const clearPendingEventsSpy = jest.spyOn(
        MetricsManager.prototype as any,
        'clearPendingEvents'
      );

      metricsManager.setMetricsDisabled(true);

      expect(clearPendingEventsSpy).toHaveBeenCalled();
      expect(metricsManager['metricsDisabled']).toBe(true);
    });
  });

  describe('submitPendingEvents', () => {
    it('should return if submittingEvents is true', async () => {
      metricsManager['submittingEvents'] = true;
      await metricsManager['submitPendingEvents']();
      expect(webex.internal.newMetrics.submitBehavioralEvent).toHaveBeenCalledTimes(0);
      expect(webex.internal.newMetrics.submitOperationalEvent).toHaveBeenCalledTimes(0);
      expect(webex.internal.newMetrics.submitBusinessEvent).toHaveBeenCalledTimes(0);
    });

    it('should submit pending events if there are any', async () => {
      metricsManager['pendingBehavioralEvents'] = [
        {taxonomy: {product: 'wxcc_sdk', agent: 'user', target: 'test', verb: 'get'}, payload: {}},
      ];
      metricsManager['pendingOperationalEvents'] = [{name: 'TEST', payload: {}}];
      metricsManager['pendingBusinessEvents'] = [{name: 'TEST', payload: {}}];
      metricsManager['readyToSubmitEvents'] = true;

      await metricsManager['submitPendingEvents']();

      expect(webex.internal.newMetrics.submitBehavioralEvent).toHaveBeenCalledTimes(1);
      expect(webex.internal.newMetrics.submitOperationalEvent).toHaveBeenCalledTimes(1);
      expect(webex.internal.newMetrics.submitBusinessEvent).toHaveBeenCalledTimes(1);
    });

    it('should not submit events if there are none', async () => {
      metricsManager['pendingBehavioralEvents'] = [];
      metricsManager['pendingOperationalEvents'] = [];
      metricsManager['pendingBusinessEvents'] = [];
      metricsManager['readyToSubmitEvents'] = true;

      await metricsManager['submitPendingEvents']();

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
    it('should not set the event if metrics are disabled', () => {
      jest.spyOn(MetricsManager.prototype as any, 'isMetricsDisabled').mockReturnValue(true);
      const eventName = 'testEvent';

      metricsManager.timeEvent(eventName);

      expect(metricsManager['runningEvents'][eventName]).toBeUndefined();
    });

    it('should set the event with the current timestamp if metrics are enabled', () => {
      jest.spyOn(MetricsManager.prototype as any, 'isMetricsDisabled').mockReturnValue(false);
      const eventName = 'testEvent';
      const mockTimestamp = 1234567890;
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      metricsManager.timeEvent(eventName);

      expect(metricsManager['runningEvents'][eventName]['startTime']).toBe(mockTimestamp);
    });

    it('should set the event with the current timestamp if a single event name is provided and metrics are enabled', () => {
      jest.spyOn(MetricsManager.prototype as any, 'isMetricsDisabled').mockReturnValue(false);
      const eventName = 'testEvent';
      const mockTimestamp = 1234567890;
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);
      metricsManager.timeEvent(eventName);

      expect(metricsManager['runningEvents'][eventName]).toEqual({
        startTime: mockTimestamp,
        keys: new Set([eventName]),
      });
    });

    it('should set the event with an array of keys when metrics are enabled', () => {
      jest.spyOn(MetricsManager.prototype as any, 'isMetricsDisabled').mockReturnValue(false);
      const eventArray = ['eventSuccess', 'eventFailed'];
      const mockTimestamp = 987654321;
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);
      metricsManager.timeEvent(eventArray);

      // The generic key is the first element of the array.
      expect(metricsManager['runningEvents'][eventArray[0]]).toEqual({
        startTime: mockTimestamp,
        keys: new Set(eventArray),
      });
    });
  });

  describe('addDurationIfTimed', () => {
    it('should return options when event name is not in runningEvents', () => {
      const options: EventPayload = {key: 'value'};
      const result = metricsManager['addDurationIfTimed']('event1', options);
      expect(result).toEqual(options);
    });

    it('should add duration to options when event name is in runningEvents and options is provided', () => {
      metricsManager['runningEvents']['event1'] = {
        startTime: 500,
        keys: new Set(['event1']),
      };
      jest.spyOn(Date, 'now').mockImplementation(() => 1000);
      const options: EventPayload = {key: 'value'};
      const result = metricsManager['addDurationIfTimed']('event1', options);
      expect(result).toEqual({key: 'value', duration_ms: 500});
    });

    it('should create a new payload with duration when event name is in runningEvents and options is not provided', () => {
      metricsManager['runningEvents']['event1'] = {
        startTime: 500,
        keys: new Set(['event1']),
      };
      jest.spyOn(Date, 'now').mockImplementation(() => 1000);
      const result = metricsManager['addDurationIfTimed']('event1');
      expect(result).toEqual({duration_ms: 500});
    });

    it('should return options when options is provided but event name is not in runningEvents', () => {
      const options: EventPayload = {key: 'value'};
      jest.spyOn(Date, 'now').mockImplementation(() => 1000);
      const result = metricsManager['addDurationIfTimed']('event2', options);
      expect(result).toEqual(options);
    });

    it('should return an empty object when neither options is provided nor event name is in runningEvents', () => {
      const result = metricsManager['addDurationIfTimed']('event3');
      expect(result).toEqual({});
    });
  });
});

describe('MetricsManagerInstantiation', () => {
  let webexMock: WebexSDK;

  beforeEach(() => {
    MetricsManager.resetInstance();
    webexMock = {
      once: jest.fn(),
      internal: {
        newMetrics: {
          submitBehavioralEvent: jest.fn(),
          submitOperationalEvent: jest.fn(),
          submitBusinessEvent: jest.fn(),
        },
      },
      ready: false,
    } as unknown as WebexSDK;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    MetricsManager.resetInstance();
  });

  afterAll(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    MetricsManager.resetInstance();
  });

  it('should call setReadyToSubmitEvents if webex is ready', () => {
    webexMock.ready = true;
    const setReadyToSubmitEventsSpy = jest.spyOn(
      MetricsManager.prototype as any,
      'setReadyToSubmitEvents'
    );

    MetricsManager.getInstance({webex: webexMock});

    expect(setReadyToSubmitEventsSpy).toHaveBeenCalled();
  });

  it('should call setReadyToSubmitEvents when webex emits ready event', () => {
    webexMock.ready = false;
    const setReadyToSubmitEventsSpy = jest.spyOn(
      MetricsManager.prototype as any,
      'setReadyToSubmitEvents'
    );

    MetricsManager.getInstance({webex: webexMock});
    expect(webexMock.once).toHaveBeenCalledWith('ready', expect.any(Function));
    const readyCallback = (webexMock.once as jest.Mock).mock.calls[0][1];
    readyCallback();

    expect(setReadyToSubmitEventsSpy).toHaveBeenCalled();
    webexMock.ready = true;
  });

  it('should store metrics in queue when instantiated without webex and later emit metrics when webex is provided', () => {

    const instance = MetricsManager.getInstance();
    expect(instance).toBeDefined();
    expect(instance['pendingBehavioralEvents'].length).toBe(0);
    instance.trackEvent(METRIC_EVENT_NAMES.STATION_LOGIN_SUCCESS, {key: 'value'}, ['behavioral']);
    expect(instance['pendingBehavioralEvents'].length).toBe(1);

    const setReadyToSubmitEventsSpy = jest.spyOn(
      MetricsManager.prototype as any,
      'setReadyToSubmitEvents'
    );

    MetricsManager.getInstance({webex: webexMock});
    expect(webexMock.once).toHaveBeenCalledWith('ready', expect.any(Function));
    const readyCallback = (webexMock.once as jest.Mock).mock.calls[0][1];
    readyCallback();

    expect(setReadyToSubmitEventsSpy).toHaveBeenCalled();
  });
});

describe('getCommonTrackingFieldForAQMResponse', () => {
  it('should extract common tracking fields from a response with nested data', () => {
    const response = {
      data: {
        agentId: 'agent1',
        agentSessionId: 'session1',
        teamId: 'team1',
        siteId: 'site1',
        orgId: 'org1',
        trackingId: 'track1'
      },
      trackingId: 'notifTrack1',
      type: 'some_event'
    };
    const expected = {
      agentId: 'agent1',
      agentSessionId: 'session1',
      teamId: 'team1',
      siteId: 'site1',
      orgId: 'org1',
      eventType: 'some_event',
      trackingId: 'track1',
      notifTrackingId: 'notifTrack1'
    };
    const result = MetricsManager.getCommonTrackingFieldForAQMResponse(response);
    expect(result).toEqual(expected);
  });

  it('should extract common tracking fields from a flat response', () => {
    const response = {
      agentId: 'agent2',
      agentSessionId: 'session2',
      teamId: 'team2',
      siteId: 'site2',
      orgId: 'org2',
      type: 'event_type',
      trackingId: 'notifTrack2'
    };
    const expected = {
      agentId: 'agent2',
      agentSessionId: 'session2',
      teamId: 'team2',
      siteId: 'site2',
      orgId: 'org2',
      eventType: 'event_type',
      trackingId: undefined,
      notifTrackingId: 'notifTrack2'
    };
    const result = MetricsManager.getCommonTrackingFieldForAQMResponse(response);
    expect(result).toEqual(expected);
  });

  it('should handle responses with missing fields gracefully', () => {
    const response = {};
    const expected = {
      agentId: undefined,
      agentSessionId: undefined,
      teamId: undefined,
      siteId: undefined,
      orgId: undefined,
      eventType: undefined,
      trackingId: undefined,
      notifTrackingId: undefined
    };
    const result = MetricsManager.getCommonTrackingFieldForAQMResponse(response);
    expect(result).toEqual(expected);
  });
});

describe('getCommonTrackingFieldForAQMResponseFailed', () => {
  it('should extract common tracking fields from a failure response with complete fields', () => {
    const failureResponse = {
      data: {
        agentId: 'agent1',
        reason: 'Some reason',
        reasonCode: 'R001'
      },
      trackingId: 'notifTrack1',
      orgId: 'org1',
      type: 'failure_event'
    };
    const expected = {
      agentId: 'agent1',
      trackingId: 'notifTrack1',
      notifTrackingId: 'notifTrack1',
      orgId: 'org1',
      failureType: 'failure_event',
      failureReason: 'Some reason',
      reasonCode: 'R001'
    };
    const result = MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failureResponse);
    expect(result).toEqual(expected);
  });

  it('should handle failure responses with missing fields gracefully', () => {
    const failureResponse = {
      data: {},
      trackingId: undefined,
      orgId: 'org2',
      type: undefined
    };
    const expected = {
      agentId: undefined,
      trackingId: undefined,
      notifTrackingId: undefined,
      orgId: 'org2',
      failureType: undefined,
      failureReason: undefined,
      reasonCode: undefined
    };
    const result = MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failureResponse);
    expect(result).toEqual(expected);
  });
});
