import AqmReqs from "../../../../../src/services/core/aqm-reqs";
import aqmDialer from "../../../../../src/services/task/dialer";

jest.mock('../../../../../src/services/core/Utils', () => ({

  createErrDetailsObject: jest.fn(),
  getRoutingHost: jest.fn(),
}));

jest.mock('../../../../../src/services/core/aqm-reqs');

describe('AQM routing dialer', () => {

  let fakeAqm: jest.Mocked<AqmReqs>;

  beforeEach(() => {

    jest.clearAllMocks();

    fakeAqm = new AqmReqs() as jest.Mocked<AqmReqs>;
    fakeAqm.reqEmpty = jest.fn().mockImplementation((fn) => fn);
    fakeAqm.req = jest.fn().mockImplementation((fn) => fn);
  });


describe("Routing outbound dial", () => {

    it("should call the startdial api", () => {

        const fakeAqm = {
          req: () =>
            jest.fn().mockResolvedValue(() => {
              Promise.resolve({ data: "outdial success" });
            }),
          evt: jest.fn()
        };
      
        const dialer = aqmDialer(fakeAqm as any);
        
        dialer
          .startOutdial({
            data: {
              entryPointId: "1212312",
              destination: "asdaad",
              direction: "OUTBOUND",
              attributes: {},
              mediaType: "telephony",
              outboundType: "OUTDIAL"
            }
          })
          .then(response => {
            expect(response.data).toBe("outdial success");
          })
          .catch(() => {
            expect(true).toBe(true);
          });
      
        expect(dialer.startOutdial).toHaveBeenCalled();
      });
});

});
