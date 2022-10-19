/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import '@webex/internal-plugin-calendar';
import WebexCore from '@webex/webex-core';
import {assert} from '@webex/test-helper-chai';
import retry from '@webex/test-helper-retry';
import testUsers from '@webex/test-helper-test-users';
import uuid from 'uuid';


/**
 * produces a mock meeting object
 * @param {Object} params
 * @returns {Meeting}
 */
function makeMockMeetingPayload(params) {
  const payload = {
    id: params.meetingId,
    seriesId: params.seriesId,
    start: params.start,
    durationMinutes: params.durationMinutes,
    organizer: params.organizer.id,
    encryptionKeyUrl: '',
    encryptedSubject: params.title,
    isRecurring: params.isRecurring,
    links: [
      {
        href: `https://calendar-example.com/calendar/api/v1/${params.locusId}`,
        rel: 'self'
      }
    ],
    encryptedNotes: params.body,
    encryptedLocation: params.location,
    webexURI: params.webexURI,
    webexURL: params.webexURL,
    spaceMeetURL: params.spaceMeetURL,
    spaceURI: params.spaceURI,
    spaceURL: params.spaceURL,
    meetingJoinInfo: {
      meetingJoinURI: params.meetingJoinInfo.meetingJoinURI,
      meetingJoinURL: params.meetingJoinInfo.meetingJoinURI
    },
    encryptedParticipants: [
      {
        id: params.participants.participant1.id,
        type: 'PERSON',
        responseType: 'NO_RESPONSE',
        participantType: 'OPTIONAL',
        orgId: params.participants.participant1.orgId,
        encryptedEmailAddress: params.participants.participant1.emailAddress,
        encryptedName: params.participants.participant1.name
      },
      {
        id: params.participants.participant2.id,
        type: 'PERSON',
        responseType: 'UNKNOWN_RESPONSE',
        participantType: 'REQUIRED',
        orgId: params.participants.participant2.orgId,
        encryptedEmailAddress: params.participants.participant2.emailAddress,
        encryptedName: params.participants.participant2.name
      }
    ]
  };

  return payload;
}

/**
 * produces a mock notes object
 * @param {Object} params
 * @returns {Notes}
 */
function makeMockNotesPayload(params) {
  const payload = {
    id: params.meetingId,
    seriesId: params.seriesId,
    links: [
      {
        href: `https://calendar-example.com/calendar/api/v1/${params.locusId}`,
        rel: 'self'
      }
    ],
    encryptedNotes: params.meetingNotes
  };

  return payload;
}

/**
 * produces a mock participants object
 * @param {Object} params
 * @returns {Participants}
 */
function makeMockParticipantsPayload(params) {
  const payload = {
    id: params.meetingId,
    seriesId: params.seriesId,
    links: [
      {
        href: `https://calendar-example.com/calendar/api/v1/${params.locusId}`,
        rel: 'self'
      }
    ],
    encryptedParticipants: [
      {
        id: params.participants.participant1.id,
        type: 'PERSON',
        responseType: 'NO_RESPONSE',
        participantType: 'OPTIONAL',
        orgId: params.participants.participant1.orgId,
        encryptedEmailAddress: params.participants.participant1.emailAddress,
        encryptedName: params.participants.participant1.name
      },
      {
        id: params.participants.participant2.id,
        type: 'PERSON',
        responseType: 'UNKNOWN_RESPONSE',
        participantType: 'REQUIRED',
        orgId: params.participants.participant2.orgId,
        encryptedEmailAddress: params.participants.participant2.emailAddress,
        encryptedName: params.participants.participant2.name
      }
    ]
  };

  return payload;
}

function postToWhistler(webex, type, payload) {
  return retry(() => webex.request({
    method: 'POST',
    uri: `${process.env.WHISTLER_API_SERVICE_URL}/calendarEvent`,
    body: payload,
    qs: {
      changeType: type,
      useProduction: typeof process.env.WDM_SERVICE_URL === 'undefined' || process.env.WDM_SERVICE_URL.includes('wdm-a.wbx2.com')
    }
  })
    .then((res) => {
      // Test response is using our parameters
      const createdMeeting = res.body;

      assert.isDefined(createdMeeting);
      assert.equal(createdMeeting.meeting.itemId, payload.id);
      assert.equal(createdMeeting.userUUID, payload.organizer);
      assert.equal(createdMeeting.meeting.startDate, payload.start);
      assert.equal(createdMeeting.meeting.duration, payload.durationMinutes);

      return res;
    }));
}

