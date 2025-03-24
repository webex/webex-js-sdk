import AqmReqs from '../../../../../src/services/core/aqm-reqs';
import HttpRequest from '../../../../../src/services/core/HttpRequest';

import LoggerProxy from '../../../../../src/logger-proxy';
import {IHttpResponse} from '../../../../../src/types';
import {AQM_REQS_FILE} from '../../../../../src/constants';
import {WebSocketManager} from '../../../../../src/services/core/websocket/WebSocketManager';

jest.mock('../../../../../src/services/core/HttpRequest');
jest.mock('../../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    initialize: jest.fn(),
  },
}));
jest.mock('../../../../../src/services/core/websocket/WebSocketManager');

// Mock CustomEvent class
class MockCustomEvent<T> extends Event {
  detail: T;

  constructor(event: string, params: { detail: T }) {
    super(event);
    this.detail = params.detail;
  }
}

global.CustomEvent = MockCustomEvent as any;

global.window = {
  setTimeout: global.setTimeout,
} as any;

const mockHttpRequest = HttpRequest as jest.MockedClass<typeof HttpRequest>;
const mockWebSocketManager = WebSocketManager as jest.MockedClass<typeof WebSocketManager>;

describe('AqmReqs', () => {
  let httpRequestInstance: jest.Mocked<HttpRequest>;
  let webSocketManagerInstance: jest.Mocked<WebSocketManager>;
  const mockHttpRequestResolvedValue: IHttpResponse = {
    status: 202,
    data: { webSocketUrl: 'fake-url' },
    statusText: 'OK',
    headers: {},
    config: {},
  };
  let aqm: AqmReqs;

  beforeEach(() => {
    jest.clearAllMocks();
    httpRequestInstance = new HttpRequest() as jest.Mocked<HttpRequest>;
    mockHttpRequest.getInstance = jest.fn().mockReturnValue(httpRequestInstance);

    const mockWorker = {
      postMessage: jest.fn(),
      onmessage: jest.fn(),
    };

    global.Worker = jest.fn(() => mockWorker) as any;

    webSocketManagerInstance = new WebSocketManager({
      webex: {} as any,
    }) as jest.Mocked<WebSocketManager>;

    // Mock the on method to handle event listeners
    const eventListeners: { [key: string]: Function[] } = {};
    webSocketManagerInstance.on = jest.fn((event: string, listener: Function) => {
      if (!eventListeners[event]) {
        eventListeners[event] = [];
      }
      eventListeners[event].push(listener);
    });
  
    // Mock the emit method to directly call the registered listeners
    webSocketManagerInstance.emit = (event: string, ...args: any[]) => {
      if (eventListeners[event]) {
        eventListeners[event].forEach((listener) => listener(...args));
      }
    };


    aqm = new AqmReqs(webSocketManagerInstance);
    mockWebSocketManager.mockImplementation(() => webSocketManagerInstance);
  });

  it('AqmReqs should be defined', async () => {
    httpRequestInstance.request.mockResolvedValueOnce(mockHttpRequestResolvedValue);

    const req = aqm.req(() => ({
      url: '/url',
      timeout: 2000,
      notifSuccess: {
        bind: {
          type: 'RoutingMessage',
          data: { type: 'AgentConsultConferenced', interactionId: 'intrid' },
        },
        msg: {},
      },
      notifFail: {
        bind: {
          type: 'RoutingMessage',
          data: { type: 'AgentConsultConferenceFailed' },
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

  describe('Aqm notifs', () => {
    it('AqmReqs notifcancel', async () => {
      httpRequestInstance.request.mockResolvedValueOnce(mockHttpRequestResolvedValue);
    
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
            data: { type: 'AgentConsultFailed' },
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
              webSocketManagerInstance.emit(
                'message',
                JSON.stringify({
                  type: 'RoutingMessage',
                  data: {
                    type: 'AgentCtqCancelled',
                    interactionId: '6920dda3-337a-48b1-b82d-2333392f9905',
                  },
                })
              );
              resolve();
            }, 1000);
          }),
        ]);
        expect(p).toBeDefined();
      } catch (e) {}
    });

    it('AqmReqs notif success', async () => {
      httpRequestInstance.request.mockResolvedValueOnce(mockHttpRequestResolvedValue);
    
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
            data: { type: 'AgentConsultFailed' },
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
              webSocketManagerInstance.emit(
                'message',
                JSON.stringify({
                  type: 'RoutingMessage',
                  data: {
                    type: 'AgentConsultCreated',
                    interactionId: '6920dda3-337a-48b1-b82d-2333392f9906',
                  },
                })
              );
              resolve();
            }, 1000);
          }),
        ]);
        expect(p).toBeDefined();
      } catch (e) {}
    });

    it('AqmReqs notif success with async error', async () => {
      httpRequestInstance.request.mockRejectedValueOnce(new Error('Async error'));

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
            data: { type: 'AgentConsultFailed' },
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
      httpRequestInstance.request.mockResolvedValueOnce(mockHttpRequestResolvedValue);
    
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
            data: { type: 'AgentConsultFailed' },
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
              webSocketManagerInstance.emit(
                'message',
                JSON.stringify({
                  type: 'RoutingMessage',
                  data: {
                    type: 'AgentConsultFailed',
                    interactionId: '6920dda3-337a-48b1-b82d-2333392f9907',
                  },
                })
              );
              resolve();
            }, 1000);
          }),
        ]);
        expect(p).toBeDefined();
      } catch (e) {}
    });
  });

  describe('Event tests', () => {
    it('should handle onMessage events', async () => {
      httpRequestInstance.request.mockResolvedValueOnce(mockHttpRequestResolvedValue);
    
      const req = aqm.req(() => ({
        url: '/url',
        timeout: 2000,
        notifSuccess: {
          bind: {
            type: 'RoutingMessage',
            data: { type: 'AgentConsultConferenced', interactionId: 'intrid' },
          },
          msg: {},
        },
        notifFail: {
          bind: {
            type: 'RoutingMessage',
            data: { type: 'AgentConsultConferenceFailed' },
          },
          errId: 'Service.aqm.contact.consult',
        },
      }));
    
      try {
        await req({});
      } catch (e) {
        expect(e).toBeDefined();
      }
    
      // Welcome event
      webSocketManagerInstance.emit(
        'message',
        JSON.stringify({
          type: 'Welcome',
          data: { type: 'WelcomeEvent' },
        })
      );
    
      expect(LoggerProxy.info).toHaveBeenCalledWith("Welcome message from Notifs Websocket", {"method": "onMessage", "module": AQM_REQS_FILE});
    
      // Keep-alive events
      webSocketManagerInstance.emit(
        'message',
        JSON.stringify({
          keepalive: 'true',
          data: { type: 'KeepaliveEvent' },
        })
      );
    
      expect(LoggerProxy.info).toHaveBeenCalledWith('Keepalive from web socket', {"method": "onMessage", "module": AQM_REQS_FILE});
    
      // Unhandled event
      webSocketManagerInstance.emit(
        'message',
        JSON.stringify({
          type: 'UnhandledMessage',
          data: { type: 'UnhandledEvent' },
        })
      );
    
      expect(LoggerProxy.info).toHaveBeenCalledWith(
        'event=missingEventHandler | [AqmReqs] missing routing message handler', {"method": "onMessage", "module": AQM_REQS_FILE}
      );
    });

    it('should correctly print bind object', () => {
      const bind = {
        type: 'RoutingMessage',
        data: {
          type: 'AgentConsultCreated',
          interactionId: 'intrid',
        },
      };
      const result = aqm['bindPrint'](bind);
      expect(result).toBe(
        'type=RoutingMessage,data=(type=AgentConsultCreated,interactionId=intrid)'
      );
    });

    it('should correctly check bind object', () => {
      const bind = {
        type: 'RoutingMessage',
        data: {
          type: 'AgentConsultCreated',
          interactionId: 'intrid',
        },
      };
      const msg = {
        type: 'RoutingMessage',
        data: {
          type: 'AgentConsultCreated',
          interactionId: 'intrid',
        },
      };
      const result = aqm['bindCheck'](bind, msg);
      expect(result).toBe(true);
    });

    it('should return false when message value does not match any of the values in the array', () => {
      const bind = {
        type: 'RoutingMessage',
        data: {
          type: ['AgentConsultCreated', 'AgentConsultFailed'],
          interactionId: 'intrid',
        },
      };
      const msg = {
        type: 'RoutingMessage',
        data: {
          type: 'AgentConsultConferenced', // This value does not match any value in the bind array
          interactionId: 'intrid',
        },
      };
      const result = aqm['bindCheck'](bind, msg);
      expect(result).toBe(false);
    });

    it('should handle reqEmpty', async () => {
      httpRequestInstance.request.mockResolvedValueOnce(mockHttpRequestResolvedValue);

      const reqEmpty = aqm.reqEmpty(() => ({
        url: '/url',
        timeout: 2000,
        notifSuccess: {
          bind: {
            type: 'RoutingMessage',
            data: { type: 'AgentConsultConferenced', interactionId: 'intrid' },
          },
          msg: {},
        },
        notifFail: {
          bind: {
            type: 'RoutingMessage',
            data: { type: 'AgentConsultConferenceFailed' },
          },
          errId: 'Service.aqm.contact.consult',
        },
      }));

      try {
        await reqEmpty();
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it('should handle failed request with err function', async () => {
      httpRequestInstance.request.mockResolvedValueOnce(mockHttpRequestResolvedValue);
    
      const conf = {
        host: 'fake-host',
        url: '/url',
        method: 'POST',
        data: {},
        notifSuccess: {
          bind: {
            type: 'RoutingMessage',
            data: { type: 'AgentConsultCreated', interactionId: 'intrid' },
          },
        },
        notifFail: {
          bind: {
            type: 'RoutingMessage',
            data: { type: 'AgentConsultFailed' },
          },
          err: (msg: any) => new Error('Custom error'),
        },
      };
    
      const promise = aqm['createPromise'](conf);
      global.setTimeout(() => {
        webSocketManagerInstance.emit(
          'message',
          JSON.stringify({
            type: 'RoutingMessage',
            data: {
              type: 'AgentConsultFailed',
              interactionId: 'intrid',
            },
          })
        );
      }, 0);
    
      await expect(promise).rejects.toThrow('Custom error');
    });

    it('should handle request with notifCancel', async () => {
      httpRequestInstance.request.mockResolvedValueOnce(mockHttpRequestResolvedValue);
    
      const conf = {
        host: 'fake-host',
        url: '/url',
        method: 'POST',
        data: {},
        notifSuccess: {
          bind: {
            type: 'RoutingMessage',
            data: { type: 'AgentConsultCreated', interactionId: 'intrid' },
          },
        },
        notifFail: {
          bind: {
            type: 'RoutingMessage',
            data: { type: 'AgentConsultFailed' },
          },
          errId: 'Service.aqm.contact.consult',
        },
        notifCancel: {
          bind: {
            type: 'RoutingMessage',
            data: { type: 'AgentCtqCancelled', interactionId: 'intrid' },
          },
        },
      };
    
      const promise = aqm['createPromise'](conf);
      const eventData = {
        type: 'RoutingMessage',
        data: {
          type: 'AgentCtqCancelled',
          interactionId: 'intrid',
        },
      };
      global.setTimeout(() => {
        webSocketManagerInstance.emit(
          'message',
          JSON.stringify(eventData)
        );
      }, 0);
    
      const result = await promise;
      expect(result).toEqual(eventData);
    });
  });
});