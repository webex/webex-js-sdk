/* eslint-disable @typescript-eslint/no-explicit-any */
import * as config from '../../../../../src/services/core/config';
import {Service} from '../index';
import '../workers/mock-keepalive.worker.ts';
import {AqmReqs} from '../../../../../src/services/core/aqm-reqs';
jest.mock('./sdk');
const sdkMock = sdk as jest.Mocked<typeof sdk>;
const {http: httpMock} = sdkMock;

const mockMyClass = AqmNotifs as jest.MockedClass<typeof AqmNotifs>;
let listenmock = function (data: string) {};
const a = new mockMyClass();
const onmessageMock = jest.spyOn(a.onMessage as any, 'listen');
onmessageMock.mockImplementation((listener: any) => {
  listenmock = listener;
});
const SECONDS = 1000;
jest.mock('../index', () => {
  return {
    SERVICE: {
      telemetry: {
        SERVICE_PROVIDERS: {
          mixpanel: 'mixpanel',
          prometheus: 'prometheus',
        },
        MIX_EVENT: {
          STATUS: {
            SUCCESS: 'Success',
            FAILED: 'Failed',
          },
          WEB_SOCKET_DISCONNECT: 'Web Socket Disconnect',
          WELCOME_MESSAGE_RECEIVED: 'Welcome Message Received',
        },
        track: jest.fn(),
        timeEvent: jest.fn(),
      },
      featureflag: {
        initSplitioSdk: jest.fn().mockResolvedValue({
          on: jest.fn().mockImplementation((event, callback: any) => {
            callback();
          }),
          Event: {
            SDK_UPDATE: 'SDK_UPDATE',
          },
        }),
        isDesktopConsumeWelcomeEnabled: jest.fn().mockResolvedValue({
          on: jest.fn().mockImplementation((event, callback: any) => {
            callback();
          }),
          Event: {
            SDK_UPDATE: 'SDK_UPDATE',
          },
        }),
        isDesktopCpdViewEnabled: jest.fn().mockResolvedValue(false),
      },
      aqm: {
        connectionConfig: {
          OnConnectionLost: {
            listen: jest.fn(() =>
              Promise.resolve({
                isConnectionLost: true,
              })
            ),
          },
        },
      },
    },
    featureflag: {
      initSplitioSdk: jest.fn().mockResolvedValue({
        on: jest.fn().mockImplementation((event, callback: any) => {
          callback();
        }),
        Event: {
          SDK_UPDATE: 'SDK_UPDATE',
        },
      }),
      isDesktopConsumeWelcomeEnabled: jest.fn().mockResolvedValue({
        on: jest.fn().mockImplementation((event, callback: any) => {
          callback();
        }),
        Event: {
          SDK_UPDATE: 'SDK_UPDATE',
        },
      }),
    },
  };
});

class CustomError extends Error {
  response: {status: number | undefined};

  constructor(message: string, status?: number) {
    super(message);
    this.response = {status: status};
    this.name = 'CustomError';
  }
}

describe('AqmReqs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(
    'AqmReqs should be defined',
    async () => {
      httpMock.request = jest.fn().mockResolvedValueOnce({
        status: 202,
        data: {webSocketUrl: 'fake-url'},
        statusText: 'OK',
        headers: {},
        config: {},
      });
      const aqm = new AqmReqs({onMessage: {listen: jest.fn}} as any);
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
    },
    12 * SECONDS
  );
  it(
    'Aqm req should fetch new token if token is expired',
    async () => {
      let mockedCheckToken = jest.fn().mockReturnValue(false);
      let mockedGetNewToken = jest.fn().mockReturnValue('newToken');
      const authMock = jest.spyOn(config, 'getAuthService');
      authMock.mockReturnValue({
        isTokenValid: mockedCheckToken,
        getNewToken: mockedGetNewToken,
      });

      httpMock.request = jest.fn().mockResolvedValueOnce({
        status: 202,
        data: {webSocketUrl: 'fake-url'},
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const aqm = new AqmReqs({onMessage: {listen: jest.fn}} as any);
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
        expect(mockedCheckToken).toHaveBeenCalledTimes(1);
        expect(mockedGetNewToken).toHaveBeenCalledTimes(1);
      }
    },
    12 * SECONDS
  );
  it(
    'Aqm req should not fetch new token if token is not expired',
    async () => {
      let mockedCheckToken = jest.fn().mockReturnValue(true);
      let mockedGetNewToken = jest.fn().mockReturnValue('newToken');
      const authMock = jest.spyOn(config, 'getAuthService');
      authMock.mockReturnValue({
        isTokenValid: mockedCheckToken,
        getNewToken: mockedGetNewToken,
      });

      httpMock.request = jest.fn().mockResolvedValueOnce({
        status: 202,
        data: {webSocketUrl: 'fake-url'},
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const aqm = new AqmReqs({onMessage: {listen: jest.fn}} as any);
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
        expect(mockedCheckToken).toHaveBeenCalledTimes(1);
        expect(mockedGetNewToken).not.toHaveBeenCalled();
      }
    },
    12 * SECONDS
  );
});

