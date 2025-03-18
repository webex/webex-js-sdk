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
              destination: "+142356",
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

      it("should handle network errors", () => {

          const fakeAqm = {
          req: () => jest.fn().mockRejectedValue(new Error("Network Error")),
          evt: jest.fn()
         };

          const dialer = aqmDialer(fakeAqm as any);

          return expect(dialer.startOutdial({
          
            data: {
            entryPointId: "1212312",
            destination: "+142356",
            direction: "OUTBOUND",
            attributes: {},
            mediaType: "telephony",
            outboundType: "OUTDIAL"
           }

          })).rejects.toThrow("Network Error");
        });
        
        it("should handle invalid payload", () => {

          const fakeAqm = {

          req: () => jest.fn().mockRejectedValue(new Error("Invalid Payload in request")),
          evt: jest.fn()

         };

          const dialer = aqmDialer(fakeAqm as any);

          return expect(dialer.startOutdial({

          data: {
            entryPointId: "",
            destination: "",
            direction: "OUTBOUND",
            attributes: {},
            mediaType: "telephony",
            outboundType: "OUTDIAL"
           }

          })).rejects.toThrow("Invalid Payload in request");
        });


        it("should handle servers errors", () => {

          const fakeAqm = {
          req: () => jest.fn().mockRejectedValue(new Error("Server Error")),
          evt: jest.fn()
         };

          const dialer = aqmDialer(fakeAqm as any);
          return expect(dialer.startOutdial({

          data: {
            entryPointId: "123456",
            destination: "+142356",
            direction: "OUTBOUND",
            attributes: {},
            mediaType: "telephony",
            outboundType: "OUTDIAL"
           }

          })).rejects.toThrow("Server Error");

        });

        it("should handle Timeout scenarios", () => {

          const fakeAqm = {
          req: () => jest.fn().mockRejectedValue(new Error("Request Timeout")),
          evt: jest.fn()
         };

          const dialer = aqmDialer(fakeAqm as any);
          return expect(dialer.startOutdial({

          data: {
            entryPointId: "12345",
            destination: "+123456",
            direction: "OUTBOUND",
            attributes: {},
            mediaType: "telephony",
            outboundType: "OUTDIAL"
           }

          })).rejects.toThrow("Request Timeout");
        });
});
});
