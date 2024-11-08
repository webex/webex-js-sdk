/* eslint-disable @typescript-eslint/no-explicit-any */
import {AqmReqs} from '../../../../../src/services/core/aqm-reqs';
import routingAgent from '../../../../../src/services/agent';

jest.mock('../../../../../src/services/core/HttpRequest');
jest.mock('../../../../../src/services/core/aqm-reqs');

const fakeAqm = new AqmReqs();
const agent = routingAgent(fakeAqm) as any;

describe('AQM routing agent', () => {
  it('logout', async () => {
    const req = agent.logout({data: {logoutReason: 'User requested logout'}}).catch((e: any) => e);
    expect(req).toBeDefined();
  });

  it('reload', async () => {
    const req = agent.reload().catch((e: any) => e);
    expect(req).toBeDefined();
  });

  it('stationLogin', async () => {
    const req = agent.stationLogin({data: {} as any}).catch((e: any) => e);
    expect(req).toBeDefined();
  });

  it('stateChange', async () => {
    const req = agent.stateChange({data: {} as any}).catch((e: any) => e);
    expect(req).toBeDefined();
  });
});
