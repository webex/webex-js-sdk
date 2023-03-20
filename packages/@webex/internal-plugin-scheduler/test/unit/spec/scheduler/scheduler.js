import MockWebex from '@webex/test-helper-mock-webex';

import Scheduler from '@webex/internal-plugin-scheduler';

import CONSTANTS from '@webex/internal-plugin-scheduler/src/scheduler/scheduler.constants';
import { base64 } from "@webex/common";

/**
 * Unit tests are not used against services.
 */
describe('plugin-scheduler', () => {
  describe('Scheduler', () => {
    let webex;
    let scheduler;

    beforeEach(async () => {
      webex = new MockWebex({
        children: {
          scheduler: Scheduler,
        },
      });

      scheduler = webex.internal.scheduler;

      webex.canAuthorize = true;
      webex.internal.device = {
        register: jest.fn().mockResolvedValue({}),
        unregister: jest.fn().mockResolvedValue({}),
      };
      webex.internal.mercury = {
        connect: jest.fn().mockResolvedValue({}),
        disconnect: jest.fn().mockResolvedValue({}),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'event:calendar.free_busy') {
            callback({data: {calendarFreeBusyScheduleResponse: {calendarFreeBusyItems: []}}});
          }
        }),
        off: jest.fn(),
      };
      webex.transform = jest.fn().mockResolvedValue({});
      webex.internal.encryption = {
        kms: {
          createUnboundKeys: jest.fn().mockResolvedValue([{
            uri: 'kms://kms-us-int.wbx2.com/keys/xxxx-xxxx-xxxx-xxxx'
          }])
        },
        encryptText: jest.fn().mockResolvedValue('encryptedText')
      };
    });

    /**
     * Any expected property assignments to this scope.
     */
    describe('properties', () => {
      describe('request', () => {
        it('should be mounted', () => {
          expect(scheduler.request).toBeDefined();
        });
      });

      describe('logger', () => {
        it('should be mounted', () => {
          expect(scheduler.logger).toBeDefined();
        });
      });

      describe('rpcEventRequests', () => {
        it('should be mounted', () => {
          expect(scheduler.rpcEventRequests).toBeDefined();
        });
      });
    });

    /**
     * Any expected event workflows assigned to this scope.
     */
    describe('events', () => {
      // TODO - Add event testing.
    });

    /**
     * Any methods assigned to this scope.
     */
    describe('methods', () => {
      describe('#register()', () => {
        it('on scheduler register call mercury registration', async () => {
          await scheduler.register();
          expect(webex.internal.device.register).toHaveBeenCalledTimes(1);
          expect(webex.internal.mercury.on).toHaveBeenCalledTimes(1);
          expect(scheduler.registered).toBe(true);
        });
        it('should trigger `scheduler:registered` event', async () => {
          const spy = jest.fn();
          scheduler.on(CONSTANTS.SCHEDULER_REGISTERED, spy);
          await scheduler.register();
          expect(spy).toHaveBeenCalledTimes(1);
        });
      });

      describe('#unregister()', () => {
        it('should call `mercury.unregister` and `device.unregister`', async () => {
          await scheduler.register();
          await scheduler.unregister();
          expect(webex.internal.mercury.off).toHaveBeenCalledTimes(1);
          expect(webex.internal.mercury.disconnect).toHaveBeenCalledTimes(1);
          expect(webex.internal.device.unregister).toHaveBeenCalledTimes(1);
        });
        it('should trigger `scheduler:unregistered` event', async () => {
          const spy = jest.fn();
          await scheduler.register();
          scheduler.on(CONSTANTS.SCHEDULER_UNREGISTERED, spy);
          await scheduler.unregister();
          expect(spy).toHaveBeenCalledTimes(1);
        });
      });

      describe("#getSchedulerData()", () => {
        it("should fetch meeting scheduler data", async () => {
          const query = {
            siteName: "scheduler01.dmz.webex.com",
            clientMeetingId: "YWJjZGFiY2QtYWJjZC1hYmNkLWFiY2QtMDAwMDAwMDA"
          };

          webex.request = jest.fn().mockResolvedValue({
            body: {
              encryptedSubject: "My Meeting 1",
              schedulerPreferences: {
                uiControlAttributes: {
                  displayHostSaveMeetingTemplate: true
                },
                webexOptions: {
                  sessionTypeId: 3
                }
              }
            }
          });

          const res = await scheduler.getSchedulerData(query);

          expect(res.body.encryptedSubject).toBe("My Meeting 1");
          expect(res.body.schedulerPreferences.uiControlAttributes.displayHostSaveMeetingTemplate).toBe(true);
          expect(res.body.schedulerPreferences.webexOptions.sessionTypeId).toBe(3);
          expect(webex.request).toHaveBeenCalledWith({
            method: "GET",
            service: "calendar",
            resource: 'schedulerData',
            qs: {
              siteName: query.siteName,
              clientMeetingId: query.clientMeetingId,
            },
          });
        });
      });

      describe("#createCalendarEvent()", () => {
        it("should create an calendar event", async () => {
          const data = {
            encryptionKeyUrl: 'kms://kms-us-int.wbx2.com/keys/d1c14fc5-be10-4389-ae83-9521f92fbfd3',
            notes: 'This is Agenda',
            subject: 'My Meeting 1',
            webexOptions: '{}'
          };

          webex.request = jest.fn().mockResolvedValue({
            body: {
              meetingId: 'abcdabcd-abcd-abcd-abcd-00000000',
              globalMeetingId: 'xxxx-xxxx-xxxx-xxxx'
            }
          });

          const res = await scheduler.createCalendarEvent(data);

          expect(res.body.meetingId).toBe('abcdabcd-abcd-abcd-abcd-00000000');
          expect(res.body.globalMeetingId).toBe('xxxx-xxxx-xxxx-xxxx');
          expect(webex.request).toHaveBeenCalledWith({
            method: "POST",
            service: "calendar",
            body: data,
            resource: 'calendarEvents/sync'
          });
        });
      });

      describe("#updateCalendarEvent()", () => {
        it("should update a calendar event", async () => {
          const id = 'abcdabcd-abcd-abcd-abcd-00000000';
          const data = {
            encryptionKeyUrl: 'kms://kms-us-int.wbx2.com/keys/d1c14fc5-be10-4389-ae83-9521f92fbfd3',
            notes: 'This is Agenda',
            subject: 'My Meeting 1',
            webexOptions: '{}'
          };

          webex.request = jest.fn().mockResolvedValue({
            body: {
              meetingId: 'abcdabcd-abcd-abcd-abcd-00000000',
              globalMeetingId: 'xxxx-xxxx-xxxx-xxxx'
            }
          });

          const res = await scheduler.updateCalendarEvent(id, data);

          expect(res.body.meetingId).toBe('abcdabcd-abcd-abcd-abcd-00000000');
          expect(res.body.globalMeetingId).toBe('xxxx-xxxx-xxxx-xxxx');
          expect(webex.request).toHaveBeenCalledWith({
            method: "PATCH",
            service: "calendar",
            body: data,
            resource: `calendarEvents/${base64.encode(id)}/sync`,
          });
        });
      });

      describe("#deleteCalendarEvent()", () => {
        it("should delete a calendar event", async () => {
          const id = 'abcdabcd-abcd-abcd-abcd-00000000';

          webex.request = jest.fn().mockResolvedValue({
            body: {}
          });

          await scheduler.deleteCalendarEvent(id);

          expect(webex.request).toHaveBeenCalledWith({
            method: "DELETE",
            service: "calendar",
            resource: `calendarEvents/${base64.encode(id)}/sync`,
          });
        });
      });
    });
  });
});
