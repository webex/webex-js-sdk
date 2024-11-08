/* eslint-disable @typescript-eslint/no-explicit-any */
import { AqmReqs } from '../../../../../src/services/core/aqm-reqs';
import routingAgent from '../../../../../src/services/agent';
import { WebSocketManager } from '../../../../../src/services/core/WebSocket/WebSocketManager';
import { Signal } from '../../../../../src/services/core/Signal';

jest.mock('../../../../../src/services/core/HttpRequest');
jest.mock('../../../../../src/services/core/WebSocket/WebSocketManager');

global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost:3000/12345');

class MockWebSocketManager extends WebSocketManager {
  constructor() {
    super({ webex: {} as any });
    const { send, signal } = Signal.create.withData<string>();
    (this as any).onMessage = signal;
    (this as any).onMessageSend = send;
  }
}

describe('AQM routing agent', () => {
  let fakeAqm: AqmReqs;
  let agent: any;

  beforeEach(() => {
    const mockWebSocketManager = new MockWebSocketManager();

    fakeAqm = new AqmReqs(mockWebSocketManager);
    agent = routingAgent(fakeAqm) as any;
  });

  it('logout', async () => {
    const req = agent.logout({ data: { logoutReason: 'User requested logout' } }).catch((e: any) => e);
    expect(req).toBeDefined();
  });

  it('reload', async () => {
    const req = agent.reload().catch((e: any) => e);
    expect(req).toBeDefined();
  });

  it('stationLogin', async () => {
    const req = agent.stationLogin({ data: {} as any }).catch((e: any) => e);
    expect(req).toBeDefined();
  });

  it('stateChange', async () => {
    const req = agent.stateChange({ data: {} as any }).catch((e: any) => e);
    expect(req).toBeDefined();
  });
});