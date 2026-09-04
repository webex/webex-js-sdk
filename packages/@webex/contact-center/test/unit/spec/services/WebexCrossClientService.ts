import WebexCrossClientService from '../../../../src/services/WebexCrossClientService';
import MetricsManager from '../../../../src/metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../../src/metrics/constants';

jest.mock('../../../../src/metrics/MetricsManager', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(),
  },
}));

describe('WebexCrossClientService', () => {
  const userId = 'user-123';
  const deviceUrl = 'https://wdm.example.com/devices/device-abc';
  const trackEvent = jest.fn();
  const timeEvent = jest.fn();
  const cancelTimedEvent = jest.fn();

  let webex: {request: jest.Mock; internal: {device: {userId: string; url: string}}};
  let service: WebexCrossClientService;

  beforeEach(() => {
    trackEvent.mockClear();
    timeEvent.mockClear();
    cancelTimedEvent.mockClear();
    (MetricsManager.getInstance as jest.Mock).mockReturnValue({trackEvent, timeEvent, cancelTimedEvent});

    webex = {
      request: jest.fn().mockResolvedValue({body: {}}),
      internal: {
        device: {userId, url: deviceUrl},
      },
    };
    service = new WebexCrossClientService(webex as never);
  });

  afterEach(() => {
    service.teardown();
  });

  it('publishes usersub with appName wxcc (Agent Desktop parity)', async () => {
    await service.setManageWebexCallingInWxcc(true);

    expect(webex.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        service: 'usersub',
        resource: 'publish',
        body: expect.objectContaining({
          users: [userId],
          compositions: [
            expect.objectContaining({
              type: 'cross-client-state',
              ttl: 900,
              composition: {
                devices: [
                  {
                    deviceId: 'device-abc',
                    appName: 'wxcc',
                    state: {'answer-calls-on-wxcc': true},
                  },
                ],
              },
            }),
          ],
        }),
      })
    );
  });

  it('publishes false when suppression is disabled', async () => {
    await service.setManageWebexCallingInWxcc(false);

    expect(webex.request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          compositions: [
            expect.objectContaining({
              composition: {
                devices: [
                  {
                    deviceId: 'device-abc',
                    appName: 'wxcc',
                    state: {'answer-calls-on-wxcc': false},
                  },
                ],
              },
            }),
          ],
        }),
      })
    );
  });

  it('throws when user ID is unavailable', async () => {
    webex.internal.device.userId = undefined as unknown as string;

    await expect(service.setManageWebexCallingInWxcc(true)).rejects.toThrow(
      'User ID is unavailable for cross-client publish'
    );
    expect(webex.request).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('emits usersub publish failed when user ID is unavailable and trackPublishMetrics is true', async () => {
    webex.internal.device.userId = undefined as unknown as string;

    await expect(
      service.setManageWebexCallingInWxcc(true, {trackPublishMetrics: true})
    ).rejects.toThrow('User ID is unavailable for cross-client publish');

    expect(trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_USERSUB_PUBLISH_FAILED,
      expect.objectContaining({
        enableWxBetterTogether: true,
        skipReason: 'user_id_unavailable',
      }),
      ['operational', 'behavioral']
    );
    expect(timeEvent).not.toHaveBeenCalled();
    expect(webex.request).not.toHaveBeenCalled();
  });

  it('throws when device URL is unavailable', async () => {
    webex.internal.device.url = undefined as unknown as string;

    await expect(service.setManageWebexCallingInWxcc(true)).rejects.toThrow(
      'Device URL is unavailable for cross-client publish'
    );
    expect(webex.request).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('emits usersub publish failed when device URL is unavailable and trackPublishMetrics is true', async () => {
    webex.internal.device.url = undefined as unknown as string;

    await expect(
      service.setManageWebexCallingInWxcc(true, {trackPublishMetrics: true})
    ).rejects.toThrow('Device URL is unavailable for cross-client publish');

    expect(trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_USERSUB_PUBLISH_FAILED,
      expect.objectContaining({
        enableWxBetterTogether: true,
        skipReason: 'device_url_unavailable',
      }),
      ['operational', 'behavioral']
    );
    expect(timeEvent).not.toHaveBeenCalled();
    expect(webex.request).not.toHaveBeenCalled();
  });

  it('rejects when usersub publish fails', async () => {
    const err = new Error('usersub failed');
    webex.request = jest.fn().mockRejectedValue(err);

    await expect(
      service.setManageWebexCallingInWxcc(true, {trackPublishMetrics: true})
    ).rejects.toThrow('usersub failed');

    expect(trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_USERSUB_PUBLISH_FAILED,
      expect.objectContaining({enableWxBetterTogether: true}),
      ['operational', 'behavioral']
    );
  });

  it('tracks usersub publish success when trackPublishMetrics is enabled', async () => {
    await service.setManageWebexCallingInWxcc(true, {trackPublishMetrics: true});

    expect(timeEvent).toHaveBeenCalledWith([
      METRIC_EVENT_NAMES.WXAPP_USERSUB_PUBLISH_SUCCESS,
      METRIC_EVENT_NAMES.WXAPP_USERSUB_PUBLISH_FAILED,
    ]);
    expect(trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.WXAPP_USERSUB_PUBLISH_SUCCESS,
      {enableWxBetterTogether: true},
      ['operational', 'behavioral']
    );
  });

  it('cancels usersub publish timer when publish completes after teardown bumps generation', async () => {
    let resolvePublish: (value: {body: Record<string, never>}) => void;
    const publishPromise = new Promise<{body: Record<string, never>}>((resolve) => {
      resolvePublish = resolve;
    });
    webex.request = jest.fn().mockReturnValue(publishPromise);

    const publishCall = service.setManageWebexCallingInWxcc(true, {trackPublishMetrics: true});
    service.teardown();
    resolvePublish!({body: {}});
    await publishCall;

    expect(cancelTimedEvent).toHaveBeenCalledWith([
      METRIC_EVENT_NAMES.WXAPP_USERSUB_PUBLISH_SUCCESS,
      METRIC_EVENT_NAMES.WXAPP_USERSUB_PUBLISH_FAILED,
    ]);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('cancels usersub publish timer when publish fails after teardown bumps generation', async () => {
    let rejectPublish: (error: Error) => void;
    const publishPromise = new Promise((_, reject) => {
      rejectPublish = reject;
    });
    webex.request = jest.fn().mockReturnValue(publishPromise);

    const publishCall = service.setManageWebexCallingInWxcc(true, {trackPublishMetrics: true});
    service.teardown();
    rejectPublish!(new Error('usersub failed'));
    await expect(publishCall).rejects.toThrow('usersub failed');

    expect(cancelTimedEvent).toHaveBeenCalledWith([
      METRIC_EVENT_NAMES.WXAPP_USERSUB_PUBLISH_SUCCESS,
      METRIC_EVENT_NAMES.WXAPP_USERSUB_PUBLISH_FAILED,
    ]);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('does not track usersub metrics by default', async () => {
    await service.setManageWebexCallingInWxcc(true);

    expect(trackEvent).not.toHaveBeenCalled();
    expect(timeEvent).not.toHaveBeenCalled();
  });

  it('uses custom ttl from options', async () => {
    await service.setManageWebexCallingInWxcc(true, {ttl: 1200});

    expect(webex.request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          compositions: [expect.objectContaining({ttl: 1200})],
        }),
      })
    );
  });

  it('refreshes publish before ttl expiry while enabled', async () => {
    jest.useFakeTimers();
    try {
      await service.setManageWebexCallingInWxcc(true, {ttl: 900});
      expect(webex.request).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(840_000);

      await Promise.resolve();

      expect(webex.request).toHaveBeenCalledTimes(2);
      expect(webex.request).toHaveBeenLastCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            compositions: [
              expect.objectContaining({
                composition: {
                  devices: [
                    {
                      deviceId: 'device-abc',
                      appName: 'wxcc',
                      state: {'answer-calls-on-wxcc': true},
                    },
                  ],
                },
              }),
            ],
          }),
        })
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('retries failed refresh publish before ttl expiry', async () => {
    jest.useFakeTimers();
    try {
      const setManageSpy = jest.spyOn(service, 'setManageWebexCallingInWxcc');
      webex.request = jest
        .fn()
        .mockResolvedValueOnce({body: {}})
        .mockRejectedValueOnce(new Error('refresh failed'))
        .mockResolvedValueOnce({body: {}});

      await service.setManageWebexCallingInWxcc(true, {ttl: 900});
      expect(webex.request).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(840_000);
      await expect(setManageSpy.mock.results[1].value).rejects.toThrow('refresh failed');
      expect(webex.request).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(30_000);
      await setManageSpy.mock.results[2].value;

      expect(webex.request).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('schedules bounded retry when scheduled refresh publish fails', async () => {
    jest.useFakeTimers();
    try {
      const setManageSpy = jest.spyOn(service, 'setManageWebexCallingInWxcc');
      webex.request = jest
        .fn()
        .mockResolvedValueOnce({body: {}})
        .mockRejectedValueOnce(new Error('refresh failed'));

      await service.setManageWebexCallingInWxcc(true, {ttl: 900});
      const scheduleRefreshRetrySpy = jest.spyOn(service as any, 'scheduleRefreshRetry');

      jest.advanceTimersByTime(840_000);
      await expect(setManageSpy.mock.results[1].value).rejects.toThrow('refresh failed');
      expect(scheduleRefreshRetrySpy).toHaveBeenCalledWith(userId, 900, 0, 0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not retry refresh after teardown bumps generation', async () => {
    jest.useFakeTimers();
    try {
      const setManageSpy = jest.spyOn(service, 'setManageWebexCallingInWxcc');
      webex.request = jest
        .fn()
        .mockResolvedValueOnce({body: {}})
        .mockRejectedValueOnce(new Error('refresh failed'));

      await service.setManageWebexCallingInWxcc(true, {ttl: 900});

      jest.advanceTimersByTime(840_000);
      await expect(setManageSpy.mock.results[1].value).rejects.toThrow('refresh failed');

      service.teardown();

      jest.advanceTimersByTime(30_000);
      await Promise.resolve();

      expect(webex.request).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('teardown clears refresh timer so publish is not repeated', async () => {
    jest.useFakeTimers();
    try {
      await service.setManageWebexCallingInWxcc(true, {ttl: 900});
      service.teardown();

      jest.advanceTimersByTime(840_000);
      await Promise.resolve();

      expect(webex.request).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not schedule refresh when disabled', async () => {
    jest.useFakeTimers();
    try {
      await service.setManageWebexCallingInWxcc(false);

      jest.advanceTimersByTime(840_000);
      await Promise.resolve();

      expect(webex.request).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports whether answer-calls-on-wxcc true was published', async () => {
    expect(service.isAnswerCallsStateActive()).toBe(false);

    await service.setManageWebexCallingInWxcc(true);

    expect(service.isAnswerCallsStateActive()).toBe(true);

    await service.setManageWebexCallingInWxcc(false);

    expect(service.isAnswerCallsStateActive()).toBe(false);
  });
});
