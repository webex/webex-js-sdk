/* eslint-disable @typescript-eslint/no-explicit-any */
import {DESTINATION_TYPE} from "../../../../../src/services/task/types";
import AqmReqs from "../../../../../src/services/core/aqm-reqs";
import routingContact from "../../../../../src/services/task/contact";

jest.mock('../../../../../src/services/core/Utils', () => ({
  createErrDetailsObject: jest.fn(),
  getRoutingHost: jest.fn(),
}));

jest.mock('../../../../../src/services/core/aqm-reqs');

describe('AQM routing contact', () => {
  let fakeAqm: jest.Mocked<AqmReqs>;
  let contact: ReturnType<typeof routingContact>;

  beforeEach(() => {
    jest.clearAllMocks();

    fakeAqm = new AqmReqs() as jest.Mocked<AqmReqs>;
    fakeAqm.reqEmpty = jest.fn().mockImplementation((fn) => fn);
    fakeAqm.req = jest.fn().mockImplementation((fn) => fn);

    contact = routingContact(fakeAqm);
  });


describe("Routing contacts", () => {
  it("accept", () => {
    fakeAqm.pendingRequests = {};
    const req = contact.accept({
      interactionId: "interactionId"
    });
    expect(req).toBeDefined();
  });

  it("hold", () => {
    fakeAqm.pendingRequests = {};
    const req = contact.hold({
      interactionId: "interactionId",
      data: {mediaResourceId: ""}
    });
    expect(req).toBeDefined();
  });

  it("unHold", () => {
    fakeAqm.pendingRequests = {};
    const req = contact.unHold({ interactionId: "interactionId", data:  {mediaResourceId: ""}});
    expect(req).toBeDefined();
  });

  it("pauseRecording", () => {
    fakeAqm.pendingRequests = {};
    const req = contact.pauseRecording({
      interactionId: "interactionId"
    });
    expect(req).toBeDefined();
  });

  it("resumeRecording", () => {
    fakeAqm.pendingRequests = {};
    const req = contact.resumeRecording({ interactionId: "interactionId", data: { autoResumed: "true" } } as any);
    expect(req).toBeDefined();
  });

  it("consult queue", () => {
    fakeAqm.pendingRequests = {};
    const req = contact.consult({
      interactionId: "interactionId",
      data: {
        to: "queueId",
        destinationType: "queue",
        mediaType: "telephony"
      },
      url: ""
    } as any);
    expect(req).toBeDefined();
  });

  it("consult dn", () => {
    fakeAqm.pendingRequests = {};
    const req = contact.consult({
      interactionId: "interactionId",
      data: {
        to: "9372724724",
        destinationType: "dialNumber",
        mediaType: "telephony"
      },
      url: ""
    } as any);
    expect(req).toBeDefined();
  });

  it("consultAccept", () => {
    const req = contact.consultAccept({} as any);
    expect(req).toBeDefined();
  });
 
  it("cancelCtq", () => {
    const req = contact.cancelCtq({} as any);
    expect(req).toBeDefined();
  });

  it("blindTransfer", () => {
    fakeAqm.pendingRequests = {};
    const req = contact.blindTransfer({
      interactionId: "interactionId",
      data: {
        to: "agentId",
        destinationType: DESTINATION_TYPE.AGENT
      }
    });
    expect(req).toBeDefined();
  });

  it("vteamTransfer", () => {
    fakeAqm.pendingRequests = {};
    const req = contact.vteamTransfer({
      interactionId: "interactionId",
      data: {
        to: "queueId",
        destinationType: DESTINATION_TYPE.QUEUE
      }
    });
    expect(req).toBeDefined();
  });

  it("consultTransfer", () => {
    fakeAqm.pendingRequests = {};
    const req = contact.consultTransfer({
      interactionId: "interactionId",
      data: {
        to: 'dn',
        destinationType: DESTINATION_TYPE.DIALNUMBER
      }
    });
    expect(req).toBeDefined();
  });

  it("contact End", () => {
    fakeAqm.pendingRequests = {};
    const req = contact.end({
      interactionId: "interactionId",
      data: {}
    } as any);
    expect(req).toBeDefined();
  });

  it("cancel Contact", () => {
    fakeAqm.pendingRequests = {};
    const req = contact.cancelTask({
      interactionId: "interactionId",
      data: {}
    } as any);
    expect(req).toBeDefined();
  });

  it("wrapup contact", () => {
    fakeAqm.pendingRequests = {};
    const req = contact.wrapup({
      interactionId: "interactionId",
      data: { wrapUpReason: "testWrapUpReason", auxCodeId: "auxCodeID1234", isAutoWrapup: "on" }
    } as any);
    expect(req).toBeDefined();
  });
});
})
