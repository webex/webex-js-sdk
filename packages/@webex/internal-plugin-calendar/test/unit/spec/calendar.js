/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import Calendar from '@webex/internal-plugin-calendar';
import MockWebex from '@webex/test-helper-mock-webex';
import btoa from 'btoa';
import sinon from 'sinon';

import {CALENDAR_REGISTERED, CALENDAR_UPDATED, CALENDAR_DELETE, CALENDAR_CREATE, CALENDAR_UNREGISTERED} from '../../../src/constants';

describe('internal-plugin-calendar', () => {
  describe('Calendar Apis', () => {
    let webex;

    beforeEach(async () => {
      webex = new MockWebex({
        children: {
          calendar: Calendar
        }
      });

      webex.canAuthorize = true;
      webex.internal.device = {
        register: sinon.stub().returns(Promise.resolve()),
        unregister: sinon.stub().returns(Promise.resolve())
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
        off: sinon.spy()
      };
    });

    describe('Public Api Contract', () => {
      describe('#register()', () => {
        it('on calendar register call mercury registration', async () => {
          await webex.internal.calendar.register();
          assert.calledOnce(webex.internal.device.register);
          assert.callCount(webex.internal.mercury.on, 5);
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
          assert.callCount(webex.internal.mercury.off, 5);
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
          webex.request = sinon.stub().returns(Promise.resolve({body: {items: [{id: 'calendar1'}, {id: 'calendar2'}]}})); webex.request = sinon.stub().returns(
            Promise.resolve({
              body: {
                items: [
                  {id: 'calendar1', encryptedNotes: 'notes1', encryptedParticipants: ['participant1']},
                  {id: 'calendar2', encryptedNotes: 'notes2', encryptedParticipants: ['participant2']}
                ]
              }
            })
          );
          await webex.internal.calendar.syncCalendar({fromDate: 'xx-xx', toDate: 'xx-nn'});
          assert.calledWith(webex.request, {
            method: 'GET',
            service: 'calendar',
            resource: 'calendarEvents',
            qs: {fromDate: 'xx-xx', toDate: 'xx-nn'}
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
                  {id: 'calendar1', encryptedNotes: 'notes1', encryptedParticipants: ['participant1']},
                  {id: 'calendar2', encryptedNotes: 'notes2', encryptedParticipants: ['participant2']}
                ]
              }
            })
          );
          const res = await webex.internal.calendar.list({fromDate: 'xx-xx', toDate: 'xx-nn'});

          assert.equal(res.length, 2);
          assert.calledWith(webex.request, {
            method: 'GET',
            service: 'calendar',
            resource: 'calendarEvents',
            qs: {fromDate: 'xx-xx', toDate: 'xx-nn'}
          });
        });

        it('should fetch the calendar list and resolves with null encryptedNotes', async () => {
          const webexRequestStub = sinon.stub();

          // calendar list stub
          webexRequestStub.withArgs({
            method: 'GET',
            service: 'calendar',
            resource: 'calendarEvents',
            qs: {fromDate: 'xx-xx', toDate: 'xx-nn'}
          }).returns(
            Promise.resolve({
              body: {
                items: [
                  {id: 'calendar1', encryptedParticipants: ['participant1']},
                  {id: 'calendar2', encryptedNotes: 'notes2', encryptedParticipants: ['participant2']}
                ]
              }
            })
          );
          // getNotes stub
          webexRequestStub.withArgs({
            method: 'GET',
            service: 'calendar',
            resource: `calendarEvents/${btoa('calendar1')}/notes`
          }).returns(
            Promise.resolve({
              body: null
            })
          );

          // Assign webexRequestStub to webex.request
          webex.request = webexRequestStub;

          const res = await webex.internal.calendar.list({fromDate: 'xx-xx', toDate: 'xx-nn'});

          assert.equal(res.length, 2);
          assert.deepEqual(res, [
            {id: 'calendar1', encryptedNotes: null, encryptedParticipants: ['participant1']},
            {id: 'calendar2', encryptedNotes: 'notes2', encryptedParticipants: ['participant2']}
          ]);
          assert.calledWith(webex.request, {
            method: 'GET',
            service: 'calendar',
            resource: 'calendarEvents',
            qs: {fromDate: 'xx-xx', toDate: 'xx-nn'}
          });
          assert.calledWith(webex.request, {
            method: 'GET',
            service: 'calendar',
            resource: `calendarEvents/${btoa('calendar1')}/notes`
          });
        });

        it('should fetch the calendar list and resolves with fetched encryptedNotes', async () => {
          const webexRequestStub = sinon.stub();

          // calendar list stub
          webexRequestStub.withArgs({
            method: 'GET',
            service: 'calendar',
            resource: 'calendarEvents',
            qs: {fromDate: 'xx-xx', toDate: 'xx-nn'}
          }).returns(
            Promise.resolve({
              body: {
                items: [
                  {id: 'calendar1', encryptedParticipants: ['participant1']},
                  {id: 'calendar2', encryptedNotes: 'notes2', encryptedParticipants: ['participant2']}
                ]
              }
            })
          );
          // getNotes stub
          webexRequestStub.withArgs({
            method: 'GET',
            service: 'calendar',
            resource: `calendarEvents/${btoa('calendar1')}/notes`
          }).returns(
            Promise.resolve({
              body: {
                encryptedNotes: 'notes1'
              }
            })
          );

          // Assign webexRequestStub to webex.request
          webex.request = webexRequestStub;

          const res = await webex.internal.calendar.list({fromDate: 'xx-xx', toDate: 'xx-nn'});

          assert.equal(res.length, 2);
          assert.deepEqual(res, [
            {id: 'calendar1', encryptedNotes: 'notes1', encryptedParticipants: ['participant1']},
            {id: 'calendar2', encryptedNotes: 'notes2', encryptedParticipants: ['participant2']}
          ]);
          assert.calledWith(webex.request, {
            method: 'GET',
            service: 'calendar',
            resource: 'calendarEvents',
            qs: {fromDate: 'xx-xx', toDate: 'xx-nn'}
          });
          assert.calledWith(webex.request, {
            method: 'GET',
            service: 'calendar',
            resource: `calendarEvents/${btoa('calendar1')}/notes`
          });
        });
      });

      describe('#getNotes()', () => {
        it('should fetch the meeting notes', async () => {
          const id = 'meetingId123';

          webex.request = sinon.stub().returns(
            Promise.resolve({
              body: {
                encryptedNotes: 'notes1'
              }
            })
          );

          const res = await webex.internal.calendar.getNotes(id);

          assert.equal(res.body.encryptedNotes, 'notes1');
          assert.calledWith(webex.request, {
            method: 'GET',
            service: 'calendar',
            resource: `calendarEvents/${btoa(id)}/notes`
          });
        });
      });

      describe('#getParticipants()', () => {
        const id = 'meetingId123';

        it('should fetch the meeting participants', async () => {
          webex.request = sinon.stub().returns(
            Promise.resolve({
              body: {
                encryptedParticipants: ['participant1']
              }
            })
          );

          const res = await webex.internal.calendar.getParticipants(id);

          assert.equal(res.body.encryptedParticipants.length, 1);
          assert.calledWith(webex.request, {
            method: 'GET',
            service: 'calendar',
            resource: `calendarEvents/${btoa(id)}/participants`
          });
        });
      });
    });
  });
});