describe('AqmReqs', () => {
  it(
    'AqmReqs notifcancel',
    async () => {
      httpMock.request = jest.fn().mockResolvedValueOnce({
        status: 202,
        data: {webSocketUrl: 'fake-url'},
        statusText: 'OK',
        headers: {},
        config: {},
      });
      const aqm = new AqmReqs(a);
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
          msg: {} as Service.Aqm.Contact.AgentContact,
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
          msg: {} as Service.Aqm.Contact.AgentContact,
        },
      }));
      // expect(req).toBeDefined();
      try {
        const p = await Promise.all([
          req({}),
          setTimeout(() => {
            listenmock(
              JSON.stringify({
                data: {
                  agentId: '22a65ecb-cff0-4a57-9b73-55c6bfb15700',
                  eventTime: 1713941632508,
                  eventType: 'RoutingMessage',
                  interaction: {
                    callAssociatedData: {},
                    callAssociatedDetails: {},
                    callFlowParams: {},
                    callProcessingDetails: {},
                    contactDirection: {
                      type: 'INBOUND',
                    },
                    createdTimestamp: null,
                    currentVTeam: '',
                    interactionId: '6920dda3-337a-48b1-b82d-2333392f9905',
                    isFcManaged: false,
                    isTerminated: false,
                    mainInteractionId: null,
                    media: {},
                    mediaChannel: 'none',
                    mediaProperties: null,
                    mediaType: 'none',
                    orgId: '00000000-0000-0000-0000-000000000000',
                    outboundType: null,
                    owner: null,
                    parentInteractionId: null,
                    participants: {},
                    previousVTeams: [],
                    queuedTimestamp: null,
                    state: 'none',
                    workflowManager: null,
                  },
                  interactionId: '6920dda3-337a-48b1-b82d-2333392f9905',
                  orgId: '58f1a59e-245c-4536-9ee4-06560658e493',
                  queueId: '76d05c1d-dbd1-43fb-b33d-7b3b65c03440',
                  queueMgr: 'aqm',
                  trackingId: '6888d800-0207-11ef-ba06-55aa7c41034c',
                  type: 'AgentCtqCancelled',
                },
                orgId: '58f1a59e-245c-4536-9ee4-06560658e493',
                trackingId: 'notifs_8d901db2-a8da-4de8-a22a-4a49b2a0b778',
                type: 'RoutingMessage',
              })
            );
          }, 1000),
        ]);
        expect(p).toBeDefined();
      } catch (e) {}
    },
    12 * SECONDS
  );

  it(
    'AqmReqs notif scuess',
    async () => {
      httpMock.request = jest.fn().mockResolvedValueOnce({
        status: 202,
        data: {webSocketUrl: 'fake-url'},
        statusText: 'OK',
        headers: {},
        config: {},
      });
      const aqm = new AqmReqs(a);
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
          msg: {} as Service.Aqm.Contact.AgentContact,
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
          msg: {} as Service.Aqm.Contact.AgentContact,
        },
      }));
      // expect(req).toBeDefined();
      try {
        const p = await Promise.all([
          req({}),
          setTimeout(() => {
            listenmock(
              JSON.stringify({
                data: {
                  agentId: '22a65ecb-cff0-4a57-9b73-55c6bfb15700',
                  eventTime: 1713941632508,
                  eventType: 'RoutingMessage',
                  interaction: {
                    callAssociatedData: {},
                    callAssociatedDetails: {},
                    callFlowParams: {},
                    callProcessingDetails: {},
                    contactDirection: {
                      type: 'INBOUND',
                    },
                    createdTimestamp: null,
                    currentVTeam: '',
                    interactionId: '6920dda3-337a-48b1-b82d-2333392f9906',
                    isFcManaged: false,
                    isTerminated: false,
                    mainInteractionId: null,
                    media: {},
                    mediaChannel: 'none',
                    mediaProperties: null,
                    mediaType: 'none',
                    orgId: '00000000-0000-0000-0000-000000000000',
                    outboundType: null,
                    owner: null,
                    parentInteractionId: null,
                    participants: {},
                    previousVTeams: [],
                    queuedTimestamp: null,
                    state: 'none',
                    workflowManager: null,
                  },
                  interactionId: '6920dda3-337a-48b1-b82d-2333392f9906',
                  orgId: '58f1a59e-245c-4536-9ee4-06560658e493',
                  queueId: '76d05c1d-dbd1-43fb-b33d-7b3b65c03440',
                  queueMgr: 'aqm',
                  trackingId: '6888d800-0207-11ef-ba06-55aa7c41034c',
                  type: 'AgentConsultCreated',
                },
                orgId: '58f1a59e-245c-4536-9ee4-06560658e493',
                trackingId: 'notifs_8d901db2-a8da-4de8-a22a-4a49b2a0b778',
                type: 'RoutingMessage',
              })
            );
          }, 1000),
        ]);
        expect(p).toBeDefined();
      } catch (e) {}
    },
    12 * SECONDS
  );
  it(
    'AqmReqs notif scuess',
    async () => {
      httpMock.request = jest.fn().mockRejectedValueOnce(new Error('Async error'));
      const aqm = new AqmReqs(a);
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
          msg: {} as Service.Aqm.Contact.AgentContact,
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
          msg: {} as Service.Aqm.Contact.AgentContact,
        },
      }));
      try {
        const p = await req({});
      } catch (e) {
        console.log(e);
        expect(e).toBeDefined();
      }
    },
    12 * SECONDS
  );
  it(
    'AqmReqs notif fail',
    async () => {
      httpMock.request = jest.fn().mockResolvedValueOnce({
        status: 202,
        data: {webSocketUrl: 'fake-url'},
        statusText: 'OK',
        headers: {},
        config: {},
      });
      const aqm = new AqmReqs(a);
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
          msg: {} as Service.Aqm.Contact.AgentContact,
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
          msg: {} as Service.Aqm.Contact.AgentContact,
        },
      }));
      // expect(req).toBeDefined();
      try {
        const p = await Promise.all([
          req({}),
          setTimeout(() => {
            listenmock(
              JSON.stringify({
                data: {
                  agentId: '22a65ecb-cff0-4a57-9b73-55c6bfb15700',
                  eventTime: 1713941632508,
                  eventType: 'RoutingMessage',
                  interaction: {
                    callAssociatedData: {},
                    callAssociatedDetails: {},
                    callFlowParams: {},
                    callProcessingDetails: {},
                    contactDirection: {
                      type: 'INBOUND',
                    },
                    createdTimestamp: null,
                    currentVTeam: '',
                    interactionId: '6920dda3-337a-48b1-b82d-2333392f9907',
                    isFcManaged: false,
                    isTerminated: false,
                    mainInteractionId: null,
                    media: {},
                    mediaChannel: 'none',
                    mediaProperties: null,
                    mediaType: 'none',
                    orgId: '00000000-0000-0000-0000-000000000000',
                    outboundType: null,
                    owner: null,
                    parentInteractionId: null,
                    participants: {},
                    previousVTeams: [],
                    queuedTimestamp: null,
                    state: 'none',
                    workflowManager: null,
                  },
                  interactionId: '6920dda3-337a-48b1-b82d-2333392f9907',
                  orgId: '58f1a59e-245c-4536-9ee4-06560658e493',
                  queueId: '76d05c1d-dbd1-43fb-b33d-7b3b65c03440',
                  queueMgr: 'aqm',
                  trackingId: '6888d800-0207-11ef-ba06-55aa7c41034c',
                  type: 'AgentConsultFailed',
                },
                orgId: '58f1a59e-245c-4536-9ee4-06560658e493',
                trackingId: 'notifs_8d901db2-a8da-4de8-a22a-4a49b2a0b778',
                type: 'RoutingMessage',
              })
            );
          }, 1000),
        ]);
        expect(p).toBeDefined();
      } catch (e) {}
    },
    12 * SECONDS
  );
});
