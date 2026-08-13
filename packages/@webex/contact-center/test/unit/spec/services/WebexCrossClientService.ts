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
});
