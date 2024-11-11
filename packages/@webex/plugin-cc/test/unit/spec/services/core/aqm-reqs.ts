/* eslint-disable @typescript-eslint/no-explicit-any */
import AqmReqs from '../../../../../src/services/core/aqm-reqs';
import HttpRequest from '../../../../../src/services/core/HttpRequest';
import LoggerProxy from '../../../../../src/logger-proxy';

jest.mock('../../../../../src/services/core/HttpRequest');
jest.mock('../../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    logger: {
      log: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    },
    initialize: jest.fn(),
  },
}));
const mockHttpRequest = HttpRequest as jest.MockedClass<typeof HttpRequest>;

describe('AqmReqs', () => {
  let httpRequestInstance: jest.Mocked<HttpRequest>;

  beforeEach(() => {
    jest.clearAllMocks();
    httpRequestInstance = new HttpRequest() as jest.Mocked<HttpRequest>;
    mockHttpRequest.getInstance = jest.fn().mockReturnValue(httpRequestInstance);
  });

  it('AqmReqs should be defined', async () => {
    httpRequestInstance.request.mockResolvedValueOnce({
      status: 202,
      data: {webSocketUrl: 'fake-url'},
      statusText: 'OK',
      headers: {},
      config: {},
    });

    const mockWebSocket = {
      on: jest.fn(),
    };

    httpRequestInstance.getWebSocket = jest.fn().mockReturnValue(mockWebSocket);

    const aqm = new AqmReqs();
    const req = aqm.req(() => ({
      url: '/url',
      timeout: 2000,
      notifSuccess: {
        bind: {
          type: 'RoutingMessage',
          data: {type: 'AgentConsultConferenced', interactionId: 'intrid'},
        },
        msg: {},
      },
      notifFail: {
        bind: {
          type: 'RoutingMessage',
          data: {type: 'AgentConsultConferenceFailed'},
        },
        errId: 'Service.aqm.contact.consult',
      },
    }));

    try {
      await req({});
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it('AqmReqs notifcancel', async () => {
    httpRequestInstance.request.mockResolvedValueOnce({
      status: 202,
      data: {webSocketUrl: 'fake-url'},
      statusText: 'OK',
      headers: {},
      config: {},
    });

    const mockWebSocket = {
      on: jest.fn(),
    };

    httpRequestInstance.getWebSocket = jest.fn().mockReturnValue(mockWebSocket);

    const aqm = new AqmReqs();
    const req = aqm.req(() => ({
      url: '/url',
      timeout: 4000,
      notifSuccess: {
        bind: {
          type: 'RoutingMessage',
          data: {
            type: 'AgentConsultCreated',
            interactionId: '6920dda3-337a-48b1-b82d-2333392f9905',
          },
        },
        msg: {},
      },
      notifFail: {
        bind: {
          type: 'RoutingMessage',
          data: {type: 'AgentConsultFailed'},
        },
        errId: 'Service.aqm.contact.consult',
      },
      notifCancel: {
        bind: {
          type: 'RoutingMessage',
          data: {
            type: 'AgentCtqCancelled',
            interactionId: '6920dda3-337a-48b1-b82d-2333392f9905',
          },
        },
        msg: {},
      },
    }));

    try {
      const p = await Promise.all([
        req({}),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            aqm['onMessage']({
              type: 'RoutingMessage',
              data: {
                type: 'AgentCtqCancelled',
                interactionId: '6920dda3-337a-48b1-b82d-2333392f9905',
              },
            });
            resolve();
          }, 1000);
        }),
      ]);
      expect(p).toBeDefined();
    } catch (e) {}
  });

  it('AqmReqs notif success', async () => {
    httpRequestInstance.request.mockResolvedValueOnce({
      status: 202,
      data: {webSocketUrl: 'fake-url'},
      statusText: 'OK',
      headers: {},
      config: {},
    });

    const mockWebSocket = {
      on: jest.fn(),
    };

    httpRequestInstance.getWebSocket = jest.fn().mockReturnValue(mockWebSocket);

    const aqm = new AqmReqs();
    const req = aqm.req(() => ({
      url: '/url',
      timeout: 4000,
      notifSuccess: {
        bind: {
          type: 'RoutingMessage',
          data: {
            type: 'AgentConsultCreated',
            interactionId: '6920dda3-337a-48b1-b82d-2333392f9906',
          },
        },
        msg: {},
      },
      notifFail: {
        bind: {
          type: 'RoutingMessage',
          data: {type: 'AgentConsultFailed'},
        },
        errId: 'Service.aqm.contact.consult',
      },
      notifCancel: {
        bind: {
          type: 'RoutingMessage',
          data: {
            type: 'AgentCtqCancelled',
            interactionId: '6920dda3-337a-48b1-b82d-2333392f9906',
          },
        },
        msg: {},
      },
    }));

    try {
      const p = await Promise.all([
        req({}),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            aqm['onMessage']({
              type: 'RoutingMessage',
              data: {
                type: 'AgentConsultCreated',
                interactionId: '6920dda3-337a-48b1-b82d-2333392f9906',
              },
            });
            resolve();
          }, 1000);
        }),
      ]);
      expect(p).toBeDefined();
    } catch (e) {}
  });

  it('AqmReqs notif success with async error', async () => {
    httpRequestInstance.request.mockRejectedValueOnce(new Error('Async error'));

    const mockWebSocket = {
      on: jest.fn(),
    };

    httpRequestInstance.getWebSocket = jest.fn().mockReturnValue(mockWebSocket);

    const aqm = new AqmReqs();
    const req = aqm.req(() => ({
      url: '/url',
      timeout: 4000,
      notifSuccess: {
        bind: {
          type: 'RoutingMessage',
          data: {
            type: 'AgentConsultCreated',
            interactionId: '6920dda3-337a-48b1-b82d-2333392f9906',
          },
        },
        msg: {},
      },
      notifFail: {
        bind: {
          type: 'RoutingMessage',
          data: {type: 'AgentConsultFailed'},
        },
        errId: 'Service.aqm.contact.consult',
      },
      notifCancel: {
        bind: {
          type: 'RoutingMessage',
          data: {
            type: 'AgentCtqCancelled',
            interactionId: '6920dda3-337a-48b1-b82d-2333392f9906',
          },
        },
        msg: {},
      },
    }));

    try {
      await req({});
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it('AqmReqs notif fail', async () => {
    httpRequestInstance.request.mockResolvedValueOnce({
      status: 202,
      data: {webSocketUrl: 'fake-url'},
      statusText: 'OK',
      headers: {},
      config: {},
    });

    const mockWebSocket = {
      on: jest.fn(),
    };

    httpRequestInstance.getWebSocket = jest.fn().mockReturnValue(mockWebSocket);

    const aqm = new AqmReqs();
    const req = aqm.req(() => ({
      url: '/url',
      timeout: 4000,
      notifSuccess: {
        bind: {
          type: 'RoutingMessage',
          data: {
            type: 'AgentConsultCreated',
            interactionId: '6920dda3-337a-48b1-b82d-2333392f9907',
          },
        },
        msg: {},
      },
      notifFail: {
        bind: {
          type: 'RoutingMessage',
          data: {type: 'AgentConsultFailed'},
        },
        errId: 'Service.aqm.contact.consult',
      },
      notifCancel: {
        bind: {
          type: 'RoutingMessage',
          data: {
            type: 'AgentCtqCancelled',
            interactionId: '6920dda3-337a-48b1-b82d-2333392f9907',
          },
        },
        msg: {},
      },
    }));

    try {
      const p = await Promise.all([
        req({}),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            aqm['onMessage']({
              type: 'RoutingMessage',
              data: {
                type: 'AgentConsultFailed',
                interactionId: '6920dda3-337a-48b1-b82d-2333392f9907',
              },
            });
            resolve();
          }, 1000);
        }),
      ]);
      expect(p).toBeDefined();
    } catch (e) {}
  });

  it('should handle onMessage with Welcome event', () => {
    const mockWebSocket = {
      on: jest.fn(),
    };

    httpRequestInstance.getWebSocket = jest.fn().mockReturnValue(mockWebSocket);

    const aqm = new AqmReqs();

    const event = {
      type: 'Welcome',
    };

    aqm['onMessage'](event);

    expect(LoggerProxy.logger.info).toHaveBeenCalledWith(
      'Welcome message from Notifs Websocket[object Object]'
    );
  });

  it('should handle onMessage with Keepalive event', () => {
    const mockWebSocket = {
      on: jest.fn(),
    };

    httpRequestInstance.getWebSocket = jest.fn().mockReturnValue(mockWebSocket);

    const aqm = new AqmReqs();

    const event = {
      keepalive: true,
    };

    aqm['onMessage'](event);

    expect(LoggerProxy.logger.info).toHaveBeenCalledWith('Keepalive from notifs[object Object]');
  });

  it('should handle onMessage with missing event handler', () => {
    const mockWebSocket = {
      on: jest.fn(),
    };

    httpRequestInstance.getWebSocket = jest.fn().mockReturnValue(mockWebSocket);

    const aqm = new AqmReqs();

    const event = {
      type: 'UnknownEvent',
    };

    aqm['onMessage'](event);

    expect(LoggerProxy.logger.info).toHaveBeenCalledWith(
      'event=missingEventHandler | [AqmReqs] missing routing message handler[object Object]'
    );
  });
});