function postNotesToWhistler(webex, type, payload) {
  return retry(() => webex.request({
    method: 'POST',
    uri: `${process.env.WHISTLER_API_SERVICE_URL}/calendarEvent`,
    body: payload,
    qs: {
      changeType: type,
      useProduction: typeof process.env.WDM_SERVICE_URL === 'undefined' || process.env.WDM_SERVICE_URL.includes('wdm-a.wbx2.com')
    }
  })
    .then((res) => res.body));
}

function postParticipantsToWhistler(webex, type, payload) {
  return retry(() => webex.request({
    method: 'POST',
    uri: `${process.env.WHISTLER_API_SERVICE_URL}/calendarEvent`,
    body: payload,
    qs: {
      changeType: type,
      useProduction: typeof process.env.WDM_SERVICE_URL === 'undefined' || process.env.WDM_SERVICE_URL.includes('wdm-a.wbx2.com')
    }
  })
    .then((res) => res.body));
}

describe.skip('plugin-calendar', () => {
  describe('Calendar', () => {
    describe('#list()', function () {
      this.timeout(retry.timeout(20000));
      let creator, mccoy, webex, spock;

      before('create test users', () => testUsers.create({
        count: 3,
        config: {
          entitlements: [
            'sparkCompliance',
            'sparkAdmin',
            'spark',
            'squaredCallInitiation',
            'squaredRoomModeration',
            'squaredInviter',
            'webExSquared',
            'squaredFusionCal'
          ]
        }
      })
        .then((users) => {
          [creator, spock, mccoy] = users;

          webex = new WebexCore({
            credentials: {
              authorization: creator.token
            },
            config: {
              device: {
                preDiscoveryServices: {
                  whistlerServiceUrl: process.env.WHISTLER_API_SERVICE_URL || 'https://calendar-whistler.allnint.ciscospark.com:8084/api/v1'
                }
              }
            }
          });
        }));

      before('register to wdm, set features, and connect to mercury', () => webex.internal.device.register()
        .then(() => webex.internal.feature.setFeature('developer', 'calsvc_calendar_view', true))
        .then(() => webex.internal.mercury.connect()));

      after(() => webex && webex.internal.mercury.disconnect());

      it('retrieves the meeting list for the default date range', () => {
        const hour = 1000 * 60 * 60;
        const startInterval = new Date(new Date().getTime() + hour * 2).toISOString();
        const duration = 60;
        const meetingID = uuid.v4();
        const locusID = uuid.v4();
        const seriesID = uuid.v4();

        const meetingParams = {

          meetingId: meetingID,
          seriesId: seriesID,
          start: startInterval,
          durationMinutes: duration,
          title: `test-plugin-calendar-meeting-${meetingID}`,
          locusId: locusID,
          hasAttachments: false,
          isRecurring: false,
          organizer: creator,
          participants: {
            participant1: mccoy,
            participant2: spock
          },
          location: '@webex',
          body: 'Test Agenda'
        };

        return postToWhistler(webex, 'CREATE', makeMockMeetingPayload(meetingParams))
          .then((res) => {
            const createdMeeting = res.body;

            return webex.internal.calendar.list()
              .then((meetings) => {
                const testMeeting = meetings.find((meeting) => meeting.seriesId === createdMeeting.meeting.meetingSeriesId);

                assert.isDefined(testMeeting);
                assert.equal(createdMeeting.meeting.meetingSeriesId, testMeeting.seriesId);
                assert.equal(createdMeeting.userUUID, testMeeting.organizer);
                assert.equal(createdMeeting.meeting.startDate, testMeeting.start);
                assert.equal(Math.round((new Date(createdMeeting.meeting.endDate).getTime() - new Date(createdMeeting.meeting.startDate).getTime()) / 60000), testMeeting.durationMinutes);

                // Validate decryption of subject, location and agenda
                assert.isDefined(testMeeting.encryptedSubject);
                assert.equal(meetingParams.title, testMeeting.encryptedSubject);
                assert.isDefined(testMeeting.encryptedLocation);
                assert.equal(meetingParams.location, testMeeting.encryptedLocation);
                assert.isDefined(testMeeting.encryptedNotes);
                assert.equal(meetingParams.body, testMeeting.encryptedNotes);
                assert.isDefined(testMeeting.webexURI);
                assert.equal(meetingParams.location, testMeeting.webexURI);
                assert.isDefined(testMeeting.webexURL);
                assert.equal(meetingParams.location, testMeeting.webexURL);
                assert.isDefined(testMeeting.spaceMeetURL);
                assert.equal(meetingParams.location, testMeeting.spaceMeetURL);
                assert.isDefined(testMeeting.spaceURI);
                assert.equal(meetingParams.location, testMeeting.spaceURI);
                assert.isDefined(testMeeting.spaceURL);
                assert.equal(meetingParams.location, testMeeting.spaceURL);
                assert.isDefined(testMeeting.encryptedParticipants);
                const encryptedParticipant1 = testMeeting.encryptedParticipants
                  .find((participant) => participant.id === meetingParams.participants.participant1.id);
                const encryptedParticipant2 = testMeeting.encryptedParticipants
                  .find((participant) => participant.id === meetingParams.participants.participant2.id);

                assert.equal(meetingParams.participants.participant1.emailAddress, encryptedParticipant1.encryptedEmailAddress);
                assert.equal(meetingParams.participants.participant1.name, encryptedParticipant1.encryptedName);
                assert.equal(meetingParams.participants.participant2.emailAddress, encryptedParticipant2.encryptedEmailAddress);
                assert.equal(meetingParams.participants.participant2.name, encryptedParticipant2.encryptedName);
              });
          });
      });

      it('receives a mercury event for a new meeting', () => {
        const hour = 1000 * 60 * 60;
        const startInterval = new Date(new Date().getTime() + hour * 2).toISOString();
        const duration = 60;
        const meetingID = uuid.v4();
        const locusID = uuid.v4();
        const seriesID = uuid.v4();

        const meetingParams = {

          meetingId: meetingID,
          seriesId: seriesID,
          start: startInterval,
          durationMinutes: duration,
          title: `test-plugin-calendar-meeting-${meetingID}`,
          locusId: locusID,
          hasAttachments: false,
          isRecurring: false,
          organizer: creator,
          participants: {
            participant1: mccoy,
            participant2: spock
          },
          location: '@webex',
          body: 'Test Agenda'
        };

        const mercuryPromise = new Promise((resolve) => {
          webex.internal.mercury.on('event:calendar.meeting.create', (event) => {
            resolve(event.data.calendarMeetingExternal);
          });
        });

        return postToWhistler(webex, 'CREATE', makeMockMeetingPayload(meetingParams))
          .then((res) => {
            const createdMeeting = res.body;

            return mercuryPromise
              .then((calendarMeetingExternal) => {
                assert.equal(createdMeeting.meeting.meetingSeriesId, calendarMeetingExternal.seriesId);
                assert.equal(createdMeeting.userUUID, calendarMeetingExternal.organizer);
                assert.equal(createdMeeting.meeting.startDate, calendarMeetingExternal.start);
                assert.equal(Math.round((new Date(createdMeeting.meeting.endDate).getTime() - new Date(createdMeeting.meeting.startDate).getTime()) / 60000), calendarMeetingExternal.durationMinutes);

                // Validate decryption of subject, location and agenda
                assert.isDefined(calendarMeetingExternal.encryptedSubject);
                assert.equal(meetingParams.title, calendarMeetingExternal.encryptedSubject);
                assert.isDefined(calendarMeetingExternal.encryptedLocation);
                assert.equal(meetingParams.location, calendarMeetingExternal.encryptedLocation);
                assert.isDefined(calendarMeetingExternal.encryptedNotes);
                assert.equal(meetingParams.body, calendarMeetingExternal.encryptedNotes);
                assert.isDefined(calendarMeetingExternal.webexURI);
                assert.equal(meetingParams.body, calendarMeetingExternal.webexURI);
                assert.isDefined(calendarMeetingExternal.webexURL);
                assert.equal(meetingParams.body, calendarMeetingExternal.webexURL);
                assert.isDefined(calendarMeetingExternal.spaceMeetURL);
                assert.equal(meetingParams.body, calendarMeetingExternal.spaceMeetURL);
                assert.isDefined(calendarMeetingExternal.spaceURI);
                assert.equal(meetingParams.body, calendarMeetingExternal.spaceURI);
                assert.isDefined(calendarMeetingExternal.spaceURL);
                assert.equal(meetingParams.body, calendarMeetingExternal.spaceURL);
                assert.isDefined(calendarMeetingExternal.meetingJoinInfo.meetingJoinURI);
                assert.equal(meetingParams.body, calendarMeetingExternal.meetingJoinInfo.meetingJoinURI);
                assert.isDefined(calendarMeetingExternal.meetingJoinInfo.meetingJoinURL);
                assert.equal(meetingParams.body, calendarMeetingExternal.meetingJoinInfo.meetingJoinURL);
                assert.isDefined(calendarMeetingExternal.encryptedParticipants);
                const encryptedParticipant1 = calendarMeetingExternal.encryptedParticipants
                  .find((participant) => participant.id === meetingParams.participants.participant1.id);
                const encryptedParticipant2 = calendarMeetingExternal.encryptedParticipants
                  .find((participant) => participant.id === meetingParams.participants.participant2.id);

                assert.equal(meetingParams.participants.participant1.emailAddress, encryptedParticipant1.encryptedEmailAddress);
                assert.equal(meetingParams.participants.participant1.name, encryptedParticipant1.encryptedName);
                assert.equal(meetingParams.participants.participant2.emailAddress, encryptedParticipant2.encryptedEmailAddress);
                assert.equal(meetingParams.participants.participant2.name, encryptedParticipant2.encryptedName);
              });
          });
      });
    });

    describe('#getNotes()', () => {
      let creator, webex;

      before('create test users', () => testUsers.create({
        count: 3,
        config: {
          entitlements: [
            'sparkCompliance',
            'sparkAdmin',
            'spark',
            'squaredCallInitiation',
            'squaredRoomModeration',
            'squaredInviter',
            'webExSquared',
            'squaredFusionCal'
          ]
        }
      })
        .then((users) => {
          [creator] = users;

          webex = new WebexCore({
            credentials: {
              authorization: creator.token
            },
            config: {
              services: {
                discovery: {
                  whistlerServiceUrl: process.env.WHISTLER_API_SERVICE_URL || 'https://calendar-whistler.allnint.ciscospark.com:8084/api/v1'
                }
              }
            }
          });
        }));

      before('register to wdm, set features, and connect to mercury', () => webex.internal.device.register()
        .then(() => webex.internal.feature.setFeature('developer', 'calsvc_calendar_view', true))
        .then(() => webex.internal.mercury.connect()));

      after(() => webex && webex.internal.mercury.disconnect());

      it('retrieves the meeting notes for the given meetingId', () => {
        const meetingNotes = 'Dummy meeting notes';
        const meetingID = uuid.v4();
        const locusID = uuid.v4();
        const seriesID = uuid.v4();

        const meetingParams = {
          meetingId: meetingID,
          seriesId: seriesID,
          locusId: locusID,
          meetingNotes
        };

        return postNotesToWhistler(webex, 'CREATE', makeMockNotesPayload(meetingParams))
          .then((createdMeeting) => webex.internal.calendar.getNotes(meetingID)
            .then((response) => {
              assert.equal(createdMeeting.meeting.meetingSeriesId, response.seriesId);
              assert.equal(meetingParams.meetingNotes, response.encryptedNotes);
            }));
      });
    });

    describe('#getParticipants()', () => {
      let creator, mccoy, webex, spock;

      before('create test users', () => testUsers.create({
        count: 3,
        config: {
          entitlements: [
            'sparkCompliance',
            'sparkAdmin',
            'spark',
            'squaredCallInitiation',
            'squaredRoomModeration',
            'squaredInviter',
            'webExSquared',
            'squaredFusionCal'
          ]
        }
      })
        .then((users) => {
          [creator, spock, mccoy] = users;

          webex = new WebexCore({
            credentials: {
              authorization: creator.token
            },
            config: {
              services: {
                discovery: {
                  whistlerServiceUrl: process.env.WHISTLER_API_SERVICE_URL || 'https://calendar-whistler.allnint.ciscospark.com:8084/api/v1'
                }
              }
            }
          });
        }));

      before('register to wdm, set features, and connect to mercury', () => webex.internal.device.register()
        .then(() => webex.internal.feature.setFeature('developer', 'calsvc_calendar_view', true))
        .then(() => webex.internal.mercury.connect()));

      after(() => webex && webex.internal.mercury.disconnect());

      it('retrieves the meeting participants for the given meetingId', () => {
        const meetingID = uuid.v4();
        const locusID = uuid.v4();
        const seriesID = uuid.v4();

        const meetingParams = {
          meetingId: meetingID,
          seriesId: seriesID,
          locusId: locusID,
          participants: {
            participant1: mccoy,
            participant2: spock
          }
        };

        return postParticipantsToWhistler(webex, 'CREATE', makeMockParticipantsPayload(meetingParams))
          .then((createdMeeting) => webex.internal.calendar.getParticipants(meetingID)
            .then((response) => {
              assert.equal(createdMeeting.meeting.meetingSeriesId, response.seriesId);

              const encryptedParticipant1 = response.encryptedParticipants
                .find((participant) => participant.id === meetingParams.participants.participant1.id);
              const encryptedParticipant2 = response.encryptedParticipants
                .find((participant) => participant.id === meetingParams.participants.participant2.id);

              assert.equal(meetingParams.participants.participant1.emailAddress, encryptedParticipant1.encryptedEmailAddress);
              assert.equal(meetingParams.participants.participant1.name, encryptedParticipant1.encryptedName);
              assert.equal(meetingParams.participants.participant2.emailAddress, encryptedParticipant2.encryptedEmailAddress);
              assert.equal(meetingParams.participants.participant2.name, encryptedParticipant2.encryptedName);
            }));
      });
    });
  });
});
