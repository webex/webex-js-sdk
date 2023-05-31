/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import { assert, expect } from "@webex/test-helper-chai";
import Calendar from '@webex/internal-plugin-calendar';
import MockWebex from '@webex/test-helper-mock-webex';
import { base64 } from "@webex/common";
import sinon from 'sinon';

import {
  CALENDAR_REGISTERED,
  CALENDAR_UPDATED,
  CALENDAR_DELETE,
  CALENDAR_CREATE,
  CALENDAR_UNREGISTERED,
} from '../../../src/constants';

describe('internal-plugin-calendar', () => {
  describe('Calendar Apis', () => {
    let webex;

    beforeEach(async () => {
      webex = new MockWebex({
        children: {
          calendar: Calendar,
        },
      });

      webex.canAuthorize = true;
      webex.internal.device = {
        register: sinon.stub().returns(Promise.resolve()),
        unregister: sinon.stub().returns(Promise.resolve()),
      };
      webex.internal.mercury = {
        connect: sinon.stub().returns(Promise.resolve()),
        disconnect: sinon.stub().returns(Promise.resolve()),
        on: sinon.stub().callsFake((event, callback) => {
          if (event === 'event:calendar.meeting.update') {
            callback({data: {calendarMeetingExternal: {id: 'calendarId1'}}});
          }
          if (event === 'event:calendar.meeting.delete') {
            callback({data: {calendarMeetingExternal: {id: 'calendarId1'}}});
          }
          if (event === 'event:calendar.meeting.create') {
            callback({data: {calendarMeetingExternal: {id: 'calendarId1'}}});
          }
        }),
        off: sinon.spy(),
      };
      webex.internal.encryption = {
        kms: {
          createUnboundKeys: sinon.stub().resolves([{
            uri: "kms://kms-us-int.wbx2.com/keys/xxxx-xxxx-xxxx-xxxx"
          }])
        },
        encryptText: sinon.stub().resolves("encryptedText")
      };
    });

    describe('Public Api Contract', () => {
      describe('#register()', () => {
        it('on calendar register call mercury registration', async () => {
          await webex.internal.calendar.register();
          assert.calledOnce(webex.internal.device.register);
          assert.callCount(webex.internal.mercury.on, 6);
          assert.equal(webex.internal.calendar.registered, true);
        });
        it('should trigger `calendar:register` event', async () => {
          const spy = sinon.spy();

          webex.internal.calendar.on(CALENDAR_REGISTERED, spy);
          await webex.internal.calendar.register();
          assert.calledOnce(spy);
        });

        describe('Events', () => {
          it('trigger `calendar:update` event', async () => {
            const spy = sinon.spy();

            webex.internal.calendar.on(CALENDAR_UPDATED, spy);
            await webex.internal.calendar.register();
            assert.calledOnce(spy);
          });

          it('trigger `calendar:create` event', async () => {
            const spy = sinon.spy();

            webex.internal.calendar.on(CALENDAR_CREATE, spy);
            await webex.internal.calendar.register();
            assert.calledOnce(spy);
          });

          it('trigger `calendar:delete` event', async () => {
            const spy = sinon.spy();

            webex.internal.calendar.on(CALENDAR_DELETE, spy);
            await webex.internal.calendar.register();
            assert.calledOnce(spy);
          });
        });
      });

      describe('#unregister()', () => {
        it('should call `mercury.unregister` and `device.unregister`', async () => {
          await webex.internal.calendar.register();
          await webex.internal.calendar.unregister();
          assert.callCount(webex.internal.mercury.off, 6);
          assert.calledOnce(webex.internal.mercury.disconnect);
          assert.calledOnce(webex.internal.device.unregister);
        });
        it('should trigger `calendar:unregister` event', async () => {
          const spy = sinon.spy();

          // reseting the state back
          await webex.internal.calendar.register();
          webex.internal.calendar.on(CALENDAR_UNREGISTERED, spy);
          await webex.internal.calendar.unregister();
          assert.calledOnce(spy);
        });
      });

      describe('#syncCalendar()', () => {
        it('should sync from calendar service', async () => {
          webex.request = sinon
            .stub()
            .returns(Promise.resolve({body: {items: [{id: 'calendar1'}, {id: 'calendar2'}]}}));
          webex.request = sinon.stub().returns(
            Promise.resolve({
              body: {
                items: [
                  {
                    id: 'calendar1',
                    encryptedNotes: 'notes1',
                    encryptedParticipants: ['participant1'],
                  },
                  {
                    id: 'calendar2',
                    encryptedNotes: 'notes2',
                    encryptedParticipants: ['participant2'],
                  },
                ],
              },
            })
          );
          await webex.internal.calendar.syncCalendar({fromDate: 'xx-xx', toDate: 'xx-nn'});
          assert.calledWith(webex.request, {
            method: 'GET',
            service: 'calendar',
            resource: 'calendarEvents',
            qs: {fromDate: 'xx-xx', toDate: 'xx-nn'},
          });
          assert.equal(webex.internal.calendar.getAll().length, 2);
          assert.equal(webex.internal.calendar.getAll()[0].id, 'calendar1');
        });
      });

      describe('#list()', () => {
        it('should fetch the calendar list', async () => {
          webex.request = sinon.stub().returns(
            Promise.resolve({
              body: {
                items: [
                  {
                    id: 'calendar1',
                    encryptedNotes: 'notes1',
                    encryptedParticipants: ['participant1'],
                  },
                  {
                    id: 'calendar2',
                    encryptedNotes: 'notes2',
                    encryptedParticipants: ['participant2'],
                  },
                ],
              },
            })
          );
          const res = await webex.internal.calendar.list({fromDate: 'xx-xx', toDate: 'xx-nn'});

          assert.equal(res.length, 2);
          assert.calledWith(webex.request, {
            method: 'GET',
            service: 'calendar',
            resource: 'calendarEvents',
            qs: {fromDate: 'xx-xx', toDate: 'xx-nn'},
          });
        });

        it('should fetch the calendar list and resolves with null encryptedNotes', async () => {
          const webexRequestStub = sinon.stub();

          // calendar list stub
          webexRequestStub
            .withArgs({
              method: 'GET',
              service: 'calendar',
              resource: 'calendarEvents',
              qs: {fromDate: 'xx-xx', toDate: 'xx-nn'},
            })
            .returns(
              Promise.resolve({
                body: {
                  items: [
                    {id: 'calendar1', encryptedParticipants: ['participant1']},
                    {
                      id: 'calendar2',
                      encryptedNotes: 'notes2',
                      encryptedParticipants: ['participant2'],
                    },
                  ],
                },
              })
            );

          // Assign webexRequestStub to webex.request
          webex.request = webexRequestStub;

          const res = await webex.internal.calendar.list({fromDate: 'xx-xx', toDate: 'xx-nn'});

          assert.equal(res.length, 2);
          assert.deepEqual(res, [
            {id: 'calendar1', encryptedParticipants: ['participant1']},
            {id: 'calendar2', encryptedNotes: 'notes2', encryptedParticipants: ['participant2']},
          ]);
          assert.calledWith(webex.request, {
            method: 'GET',
            service: 'calendar',
            resource: 'calendarEvents',
            qs: {fromDate: 'xx-xx', toDate: 'xx-nn'},
          });
        });

        it('should fetch the calendar list and resolves with fetched encryptedNotes', async () => {
          const webexRequestStub = sinon.stub();

          // calendar list stub
          webexRequestStub
            .withArgs({
              method: 'GET',
              service: 'calendar',
              resource: 'calendarEvents',
              qs: {fromDate: 'xx-xx', toDate: 'xx-nn'},
            })
            .returns(
              Promise.resolve({
                body: {
                  items: [
                    {id: 'calendar1', encryptedNotes: 'notes1', encryptedParticipants: ['participant1']},
                    {
                      id: 'calendar2',
                      encryptedNotes: 'notes2',
                      encryptedParticipants: ['participant2'],
                    },
                  ],
                },
              })
            );

          // Assign webexRequestStub to webex.request
          webex.request = webexRequestStub;

          const res = await webex.internal.calendar.list({fromDate: 'xx-xx', toDate: 'xx-nn'});

          assert.equal(res.length, 2);
          assert.deepEqual(res, [
            {id: 'calendar1', encryptedNotes: 'notes1', encryptedParticipants: ['participant1']},
            {id: 'calendar2', encryptedNotes: 'notes2', encryptedParticipants: ['participant2']},
          ]);
          assert.calledWith(webex.request, {
            method: 'GET',
            service: 'calendar',
            resource: 'calendarEvents',
            qs: {fromDate: 'xx-xx', toDate: 'xx-nn'},
          });
        });
      });

      describe('#getNotes()', () => {
        it('should fetch the meeting notes', async () => {
          const id = 'meetingId123';

          webex.request = sinon.stub().returns(
            Promise.resolve({
              body: {
                encryptedNotes: 'notes1',
              },
            })
          );

          const res = await webex.internal.calendar.getNotes(id);

          assert.equal(res.body.encryptedNotes, 'notes1');
          assert.calledWith(webex.request, {
            method: 'GET',
            service: 'calendar',
            resource: `calendarEvents/${base64.encode(id)}/notes`,
          });
        });
      });

      describe('#getParticipants()', () => {
        const id = 'meetingId123';

        it('should fetch the meeting participants', async () => {
          webex.request = sinon.stub().returns(
            Promise.resolve({
              body: {
                encryptedParticipants: ['participant1'],
              },
            })
          );

          const res = await webex.internal.calendar.getParticipants(id);

          assert.equal(res.body.encryptedParticipants.length, 1);
          assert.calledWith(webex.request, {
            method: 'GET',
            service: 'calendar',
            resource: `calendarEvents/${base64.encode(id)}/participants`,
          });
        });
      });

      describe("#getSchedulerData()", () => {
        it("should fetch meeting calendar data", async () => {
          const query = {
            siteName: "scheduler01.dmz.webex.com",
            clientMeetingId: "YWJjZGFiY2QtYWJjZC1hYmNkLWFiY2QtMDAwMDAwMDA"
          };

          webex.request = sinon.stub().resolves({
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

          const res = await webex.internal.calendar.getSchedulerData(query);

          expect(res.body.encryptedSubject).to.equal("My Meeting 1");
          expect(res.body.schedulerPreferences.uiControlAttributes.displayHostSaveMeetingTemplate).to.be.true;
          expect(res.body.schedulerPreferences.webexOptions.sessionTypeId).to.equal(3);
          assert.calledWith(webex.request, {
            method: "GET",
            service: "calendar",
            resource: "schedulerData",
            qs: {
              siteName: query.siteName,
              clientMeetingId: query.clientMeetingId
            }
          });
        });
      });

      describe("#createCalendarEvent()", () => {
        it("should create an calendar event", async () => {
          const data = {
            encryptionKeyUrl: "kms://kms-us-int.wbx2.com/keys/d1c14fc5-be10-4389-ae83-9521f92fbfd3",
            notes: "This is Agenda",
            subject: "My Meeting 1",
            webexOptions: "{}"
          };
          const query = {};

          webex.request = sinon.stub().resolves({
            body: {
              meetingId: "abcdabcd-abcd-abcd-abcd-00000000",
              globalMeetingId: "xxxx-xxxx-xxxx-xxxx"
            }
          });

          const res = await webex.internal.calendar.createCalendarEvent(data);

          expect(res.body.meetingId).to.equal("abcdabcd-abcd-abcd-abcd-00000000");
          expect(res.body.globalMeetingId).to.equal("xxxx-xxxx-xxxx-xxxx");
          assert.calledWith(webex.request, {
            method: "POST",
            service: "calendar",
            body: data,
            resource: "calendarEvents/sync",
            qs: query
          });
        });
      });

      describe("#updateCalendarEvent()", () => {
        it("should update a calendar event", async () => {
          const id = "abcdabcd-abcd-abcd-abcd-00000000";
          const data = {
            encryptionKeyUrl: "kms://kms-us-int.wbx2.com/keys/d1c14fc5-be10-4389-ae83-9521f92fbfd3",
            notes: "This is Agenda",
            subject: "My Meeting 1",
            webexOptions: "{}"
          };
          const query = {};

          webex.request = sinon.stub().resolves({
            body: {
              meetingId: "abcdabcd-abcd-abcd-abcd-00000000",
              globalMeetingId: "xxxx-xxxx-xxxx-xxxx"
            }
          });

          const res = await webex.internal.calendar.updateCalendarEvent(id, data);

          expect(res.body.meetingId).to.equal("abcdabcd-abcd-abcd-abcd-00000000");
          expect(res.body.globalMeetingId).to.equal("xxxx-xxxx-xxxx-xxxx");
          assert.calledWith(webex.request, {
            method: "PATCH",
            service: "calendar",
            body: data,
            resource: `calendarEvents/${base64.encode(id)}/sync`,
            qs: query
          });
        });
      });

      describe("#deleteCalendarEvent()", () => {
        it("should delete a calendar event", async () => {
          const id = "abcdabcd-abcd-abcd-abcd-00000000";
          const query = {};

          webex.request = sinon.stub().resolves({
            body: {}
          });

          await webex.internal.calendar.deleteCalendarEvent(id, query);

          assert.calledWith(webex.request, {
            method: "DELETE",
            service: "calendar",
            resource: `calendarEvents/${base64.encode(id)}/sync`,
            qs: query
          });
        });
      });
    });
  });
});
