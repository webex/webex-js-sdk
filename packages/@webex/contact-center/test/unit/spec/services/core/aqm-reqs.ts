import AqmReqs from '../../../../../src/services/core/aqm-reqs';
import WebexRequest from '../../../../../src/services/core/WebexRequest';

import LoggerProxy from '../../../../../src/logger-proxy';
import MetricsManager from '../../../../../src/metrics/MetricsManager';
import {IHttpResponse} from '../../../../../src/types';
import {AQM_REQS_FILE} from '../../../../../src/constants';
import {WebSocketManager} from '../../../../../src/services/core/websocket/WebSocketManager';
import type {AqmRequestContext} from '../../../../../src/services/core/types';

jest.mock('../../../../../src/services/core/WebexRequest');
jest.mock('../../../../../src/metrics/MetricsManager');
jest.mock('../../../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    trace: jest.fn(),
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

const mockWebexRequest = WebexRequest as jest.MockedClass<typeof WebexRequest>;
const mockWebSocketManager = WebSocketManager as jest.MockedClass<typeof WebSocketManager>;

describe('AqmReqs', () => {
  let webexRequestInstance: jest.Mocked<WebexRequest>;
  let webSocketManagerInstance: jest.Mocked<WebSocketManager>;
  const mockWebexRequestResolvedValue: IHttpResponse = {
    status: 202,
    data: { webSocketUrl: 'fake-url' },
    statusText: 'OK',
    headers: {},
    config: {},
  };
  let aqm: AqmReqs;

  beforeEach(() => {
    jest.clearAllMocks();
    webexRequestInstance = new WebexRequest() as jest.Mocked<WebexRequest>;
    mockWebexRequest.getInstance = jest.fn().mockReturnValue(webexRequestInstance);

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
    webexRequestInstance.request.mockResolvedValueOnce(mockWebexRequestResolvedValue);

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
      webexRequestInstance.request.mockResolvedValueOnce(mockWebexRequestResolvedValue);
    
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
      webexRequestInstance.request.mockResolvedValueOnce(mockWebexRequestResolvedValue);
    
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
      webexRequestInstance.request.mockRejectedValueOnce(new Error('Async error'));

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
      webexRequestInstance.request.mockResolvedValueOnce(mockWebexRequestResolvedValue);
    
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
    const participantDropConfig = (participantId: string, timeout?: number | 'disabled') => ({
      host: 'fake-host',
      url: `/v1/tasks/interaction/conference/participants/${participantId}/drop`,
      data: {},
      timeout,
      err: (error: any) => error,
      notifSuccess: {
        bind: {
          type: 'RoutingMessage',
          data: {type: 'ParticipantLeftConference', interactionId: 'interaction'},
        },
      },
      notifFail: {
        bind: {
          type: 'RoutingMessage',
          data: {type: 'ParticipantDropConferenceFailed'},
        },
        errId: 'Service.aqm.task.dropConferenceParticipant' as const,
      },
    });

    it('should handle onMessage events', async () => {
      webexRequestInstance.request.mockResolvedValueOnce(mockWebexRequestResolvedValue);
    
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
        
      // Unhandled event
      webSocketManagerInstance.emit(
        'message',
        JSON.stringify({
          type: 'UnhandledMessage',
          data: { type: 'UnhandledEvent' },
        })
      );
    
      expect(LoggerProxy.info).toHaveBeenCalledWith(
        'Routing notification has no pending handler', {"method": "createPromise", "module": AQM_REQS_FILE}
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
      webexRequestInstance.request.mockResolvedValueOnce(mockWebexRequestResolvedValue);

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
      webexRequestInstance.request.mockResolvedValueOnce(mockWebexRequestResolvedValue);
    
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
      webexRequestInstance.request.mockResolvedValueOnce(mockWebexRequestResolvedValue);
    
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

    it('redacts sensitive routing failure payloads from logs', async () => {
      const participantId = '+1/failure-secret';
      webexRequestInstance.request.mockResolvedValueOnce(mockWebexRequestResolvedValue);
      const promise = aqm['createPromise'](participantDropConfig(participantId, 'disabled'));

      webSocketManagerInstance.emit(
        'message',
        JSON.stringify({
          type: 'RoutingMessage',
          data: {type: 'ParticipantDropConferenceFailed', participantId},
        })
      );

      await expect(promise).rejects.toBeDefined();
      expect(LoggerProxy.log).toHaveBeenCalledTimes(1);
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        'Routing notification failed',
        expect.objectContaining({module: AQM_REQS_FILE})
      );
      const logs = JSON.stringify((LoggerProxy.log as jest.Mock).mock.calls);
      expect(logs).not.toContain(participantId);
      expect(logs).not.toContain('ParticipantDropConferenceFailed');
      expect(aqm['pendingRequests']).toEqual({});
    });

    it('resolves a correlated participant-left event and clears its binds', async () => {
      jest.useFakeTimers();
      (global.window as any).setTimeout = global.setTimeout;

      try {
        const participantId = '+1/success-secret';
        webexRequestInstance.request.mockResolvedValueOnce(mockWebexRequestResolvedValue);
        const promise = aqm['createPromise'](participantDropConfig(participantId));
        const eventData = {
          type: 'RoutingMessage',
          data: {type: 'ParticipantLeftConference', interactionId: 'interaction'},
        };

        webSocketManagerInstance.emit('message', JSON.stringify(eventData));

        await expect(promise).resolves.toEqual(eventData);
        expect(aqm['pendingRequests']).toEqual({});
      } finally {
        jest.useRealTimers();
        (global.window as any).setTimeout = global.setTimeout;
      }
    });

    it('clears participant Drop binds after an HTTP failure without logging sensitive data', async () => {
      jest.useFakeTimers();
      (global.window as any).setTimeout = global.setTimeout;

      try {
        const participantId = '+1/http-secret';
        const httpFailure = {headers: {Authorization: 'Bearer secret'}};
        webexRequestInstance.request.mockRejectedValueOnce(httpFailure);
        const promise = aqm['createPromise'](participantDropConfig(participantId));

        await expect(promise).rejects.toBe(httpFailure);
        expect(aqm['pendingRequests']).toEqual({});
        expect(JSON.stringify([
          (LoggerProxy.log as jest.Mock).mock.calls,
          (LoggerProxy.error as jest.Mock).mock.calls,
        ])).not.toContain(participantId);
        expect(httpFailure.headers.Authorization).toBe('Bearer secret');
      } finally {
        jest.useRealTimers();
        (global.window as any).setTimeout = global.setTimeout;
      }
    });

    it('uses the default timeout without logging a sensitive request URL', async () => {
      jest.useFakeTimers();
      (global.window as any).setTimeout = global.setTimeout;

      try {
        const participantId = '+1/timeout-secret';
        webexRequestInstance.request.mockResolvedValueOnce(mockWebexRequestResolvedValue);
        const promise = aqm['createPromise'](participantDropConfig(participantId));
        const rejection = expect(promise).rejects.toBeDefined();

        jest.advanceTimersByTime(20000);

        await rejection;
        expect(JSON.stringify((LoggerProxy.error as jest.Mock).mock.calls)).not.toContain(participantId);
        expect(aqm['pendingRequests']).toEqual({});
      } finally {
        jest.useRealTimers();
        (global.window as any).setTimeout = global.setTimeout;
      }
    });
  });

  describe('typeMapCheck', () => {
    const typeMapCheck = (AqmReqs as any).typeMapCheck.bind(AqmReqs);

    it('rejects inherited prototype key', () => {
      const typeMap = {typeField: 'type', conditions: {}};
      const msg = {type: 'constructor'};

      expect(typeMapCheck(typeMap, msg)).toBe(false);
    });

    it('still matches valid own-key condition', () => {
      const typeMap = {typeField: 'type', conditions: {EventA: {field: 'value'}}};
      const msg = {type: 'EventA', field: 'value'};

      expect(typeMapCheck(typeMap, msg)).toBe(true);
    });
  });
});

describe('T-007/T-008 real AQM operation and session owners', () => {
  const {EventEmitter} = require('events');
  const routingAgent = jest.requireActual('../../../../../src/services/agent').default;
  const {createRegionRecoveryError} = jest.requireActual('../../../../../src/services/core/Utils');
  let aqm: AqmReqs, socket: any, http: jest.Mock, agent: ReturnType<typeof routingAgent>;
  let uploadLogs: jest.Mock;
  let metrics: Record<string, jest.Mock>;
  const loggerSinks = [LoggerProxy.log, LoggerProxy.error, LoggerProxy.info, LoggerProxy.warn, LoggerProxy.trace] as jest.Mock[];
  // Include non-enumerable Error fields and retain object identities: JSON alone
  // would miss Error.message, and a raw object must never reach a diagnostic sink.
  const collectDiagnostic = (value: unknown, objects: Set<object>, seen = new Set<object>()): string => {
    if (value === null || typeof value !== 'object') return String(value);
    objects.add(value);
    if (seen.has(value)) return '[cycle]';
    seen.add(value);
    const keys = new Set<PropertyKey>(Reflect.ownKeys(value));
    if (value instanceof Error) ['name', 'message', 'stack', 'cause'].forEach((key) => keys.add(key));
    return [...keys].map((key) => `${String(key)}:${collectDiagnostic(Reflect.get(value, key), objects, seen)}`).join('\n');
  };
  const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };
  const command = (extra: Record<string, any> = {}) => ({url: '/command', notifSuccess: {bind: {type: 'DONE'}, msg: {}}, ...extra});
  const invoke = (operation: string, {data, context, callback}: {
    data: Record<string, unknown>;
    context?: AqmRequestContext;
    callback?: jest.Mock;
  }) => operation === 'stateChange'
    ? agent.stateChange({data}, callback, context)
    : operation === 'reload' ? agent.reload(callback, context) : agent.stationLogin({data}, callback, context);
  const requestUuid = (call = 0): string => {
    const header = http.mock.calls[call][0].headers.trackingid;
    expect(header).toMatch(/^webex-js-sdk_[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);

    return header.split('_')[1];
  };
  const frame = (operation: string, success: boolean, trackingId?: string, outer = 'routing_5d159995-5e3d-478c-94c7-d0a3fbcb5f6b') => ({
    type: operation === 'stateChange' ? 'AgentStateChange' : operation === 'reload' ? (success ? 'AgentReloginSuccess' : 'AgentReloginFailed') : 'StationLogin',
    trackingId: outer,
    data: {type: operation === 'stateChange' ? (success ? 'AgentStateChangeSuccess' : 'AgentStateChangeFailed') : operation === 'reload' ? (success ? 'AgentReloginSuccess' : 'AgentReloginFailed') : (success ? 'AgentStationLoginSuccess' : 'AgentStationLoginFailed'),
      ...(trackingId ? {trackingId} : {}), reason: 'BACKEND_FAILURE', reasonCode: 1037},
  });
  const send = (message: unknown) => socket.emit('message', JSON.stringify(message));
  beforeEach(() => {
    jest.clearAllMocks(); jest.useFakeTimers();
    loggerSinks.forEach((sink) => sink.mockReset().mockImplementation(() => undefined));
    metrics = {
      trackEvent: jest.fn(),
      trackBehavioralEvent: jest.fn(),
      trackOperationalEvent: jest.fn(),
      trackBusinessEvent: jest.fn(),
      timeEvent: jest.fn(),
      cancelTimedEvent: jest.fn(),
    };
    (MetricsManager.getInstance as jest.Mock).mockReset().mockReturnValue(metrics);
    socket = new EventEmitter(); socket.hasUsableSocket = () => true;
    http = jest.fn().mockResolvedValue({statusCode: 202, headers: {}});
    uploadLogs = jest.fn();
    mockWebexRequest.getInstance = jest.fn().mockReturnValue({request: http, uploadLogs});
    aqm = new AqmReqs(socket); agent = routingAgent(aqm);
  });
  afterEach(() => {
    aqm.interruptPending(() => createRegionRecoveryError('RECOVERY_INTERRUPTED'));
    jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
  });

  it.each(['reload', 'stationLogin'].flatMap((operation) =>
    ['success', 'failure', 'timeout', 'interrupt', 'abort'].map((settlement) => ({operation, settlement}))
  ))('sessionAttemptIdsAreUnique / sessionTrackingProvenanceSurvivesSettlement $operation settlement=$settlement', async ({operation, settlement}) => {
    const ids: string[] = [];
    const localAtDispatch: boolean[] = [];
    http.mockImplementation((options) => {
      localAtDispatch.push(aqm.isLocalSessionTrackingId(options.headers.trackingid.split('_')[1]));
      return Promise.resolve({statusCode: 202, headers: {}});
    });
    const data = operation === 'reload' ? {} : {teamId: 'team', dialNumber: 'number', roles: ['agent']};
    for (let generation = 0; generation < 2; generation += 1) {
      const controller = new AbortController();
      const removeAbortListener = jest.spyOn(controller.signal, 'removeEventListener');
      const promise = invoke(operation, {data, context: {generation, signal: controller.signal}});
      expect(http).toHaveBeenCalledTimes(generation + 1);
      expect(localAtDispatch).toEqual(Array(generation + 1).fill(true));
      const request = http.mock.calls[generation][0];
      expect(request.body).toEqual(data);
      const id = requestUuid(generation); ids.push(id);
      expect(aqm.isLocalSessionTrackingId(id)).toBe(true);
      expect(aqm['operations'].size).toBe(1);
      expect(jest.getTimerCount()).toBe(1);
      const notification = frame(operation, settlement === 'success', id);
      const settled = settlement === 'success' ? expect(promise).resolves.toEqual(notification)
        : settlement === 'failure' ? expect(promise).rejects.toMatchObject({details: notification})
        : settlement === 'timeout' ? expect(promise).rejects.toMatchObject({id: 'Service.aqm.reqs.Timeout'})
        : expect(promise).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      if (settlement === 'success' || settlement === 'failure') send(notification);
      if (settlement === 'timeout') jest.advanceTimersByTime(20000);
      if (settlement === 'interrupt') aqm.interruptPending(() => createRegionRecoveryError('RECOVERY_INTERRUPTED'));
      if (settlement === 'abort') controller.abort();
      await settled;
      expect(aqm['operations'].size).toBe(0);
      expect(aqm['pendingRequests']).toEqual({});
      expect(aqm['pendingNotifCancelrequest']).toEqual({});
      expect(jest.getTimerCount()).toBe(0);
      expect(removeAbortListener).toHaveBeenCalledTimes(1);
      expect(removeAbortListener).toHaveBeenCalledWith('abort', expect.any(Function));
      ids.forEach((trackingId) => expect(aqm.isLocalSessionTrackingId(trackingId)).toBe(true));
      aqm.beginGeneration(generation + 1);
      ids.forEach((trackingId) => expect(aqm.isLocalSessionTrackingId(trackingId)).toBe(true));
    }
    expect(new Set(ids).size).toBe(2);
    expect(aqm.isLocalSessionTrackingId('not-local')).toBe(false);
  });

  it.each(['reload', 'stationLogin', 'stateChange'].flatMap((operation) =>
    [true, false].map((success) => ({operation, success}))
  ))(
    'strict $operation matches the nested UUID only, success=$success', async ({operation, success}) => {
      const uuid = '8f5ec5e4-80b8-4f5d-9720-10bfe56e7ca1';
      const signal = new AbortController().signal;
      const context: AqmRequestContext = operation === 'stateChange'
        ? {generation: 0, signal, correlationId: uuid, requireCorrelation: true}
        : {generation: 0, signal};
      if (operation === 'stationLogin')
        aqm.setRecoveryGate({state: 'manualLoginRequired', sessionSignal: signal});
      else if (operation === 'reload')
        aqm.setRecoveryGate({state: 'recovering', sessionSignal: signal});
      const data = operation === 'stateChange' ? {state: 'Available', auxCodeId: '0'}
        : operation === 'reload' ? {} : {teamId: 'team', dialNumber: 'number', roles: ['agent']};
      const promise = invoke(operation, {data, context});
      const settled = jest.fn();
      const observed = promise.then(settled, settled);
      expect(http).toHaveBeenCalledTimes(1);
      expect(http.mock.calls[0][0].body).toEqual(data);
      const id = requestUuid();
      if (operation === 'stateChange') expect(id).toBe(uuid);
      send(frame(operation, success, undefined, id));
      send(frame(operation, success, '5d159995-5e3d-478c-94c7-d0a3fbcb5f6b', id));
      send(frame(operation, success, http.mock.calls[0][0].headers.trackingid));
      await flush(); expect(settled).not.toHaveBeenCalled();
      const matching = frame(operation, success, id);
      send(matching); await observed;
      expect(settled).toHaveBeenCalledTimes(1);
      if (success) expect(settled.mock.calls[0][0]).toEqual(matching);
      else expect(settled.mock.calls[0][0].details).toEqual(matching);
      expect(aqm['operations'].size).toBe(0); expect(jest.getTimerCount()).toBe(0);
    }
  );

  it.each(['reload', 'stationLogin', 'stateChange'].flatMap((operation) => [true, false].map((success) => ({operation, success}))))(
    'ordinary $operation preserves subtype matching despite missing or server-assigned UUID, success=$success', async ({operation, success}) => {
      const serverId = 'e5e67e95-627a-4db1-aed8-bd2ee3e44df7';
      const data = operation === 'stateChange' ? {state: 'Available', auxCodeId: '0'} : {};
      const promise = invoke(operation, {data});
      if (operation === 'stateChange') expect(http.mock.calls[0][0].headers).toBeUndefined();
      const matched = frame(operation, success, success && operation === 'stateChange' ? undefined : serverId);
      const localAtFanout = jest.fn(() => aqm.isLocalSessionTrackingId(serverId));
      socket.on('message', localAtFanout);
      const observed = success ? expect(promise).resolves.toEqual(matched)
        : expect(promise).rejects.toMatchObject({details: matched});
      send(matched);
      await observed;
      if (success && operation !== 'stateChange') expect(localAtFanout.mock.results[0].value).toBe(true);
    }
  );

  it.each(['reload', 'stationLogin', 'stateChange'])(
    'ordinary %s ignores a retired recovery UUID and still accepts an unknown backend UUID', async (operation) => {
      const data = operation === 'stateChange' ? {state: 'Available', auxCodeId: '0'} : {};
      const controller = new AbortController();
      const first = invoke(operation, {data, context: {
        generation: 0,
        signal: controller.signal,
        correlationId: '8f5ec5e4-80b8-4f5d-9720-10bfe56e7ca1',
        requireCorrelation: true,
      }});
      const retiredId = requestUuid();
      const interrupted = expect(first).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
      controller.abort();
      await interrupted;

      aqm.beginGeneration(1);
      const pending = invoke(operation, {data});
      if (operation === 'stateChange') expect(http.mock.calls[1][0].headers).toBeUndefined();
      const settled = jest.fn();
      const observed = pending.then(settled, settled);
      send(frame(operation, true, retiredId));
      send(frame(operation, false, retiredId));
      await flush();
      expect(settled).not.toHaveBeenCalled();

      const matching = frame(operation, true, 'e5e67e95-627a-4db1-aed8-bd2ee3e44df7');
      send(matching);
      await observed;
      expect(settled).toHaveBeenCalledWith(matching);
    }
  );

  it.each(['success', 'abort', 'stale', 'already-aborted'])(
    'legacy stateChange forwards callback and generation/AbortSignal context: %s', async (settlement) => {
      aqm.beginGeneration(3);
      const controller = new AbortController();
      if (settlement === 'already-aborted') controller.abort();
      const context = {generation: settlement === 'stale' ? 2 : 3, signal: controller.signal};
      const callback = jest.fn();
      const response = {statusCode: 202, headers: {}};
      http.mockResolvedValue(response);
      const data = {state: 'Available', auxCodeId: '0'};
      const promise = agent.stateChange({data}, callback, context);

      if (settlement === 'stale' || settlement === 'already-aborted') {
        await expect(promise).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
        expect(http).not.toHaveBeenCalled();
        expect(callback).not.toHaveBeenCalled();
      } else {
        expect(http).toHaveBeenCalledTimes(1);
        expect(http.mock.calls[0][0].body).toBe(data);
        await flush();
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback.mock.calls[0]).toHaveLength(1);
        expect(callback.mock.calls[0][0]).toBe(response);
        if (settlement === 'abort') {
          const rejected = expect(promise).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
          controller.abort();
          await rejected;
        } else {
          const matching = frame('stateChange', true);
          send(matching);
          await expect(promise).resolves.toEqual(matching);
        }
      }
      expect(aqm['operations'].size).toBe(0);
      expect(aqm['pendingRequests']).toEqual({});
      expect(aqm['pendingNotifCancelrequest']).toEqual({});
      expect(jest.getTimerCount()).toBe(0);
    }
  );

  it.each(['reload', 'stationLogin', 'stateChange'].flatMap((operation) => [true, false].flatMap((success) => ['resolve', 'reject'].map((late) => [operation, late, success]))))(
    'notificationBeforeHttpUsesSameOperation %s late=%s success=%s', async (operation, late, success) => {
      let resolve!: (value: any) => void, reject!: (error: any) => void;
      http.mockReturnValue(new Promise((res, rej) => { resolve = res; reject = rej; }));
      const callback = jest.fn();
      const correlationId = '5d159995-5e3d-478c-94c7-d0a3fbcb5f6b';
      const data = {};
      const promise = invoke(operation as string, {data, callback, context: {generation: 0, correlationId, requireCorrelation: true}});
      expect(http).toHaveBeenCalledTimes(1);
      expect(http.mock.calls[0][0].body).toEqual(data);
      const id = requestUuid();
      if (operation === 'stateChange') expect(id).toBe(correlationId);
      const observed = promise.catch((error) => error);
      send(frame(operation as string, success as boolean, id)); await observed;
      if (late === 'resolve') resolve({statusCode: 202, options: {body: {dialNumber: 'secret'}}});
      else reject(new Error('late failure'));
      await flush(); expect(callback).not.toHaveBeenCalled();
      expect(aqm['operations'].size).toBe(0); expect(jest.getTimerCount()).toBe(0);
    }
  );

  it.each(['reload', 'stationLogin', 'stateChange'])('correlationDoesNotBypassDuplicateAdmission and ordinaryRequestAndTaskOwnershipUnchanged %s', async (operation) => {
    const data = operation === 'stateChange' ? {state: 'Available', auxCodeId: '0'}
      : operation === 'reload' ? {} : {teamId: 'team', dialNumber: 'number', roles: ['agent']};
    const first = invoke(operation, {data, context: {
      generation: 0,
      correlationId: '8f5ec5e4-80b8-4f5d-9720-10bfe56e7ca1',
      requireCorrelation: true,
    }});
    const settled = jest.fn();
    const observed = first.then(settled, settled);
    const bindKeys = Object.keys(aqm['pendingRequests']);
    expect(bindKeys).toHaveLength(2);
    expect(bindKeys.join('')).not.toContain(requestUuid());
    await expect(invoke(operation, {data, context: {
      generation: 0,
      correlationId: 'a0010213-add8-47f0-88ca-de81bfa7ec6f',
      requireCorrelation: true,
    }})).rejects.toMatchObject({id: 'Service.aqm.reqs.Pending', details: {key: bindKeys.join('')}});
    expect(http).toHaveBeenCalledTimes(1);
    expect(aqm['operations'].size).toBe(1);
    expect(jest.getTimerCount()).toBe(1);
    const matching = frame(operation, true, requestUuid());
    send(matching);
    await expect(first).resolves.toEqual(matching);
    await observed;
    expect(settled).toHaveBeenCalledTimes(1);
    expect(settled).toHaveBeenCalledWith(matching);
    expect(aqm['operations'].size).toBe(0);
    expect(aqm['pendingRequests']).toEqual({});
    expect(aqm['pendingNotifCancelrequest']).toEqual({});
    expect(jest.getTimerCount()).toBe(0);
    const request = aqm.req(() => command());
    const normal = request({}); send({type: 'DONE'}); await expect(normal).resolves.toEqual({type: 'DONE'});
    expect(aqm['operations'].size).toBe(0);
    expect(aqm['pendingRequests']).toEqual({});
    expect(aqm['pendingNotifCancelrequest']).toEqual({});
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([
    ...['command', 'query', 'session', 'teardown'].map(kind => ({gate: 'open', kind})),
    ...['command', 'query', 'session'].map(kind => ({gate: 'recovering', kind})),
    {gate: 'recovering', kind: 'teardown', usablePrimary: true},
    {gate: 'recovering', kind: 'teardown'},
    {gate: 'manualLoginRequired', kind: 'command'},
    {gate: 'manualLoginRequired', kind: 'session'},
    {gate: 'unavailable-interrupted', kind: 'command'},
    {gate: 'unavailable-reload', kind: 'session'},
    {gate: 'unavailable-reload', kind: 'query'},
    {gate: 'unavailable-reload', kind: 'teardown'},
    {gate: 'unavailable-reload', kind: 'teardown', usablePrimary: true},
    {gate: 'open', kind: 'query', contextState: 'stale'},
    {gate: 'recovering', kind: 'query', contextState: 'aborted'},
    {gate: 'unavailable-reload', kind: 'command', contextState: 'stale'},
    {gate: 'unavailable-reload', kind: 'teardown', usablePrimary: true, contextState: 'aborted'},
  ].map(row => ({usablePrimary: false, contextState: 'current', ...row})))(
    'recovery admission gate=$gate kind=$kind primary=$usablePrimary context=$contextState',
    async ({gate, kind, usablePrimary, contextState}) => {
      aqm.beginGeneration(1);
      socket.hasUsableSocket = jest.fn(() => usablePrimary);
      const reason = gate === 'unavailable-reload' ? 'REGION_RELOAD_REQUIRED' : 'RECOVERY_INTERRUPTED';
      aqm.setRecoveryGate(gate.startsWith('unavailable') ? {state: 'unavailable', reason} : {state: gate} as any);
      const controller = new AbortController();
      if (contextState === 'aborted') controller.abort();
      const registerOperation = jest.spyOn(aqm['operations'], 'set');
      const scheduleTimeout = jest.spyOn(global, 'setTimeout');
      const request = aqm.req(() => command({kind}));
      const promise = request({}, undefined, {
        generation: contextState === 'stale' ? 0 : 1,
        signal: controller.signal,
      });
      const observed = promise.catch((error) => error);
      const allowed = contextState === 'current' &&
        (gate === 'open' || kind === 'query' || (kind === 'teardown' && usablePrimary));
      expect(http).toHaveBeenCalledTimes(allowed ? 1 : 0);
      expect(registerOperation).toHaveBeenCalledTimes(allowed ? 1 : 0);
      expect(scheduleTimeout).toHaveBeenCalledTimes(allowed ? 1 : 0);
      expect(aqm['operations'].size).toBe(allowed ? 1 : 0);
      expect(jest.getTimerCount()).toBe(allowed ? 1 : 0);
      expect(socket.hasUsableSocket).toHaveBeenCalledTimes(
        contextState === 'current' && gate !== 'open' && kind === 'teardown' ? 1 : 0
      );
      if (allowed) {
        const notification = kind === 'session'
          ? {type: 'DONE', data: {trackingId: requestUuid()}}
          : {type: 'DONE'};
        send(notification);
        await expect(observed).resolves.toEqual(notification);
      } else {
        const expectedReason = contextState !== 'current' || (kind === 'teardown' && !usablePrimary)
          ? 'RECOVERY_INTERRUPTED'
          : gate.startsWith('unavailable') ? reason : 'RECOVERY_IN_PROGRESS';
        const error = await observed;
        expect(error.data).toEqual({reason: expectedReason});
      }
      expect(aqm['operations'].size).toBe(0);
      expect(aqm['pendingRequests']).toEqual({});
      expect(aqm['pendingNotifCancelrequest']).toEqual({});
      expect(jest.getTimerCount()).toBe(0);
    }
  );

  it.each((['recovering', 'manualLoginRequired'] as const).flatMap(gate =>
    ['valid', 'missing', 'different-signal', 'aborted', 'stale-context'].map(variant => [gate, variant] as const)
  ))('recovery session uses the current signal in %s with %s context', async (gate, variant) => {
      aqm.beginGeneration(7);
      const controller = new AbortController();
      aqm.setRecoveryGate({state: gate, sessionSignal: controller.signal});
      if (variant === 'aborted') controller.abort();
      const context = {
        generation: variant === 'stale-context' ? 6 : 7,
        signal: variant === 'different-signal' ? new AbortController().signal
          : variant === 'missing' ? undefined : controller.signal,
      };
      const promise = agent.reload(undefined, context); const observed = promise.catch((error) => error);
      expect(http).toHaveBeenCalledTimes(variant === 'valid' ? 1 : 0);
      if (variant === 'valid') aqm.interruptPending(() => createRegionRecoveryError('RECOVERY_INTERRUPTED'));
      const error = await observed;
      expect(error.data.reason).toBe(['valid', 'stale-context', 'aborted'].includes(variant) ? 'RECOVERY_INTERRUPTED' : 'RECOVERY_IN_PROGRESS');
    }
  );

  it('does not infer the restore signal and rejects recovering teardown without usable primary', async () => {
    aqm.setRecoveryGate({state: 'recovering', sessionSignal: new AbortController().signal});
    await expect(agent.reload()).rejects.toMatchObject({data: {reason: 'RECOVERY_IN_PROGRESS'}});
    socket.hasUsableSocket = () => false;
    await expect(agent.logout({data: {logoutReason: 'User'}})).rejects.toMatchObject({data: {reason: 'RECOVERY_INTERRUPTED'}});
    expect(http).not.toHaveBeenCalled();
  });

  it.each(['interrupt', 'abort'])('timeoutDisabledAliasDisplacementInterrupted / timeoutDisabledDisplacedAbortKeepsReplacement %s', async (cancel) => {
    const request = aqm.req(() => command({timeout: 'disabled'}));
    const controller = new AbortController();
    const first = request({}, undefined, {generation: 0, signal: controller.signal}); const rejected = first.catch((error) => error);
    const second = request({}); const observed = second.catch((error) => error);
    expect(aqm['operations'].size).toBe(2);
    if (cancel === 'interrupt') aqm.interruptPending(() => createRegionRecoveryError('RECOVERY_INTERRUPTED'));
    else controller.abort();
    expect((await rejected).data.reason).toBe('RECOVERY_INTERRUPTED');
    if (cancel === 'abort') { expect(aqm['operations'].size).toBe(1); send({type: 'DONE'}); expect(await observed).toEqual({type: 'DONE'}); }
    else expect((await observed).data.reason).toBe('RECOVERY_INTERRUPTED');
    expect(aqm['pendingRequests']).toEqual({}); expect(aqm['operations'].size).toBe(0);
  });

  it('entryInterruptBefore100sWait / interruptionErrorsAreIndependent / noSecond20sTimeoutSettlement', async () => {
    const request = aqm.req((p: any) => command({notifSuccess: {bind: {type: p.type}, msg: {}}}));
    const pending = ['ONE', 'TWO', 'THREE'].map((type) => request({type}).catch((error) => error));
    const factory = jest.fn(() => createRegionRecoveryError('RECOVERY_INTERRUPTED'));
    aqm.interruptPending(factory); const errors = await Promise.all(pending);
    expect(factory).toHaveBeenCalledTimes(3);
    expect(new Set(errors).size).toBe(3); expect(new Set(errors.map((error) => error.data)).size).toBe(3);
    errors[0].loginOption = 'BROWSER'; errors[0].data.reason = 'changed'; errors[0].details = {changed: true};
    expect(errors[1].data).toEqual({reason: 'RECOVERY_INTERRUPTED'});
    expect(errors[1].details).toBeUndefined();
    jest.advanceTimersByTime(100000); expect(aqm['operations'].size).toBe(0); expect(jest.getTimerCount()).toBe(0);
    expect(http).toHaveBeenCalledTimes(3);
  });

  it('interruptionErrorsAreIndependent when the first factory call throws', async () => {
    const {getEventListeners} = require('events');
    const unhandledRejection = jest.fn();
    process.on('unhandledRejection', unhandledRejection);
    try {
      const operations = ['ONE', 'TWO'].map((type) => {
        let resolveHttp!: (value: unknown) => void, rejectHttp!: (error: Error) => void;
        http.mockReturnValueOnce(new Promise((resolve, reject) => {
          resolveHttp = resolve; rejectHttp = reject;
        }));
        const controller = new AbortController();
        const removeAbortListener = jest.spyOn(controller.signal, 'removeEventListener');
        const notifications = {
          success: {type: `${type}_SUCCESS`},
          failure: {type: `${type}_FAILURE`},
          cancel: {type: `${type}_CANCEL`},
        };
        const request = aqm.req(() => command({
          timeout: 20000,
          notifSuccess: {bind: notifications.success, msg: {}},
          notifFail: {bind: notifications.failure, errId: 'Service.aqm.contact.consult'},
          notifCancel: {bind: notifications.cancel, msg: {}},
        }));
        const acknowledged = jest.fn(), resolved = jest.fn(), rejected = jest.fn((error) => error);
        const observed = request({}, acknowledged, {generation: 0, signal: controller.signal})
          .then(resolved, rejected);
        const [abortListener] = getEventListeners(controller.signal, 'abort');
        expect(getEventListeners(controller.signal, 'abort')).toEqual([abortListener]);
        expect(abortListener).toEqual(expect.any(Function));

        return {controller, removeAbortListener, abortListener, notifications, acknowledged,
          resolved, rejected, observed, resolveHttp, rejectHttp};
      });
      const operationIds = [...aqm['operations'].keys()];
      expect(operationIds).toHaveLength(2);
      expect(Object.keys(aqm['pendingRequests'])).toHaveLength(4);
      expect(Object.keys(aqm['pendingNotifCancelrequest'])).toHaveLength(2);
      expect(jest.getTimerCount()).toBe(2);
      operationIds.forEach((operationId) => {
        expect(Object.values(aqm['pendingRequests'])
          .filter((entry) => entry.operationId === operationId)).toHaveLength(2);
        expect(Object.values(aqm['pendingNotifCancelrequest'])
          .filter((entry) => entry.operationId === operationId)).toHaveLength(1);
      });
      await flush();
      operations.forEach(({resolved, rejected}) => {
        expect(resolved).not.toHaveBeenCalled(); expect(rejected).not.toHaveBeenCalled();
      });

      const thrownError = createRegionRecoveryError('STALE_TASK');
      const factoryError = createRegionRecoveryError('REGION_RELOAD_REQUIRED');
      const factory = jest.fn()
        .mockImplementationOnce(() => { throw thrownError; })
        .mockReturnValue(factoryError);
      expect(() => aqm.interruptPending(factory)).not.toThrow();
      const errors = await Promise.all(operations.map(({observed}) => observed));
      expect(Object.getPrototypeOf(errors[0])).toBe(Error.prototype);
      expect(errors[0].message).toBe('RECOVERY_INTERRUPTED');
      expect(errors[0].data).toEqual({reason: 'RECOVERY_INTERRUPTED'});
      expect(errors[0]).not.toBe(thrownError); expect(errors[0]).not.toBe(factoryError);
      expect(errors[0].data).not.toBe(thrownError.data);
      expect(errors[0].data).not.toBe(factoryError.data);
      expect(errors[1]).toBe(factoryError);
      const assertSettledAndCleaned = () => {
        expect(factory).toHaveBeenCalledTimes(2);
        expect(aqm['operations'].size).toBe(0);
        expect(aqm['pendingRequests']).toEqual({});
        expect(aqm['pendingNotifCancelrequest']).toEqual({});
        expect(jest.getTimerCount()).toBe(0);
        operations.forEach((operation, index) => {
          expect(operation.resolved).not.toHaveBeenCalled();
          expect(operation.rejected).toHaveBeenCalledTimes(1);
          expect(operation.rejected).toHaveBeenCalledWith(errors[index]);
          expect(operation.acknowledged).not.toHaveBeenCalled();
          expect(operation.removeAbortListener).toHaveBeenCalledTimes(1);
          expect(operation.removeAbortListener).toHaveBeenCalledWith('abort', operation.abortListener);
          expect(getEventListeners(operation.controller.signal, 'abort')).toEqual([]);
        });
        expect(http).toHaveBeenCalledTimes(2);
      };
      assertSettledAndCleaned();

      const deliverLateOutcomes = () => {
        aqm.interruptPending(factory);
        operations.forEach(({controller, notifications}) => {
          controller.abort();
          Object.values(notifications).forEach(send);
        });
        jest.advanceTimersByTime(100000);
      };
      deliverLateOutcomes();
      operations[0].resolveHttp({statusCode: 202, headers: {}});
      operations[1].rejectHttp(new Error('late HTTP failure'));
      await flush();
      // Let Node report any unobserved rejection while AQM timeouts remain fake.
      await new Promise<void>((resolve) => jest.requireActual('timers').setImmediate(resolve));
      deliverLateOutcomes(); await flush();
      assertSettledAndCleaned();
      expect(unhandledRejection).not.toHaveBeenCalled();
    } finally {
      process.removeListener('unhandledRejection', unhandledRejection);
    }
  });

  it('aliasCleanupCannotDeleteReplacement when an old alternate cancel completes first', async () => {
    const request = aqm.req((input: any) => command({timeout: 'disabled', notifCancel: {bind: {type: input.cancel}, msg: {}}}));
    const first = request({cancel: 'CANCEL_OLD'}), second = request({cancel: 'CANCEL_NEW'});
    send({type: 'CANCEL_OLD'});
    await expect(first).resolves.toEqual({type: 'CANCEL_OLD'});
    expect(aqm['operations'].size).toBe(1);
    send({type: 'DONE'}); await expect(second).resolves.toEqual({type: 'DONE'});
    expect(aqm['operations'].size).toBe(0); expect(aqm['pendingNotifCancelrequest']).toEqual({});
  });

  it('stale HTTP failure cannot remove a timeout-disabled replacement alias', async () => {
    let rejectOld!: (error: unknown) => void;
    http.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectOld = reject; }));
    const request = aqm.req(() => command({timeout: 'disabled'}));
    const first = request({}).catch((error) => error), second = request({});
    rejectOld(new Error('old HTTP failure')); await first;
    expect(aqm['operations'].size).toBe(1);
    send({type: 'DONE'}); await expect(second).resolves.toEqual({type: 'DONE'});
    expect(aqm['pendingRequests']).toEqual({});
  });

  it('preserves the station body without adding a data wrapper', async () => {
    const data = {teamId: 'team', dialNumber: 'number'};
    const promise = agent.stationLogin({data});
    expect(http.mock.calls[0][0].body).toBe(data);
    send(frame('stationLogin', true, requestUuid())); await promise;
  });

  it.each(['success', 'failure'])('aqmMessageDiagnosticsCannotBlockSettlement %s', async (outcome) => {
    (LoggerProxy.info as jest.Mock).mockImplementation(() => { throw new Error('sink'); });
    expect(() => send({type: 'Welcome', data: {}})).not.toThrow();
    const promise = agent.reload(); const observed = promise.catch((error) => error);
    const id = requestUuid();
    expect(() => send(frame('reload', outcome === 'success', id))).not.toThrow();
    await observed; expect(aqm['operations'].size).toBe(0); expect(aqm['pendingRequests']).toEqual({});
    expect(jest.getTimerCount()).toBe(0);
    (LoggerProxy.info as jest.Mock).mockReset();
  });

  it.each([
    {operation: 'stateChange', scenario: 'timeout'},
    {operation: 'stationLogin', scenario: 'timeout', diagnostics: 'throwing'},
    {operation: 'stationLogin', scenario: 'notification'},
    {operation: 'reload', scenario: 'http'},
    {operation: 'stateChange', scenario: 'http-error', diagnostics: 'throwing'},
    {operation: 'reload', scenario: 'abort'},
    {operation: 'stateChange', scenario: 'interrupt', diagnostics: 'throwing'},
    {operation: 'stationLogin', scenario: 'late-resolve'},
    {operation: 'reload', scenario: 'late-reject'},
  ].map(row => ({diagnostics: 'normal', ...row})))(
    'T-013 redacts AQM diagnostics for $operation $scenario with $diagnostics sinks', async ({operation, scenario, diagnostics}) => {
      const diagnosticObjects = new Set<object>();
      const diagnosticValues: string[] = [];
      const sinks = [...loggerSinks, ...Object.values(metrics), uploadLogs];
      sinks.forEach((sink) => sink.mockReset().mockImplementation((...args: unknown[]) => {
        // Snapshot at delivery so later mutation cannot hide a sensitive argument.
        diagnosticValues.push(collectDiagnostic(args, diagnosticObjects));
        if (diagnostics === 'throwing') throw new Error('diagnostic sink');
      }));
      let complete!: (value: any) => void, fail!: (error: any) => void;
      const pending = new Promise((resolve, reject) => { complete = resolve; fail = reject; });
      http.mockReturnValue(pending);
      const controller = new AbortController();
      const removeAbortListener = jest.spyOn(controller.signal, 'removeEventListener');
      const acknowledged = jest.fn();
      const requestContext = {
        generation: 0,
        signal: controller.signal,
        correlationId: '8f5ec5e4-80b8-4f5d-9720-10bfe56e7ca1',
        requireCorrelation: true,
      };
      const requestData = operation === 'stateChange' ? {state: 'Available', auxCodeId: '0'}
        : operation === 'stationLogin' ? {teamId: 'TEAM_SENTINEL', dialNumber: 'STATION_DN_SENTINEL', roles: ['agent']} : {};
      const promise = invoke(operation, {data: requestData, callback: acknowledged, context: requestContext});
      const resolved = jest.fn();
      const settled = jest.fn((error) => error);
      const observed = promise.then(resolved, settled);
      expect(aqm['operations'].size).toBe(1);
      expect(jest.getTimerCount()).toBe(1);
      const response = {
        statusCode: 202,
        id: 'acknowledgement-id',
        headers: {
          Authorization: 'BEARER_SENTINEL',
          authorization: 'LOWER_HEADER_SENTINEL',
          'Proxy-Authorization': 'PROXY_SENTINEL',
          'Set-Cookie': 'COOKIE_SENTINEL',
          TrackingID: 'acknowledgement-tracking-id',
        },
        body: {
          reasonCode: 1037,
          reason: 'https://example.invalid/REASON_URL_SENTINEL?signature=SIGNED_SENTINEL',
          credentials: {token: 'NESTED_TOKEN_SENTINEL'},
        },
        request: {headers: {AUTHORIZATION: 'REQUEST_SENTINEL'}, options: {password: 'PASSWORD_SENTINEL'}},
        options: {headers: {Authorization: 'UPPER_SENTINEL', authorization: 'LOWER_SENTINEL'}, body: {dialNumber: 'DN_SENTINEL'}, url: 'https://example.invalid/URL_SENTINEL?signature=SIGNED_SENTINEL'},
        url: 'https://example.invalid/TOP_URL_SENTINEL?signature=SIGNED_SENTINEL',
      };
      const originalResponse = JSON.parse(JSON.stringify(response));
      const httpFailure = Object.assign(new Error('ERROR_MESSAGE_SENTINEL'), response);
      Object.defineProperty(httpFailure, 'cause', {value: new Error('ERROR_CAUSE_SENTINEL')});
      const id = requestUuid();
      const failureFrame = frame(operation, false, id);
      const notification = {
        ...failureFrame,
        data: {...failureFrame.data, reason: 'NOTIFICATION_REASON_SENTINEL', credentials: response.body.credentials},
      };
      const rawObjects = new Set<object>();
      [requestData, http.mock.calls[0][0], response, httpFailure, notification].forEach((value) => collectDiagnostic(value, rawObjects));
      if (scenario === 'timeout') { complete(response); await flush(); jest.advanceTimersByTime(20000); }
      if (scenario === 'notification') { complete(response); await flush(); send(notification); }
      if (scenario === 'http') fail(response);
      if (scenario === 'http-error') fail(httpFailure);
      if (scenario === 'abort') controller.abort();
      if (['interrupt', 'late-resolve', 'late-reject'].includes(scenario)) aqm.interruptPending(() => createRegionRecoveryError('RECOVERY_INTERRUPTED'));
      const error = await observed;
      const messages = {
        timeout: 'Routing request timeout',
        notification: 'Routing notification failed',
        http: 'Routing HTTP request failed',
        'http-error': 'Routing HTTP request failed',
        abort: 'Routing operation aborted',
        interrupt: 'Routing operations interrupted',
        'late-resolve': 'Routing operations interrupted',
        'late-reject': 'Routing operations interrupted',
      };
      const level = scenario === 'timeout' ? 'error' : scenario === 'notification' ? 'log' : 'info';
      const data = scenario === 'notification' ? {reasonCode: 1037} :
        ['timeout', 'http', 'http-error'].includes(scenario) ?
          {status: 202, reasonCode: 1037, id: 'acknowledgement-id'} : undefined;
      const context = {
        module: AQM_REQS_FILE,
        method: 'createPromise',
        ...(['timeout', 'http', 'http-error'].includes(scenario) ? {trackingId: 'acknowledgement-tracking-id'} : {}),
        ...(scenario === 'notification' ? {trackingId: id} : {}),
        ...(data ? {data} : {}),
      };
      expect((LoggerProxy[level] as jest.Mock).mock.calls.filter(([message]) => message === messages[scenario]))
        .toEqual([[messages[scenario], context]]);
      ['info', 'log', 'error'].filter(other => other !== level).forEach(other =>
        expect(LoggerProxy[other]).not.toHaveBeenCalledWith(messages[scenario], expect.anything()));
      const assertSettledAndCleaned = () => {
        expect(resolved).not.toHaveBeenCalled();
        expect(settled).toHaveBeenCalledTimes(1);
        expect(settled).toHaveBeenCalledWith(error);
        expect(removeAbortListener).toHaveBeenCalledTimes(1);
        expect(aqm['operations'].size).toBe(0);
        expect(aqm['pendingRequests']).toEqual({});
        expect(aqm['pendingNotifCancelrequest']).toEqual({});
        expect(jest.getTimerCount()).toBe(0);
      };
      assertSettledAndCleaned();
      if (scenario === 'timeout') {
        expect(error.id).toBe('Service.aqm.reqs.Timeout');
        expect(error.details).toEqual({key: expect.stringContaining(id), response: {
          statusCode: 202,
          reasonCode: 1037,
          trackingId: 'acknowledgement-tracking-id',
          id: 'acknowledgement-id',
        }});
        expect(error.details.response).not.toBe(response);
        expect(JSON.stringify(error)).not.toMatch(/_SENTINEL|authorization|dialNumber|options/i);
        expect(acknowledged).toHaveBeenCalledTimes(1);
        expect(acknowledged).toHaveBeenCalledWith(response);
        expect(acknowledged.mock.calls[0][0]).toBe(response);
      }
      // Exercise competing completions before and after the deferred HTTP result.
      const duplicateCompletions = () => {
        controller.abort(); controller.abort();
        aqm.interruptPending(() => createRegionRecoveryError('RECOVERY_INTERRUPTED'));
        aqm.interruptPending(() => createRegionRecoveryError('RECOVERY_INTERRUPTED'));
        send(notification); send(notification);
        send(frame(operation, true, id)); send(frame(operation, true, id));
        jest.advanceTimersByTime(100000);
      };
      expect(duplicateCompletions).not.toThrow();
      if (scenario === 'late-reject') fail(httpFailure); else complete(response);
      await flush();
      expect(duplicateCompletions).not.toThrow();
      await flush();
      expect(diagnosticValues.length).toBeGreaterThan(0);
      expect(diagnosticValues.join('\n')).not.toMatch(/_SENTINEL|authorization|dialNumber|options|credentials|password|signature=/i);
      expect(JSON.stringify(sinks.flatMap((sink) => sink.mock.calls))).not.toMatch(/_SENTINEL|authorization|dialNumber|options/i);
      rawObjects.forEach((value) => expect(diagnosticObjects.has(value)).toBe(false));
      expect(MetricsManager.getInstance).not.toHaveBeenCalled();
      [...Object.values(metrics), uploadLogs].forEach((sink) => expect(sink).not.toHaveBeenCalled());
      expect(response).toEqual(originalResponse);
      expect(acknowledged).toHaveBeenCalledTimes(['timeout', 'notification'].includes(scenario) ? 1 : 0);
      assertSettledAndCleaned();
      expect(http).toHaveBeenCalledTimes(1);
    }
  );
});
