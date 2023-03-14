import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';

import Scheduler from '@webex/internal-plugin-scheduler';
import sinon from "sinon";

import CONSTANTS from '@webex/internal-plugin-scheduler/src/scheduler/scheduler.constants';

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
        register: sinon.stub().returns(Promise.resolve()),
        unregister: sinon.stub().returns(Promise.resolve()),
      };
      webex.internal.mercury = {
        connect: sinon.stub().returns(Promise.resolve()),
        disconnect: sinon.stub().returns(Promise.resolve()),
        on: sinon.stub().callsFake((event, callback) => {
          if (event === 'event:calendar.free_busy') {
            callback({data: {calendarFreeBusyScheduleResponse: {calendarFreeBusyItems: []}}});
          }
        }),
        off: sinon.spy(),
      };
      webex.transform = sinon.stub().returns(Promise.resolve());
    });

    /**
     * Any expected property assignments to this scope.
     */
    describe('properties', () => {
      describe('request', () => {
        it('should be mounted', () => {
          assert.exists(scheduler.request);
        });
      });

      describe('logger', () => {
        it('should be mounted', () => {
          assert.exists(scheduler.logger);
        });
      });

      describe('rpcEventRequests', () => {
        it('should be mounted', () => {
          assert.exists(scheduler.rpcEventRequests);
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
          assert.calledOnce(webex.internal.device.register);
          assert.callCount(webex.internal.mercury.on, 1);
          assert.equal(scheduler.registered, true);
        });
        it('should trigger `scheduler:registered` event', async () => {
          const spy = sinon.spy();
          scheduler.on(CONSTANTS.SCHEDULER_REGISTERED, spy);
          await scheduler.register();
          assert.calledOnce(spy);
        });
      });

      describe('#unregister()', () => {
        it('should call `mercury.unregister` and `device.unregister`', async () => {
          await scheduler.register();
          await scheduler.unregister();
          assert.callCount(webex.internal.mercury.off, 1);
          assert.calledOnce(webex.internal.mercury.disconnect);
          assert.calledOnce(webex.internal.device.unregister);
        });
        it('should trigger `scheduler:unregistered` event', async () => {
          const spy = sinon.spy();
          await scheduler.register();
          scheduler.on(CONSTANTS.SCHEDULER_UNREGISTERED, spy);
          await scheduler.unregister();
          assert.calledOnce(spy);
        });
      });

      describe("#getSchedulerData()", () => {
        it("should fetch meeting scheduler data", async () => {
          const query = {
            siteName: "scheduler01.dmz.webex.com",
            clientMeetingId: "abcdabcd-abcd-abcd-abcd-00000000"
          };

          webex.request = sinon.stub().returns(
            Promise.resolve({
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
            })
          );

          const res = await scheduler.getSchedulerData(query);

          assert.equal(res.body.encryptedSubject, "My Meeting 1");
          assert.equal(res.body.schedulerPreferences.uiControlAttributes.
            displayHostSaveMeetingTemplate, true);
          assert.equal(res.body.schedulerPreferences.webexOptions.sessionTypeId, 3);
          assert.calledWith(webex.request, {
            method: "GET",
            service: "calendar",
            resource: `schedulerData?siteName=${query.siteName}&clientMeetingId=${btoa(query.clientMeetingId)}`
          });
        });
      });

      describe("#createCalendarEvent()", () => {
        it("should create an calender event", async () => {
          const data = {
            encryptionKeyUrl: 'kms://kms-us-int.wbx2.com/keys/d1c14fc5-be10-4389-ae83-9521f92fbfd3',
            notes: 'This is Agenda',
            subject: 'My Meeting 1',
            webexOptions: '{}'
          };

          webex.request = sinon.stub().returns(
            Promise.resolve({
              body: {
                meetingId: 'abcdabcd-abcd-abcd-abcd-00000000',
                globalMeetingId: 'xxxx-xxxx-xxxx-xxxx'
              }
            })
          );

          const res = await scheduler.createCalendarEvent(data);

          assert.equal(res.body.meetingId, 'abcdabcd-abcd-abcd-abcd-00000000');
          assert.equal(res.body.globalMeetingId, 'xxxx-xxxx-xxxx-xxxx');
          assert.calledWith(webex.request, {
            method: "POST",
            service: "calendar",
            body: data,
            resource: 'calendarEvents/sync'
          });
        });
      });

      describe("#updateCalendarEvent()", () => {
        it("should update an calender event", async () => {
          const id = 'abcdabcd-abcd-abcd-abcd-00000000';
          const data = {
            encryptionKeyUrl: 'kms://kms-us-int.wbx2.com/keys/d1c14fc5-be10-4389-ae83-9521f92fbfd3',
            notes: 'This is Agenda',
            subject: 'My Meeting 1',
            webexOptions: '{}'
          };

          webex.request = sinon.stub().returns(
            Promise.resolve({
              body: {
                meetingId: 'abcdabcd-abcd-abcd-abcd-00000000',
                globalMeetingId: 'xxxx-xxxx-xxxx-xxxx'
              }
            })
          );

          const res = await scheduler.updateCalendarEvent(id, data);

          assert.equal(res.body.meetingId, 'abcdabcd-abcd-abcd-abcd-00000000');
          assert.equal(res.body.globalMeetingId, 'xxxx-xxxx-xxxx-xxxx');
          assert.calledWith(webex.request, {
            method: "PATCH",
            service: "calendar",
            body: data,
            resource: `calendarEvents/${btoa(id)}/sync`,
          });
        });
      });

      describe("#deleteCalendarEvent()", () => {
        it("should delete an calender event", async () => {
          const id = 'abcdabcd-abcd-abcd-abcd-00000000';

          webex.request = sinon.stub().returns(
            Promise.resolve({
              body: {
              }
            })
          );

          await scheduler.deleteCalendarEvent(id);

          assert.calledWith(webex.request, {
            method: "DELETE",
            service: "calendar",
            resource: `calendarEvents/${btoa(id)}/sync`,
          });
        });
      });
    });
  });
});
