import WebexCrossClientService from '../../../../src/services/WebexCrossClientService';

describe('WebexCrossClientService', () => {
  const userId = 'user-123';
  const deviceUrl = 'https://wdm.example.com/devices/device-abc';

  let webex: {request: jest.Mock; internal: {device: {userId: string; url: string}}};
  let service: WebexCrossClientService;

  beforeEach(() => {
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
  });

  it('throws when device URL is unavailable', async () => {
    webex.internal.device.url = undefined as unknown as string;

    await expect(service.setManageWebexCallingInWxcc(true)).rejects.toThrow(
      'Device URL is unavailable for cross-client publish'
    );
    expect(webex.request).not.toHaveBeenCalled();
  });

  it('rejects when usersub publish fails', async () => {
    const err = new Error('usersub failed');
    webex.request = jest.fn().mockRejectedValue(err);

    await expect(service.setManageWebexCallingInWxcc(true)).rejects.toThrow('usersub failed');
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
});
