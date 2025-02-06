// import aqmDialer from '../../../../../src/services/task/dialer';
// import { CC_EVENTS } from '../../../../../src/services/config/types';
// import { WCC_API_GATEWAY } from '../../../../../src/services/constants';
// import { createErrDetailsObject as err } from '../../../../../src/services/core/Utils';
// import { TASK_MESSAGE_TYPE, TASK_API } from '../../../../../src/services/task/constants';
// import * as Contact from '../../../../../src/services/task/types';
// import AqmReqs from '../../../../../src/services/core/aqm-reqs';
// import { WebSocketManager } from '../../../../../src/services/core/websocket/WebSocketManager';

// jest.mock('../../../../../src/services/core/aqm-reqs');
// jest.mock('../../../../../src/services/core/Utils');

// describe('aqmDialer', () => {
//   let aqmReqsInstance: AqmReqs;

//   beforeEach(() => {
//     const mockWebSocketManager = {
//       websocket: {},
//       shouldReconnect: false,
//       isSocketClosed: false,
//       isWelcomeReceived: false,
//     } as unknown as WebSocketManager;

//     aqmReqsInstance = new AqmReqs(mockWebSocketManager);
//   });

//   it('should create a startOutdial request successfully', () => {
//     const dialer = aqmDialer(aqmReqsInstance);
//     const payload = {
//       data: {
//         entryPointId: 'entry-point-id',
//         destination: 'destination-number',
//         direction: 'OUTBOUND',
//         attributes: {},
//         mediaType: 'telephony',
//         outboundType: 'OUTDIAL',
//       } as Contact.DialerPayload,
//     };

//     const expectedRequest = {
//       url: `${TASK_API}`,
//       host: WCC_API_GATEWAY,
//       method: 'POST',
//       data: payload.data,
//       err,
//       notifSuccess: {
//         bind: {
//           type: TASK_MESSAGE_TYPE,
//           data: { type: CC_EVENTS.AGENT_OFFER_CONTACT },
//         },
//         msg: {} as Contact.AgentContact,
//       },
//       notifFail: {
//         bind: {
//           type: TASK_MESSAGE_TYPE,
//           data: { type: CC_EVENTS.AGENT_OUTBOUND_FAILED },
//         },
//         errId: 'Service.aqm.dialer.startOutdial',
//       },
//     };

//     const reqSpy = jest.spyOn(aqmReqsInstance, 'req').mockImplementation((fn) => fn(payload));

//     dialer.startOutdial(payload);

//     expect(reqSpy).toHaveBeenCalledWith(expect.any(Function));
//     expect(reqSpy.mock.results[0].value).toEqual(expectedRequest);
//   });

//   it('should handle errors during startOutdial request', () => {
//     const dialer = aqmDialer(aqmReqsInstance);
//     const payload = {
//       data: {
//         entryPointId: 'entry-point-id',
//         destination: 'destination-number',
//         direction: 'OUTBOUND',
//         attributes: {},
//         mediaType: 'telephony',
//         outboundType: 'OUTDIAL',
//       } as Contact.DialerPayload,
//     };

//     const mockError = new Error('Test error');
//     const reqSpy = jest.spyOn(aqmReqsInstance, 'req').mockImplementation(() => {
//       throw mockError;
//     });

//     expect(() => dialer.startOutdial(payload)).toThrow(mockError);
//     expect(reqSpy).toHaveBeenCalledWith(expect.any(Function));
//   });
// });