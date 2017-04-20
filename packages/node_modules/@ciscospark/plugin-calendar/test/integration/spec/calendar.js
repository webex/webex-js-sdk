/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

 /* eslint camelcase: [0] */

import '../..';
import CiscoSpark from '@ciscospark/spark-core';
import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import uuid from 'uuid';
import {merge} from 'lodash';


/**
 * produces a mock meeting object
 * @param {Object} params
 * @returns {Meeting}
 */
function makeMockMeeting(params) {
  params = params || {};
  return merge({
    changeType: params.changeType,
    userId: params.organizer.emailAddress,
    userUUID: params.organizer.id,
    emailAddress: params.organizer.emailAddress,
    itemId: `ItemId-${params.meetingId}`,
    meeting: {
      body: params.body,
      callUri: `https://locus-example.com/locus/api/v1/loci/${params.locusId}`,
      encryptionV2: true,
      endDate: params.end,
      featureTogglesMap: [
        {
          calsvc_calendar_view: true
        }
      ],
      hasAttachments: params.hasAttachments,
      iCalUid: params.meetingId,
      isRecurring: params.isRecurring,
      isReminderSet: params.isReminderSet,
      itemId: `ItemId-${params.meetingId}`,
      location: params.location,
      mailboxAttendeesInMeeting: [
        params.participants.participant1.emailAddress,
        params.participants.participant2.emailAddress
      ],
      mailboxInviteesInMeeting: [
        {
          id: params.participants.participant1.id,
          invitee: params.participants.participant1.emailAddress,
          type: `PERSON`,
          responseType: `NO_RESPONSE`,
          participantType: `OPTIONAL`
        },
        {
          id: params.participants.participant2.id,
          invitee: params.participants.participant2.emailAddress,
          type: `PERSON`,
          responseType: `UNKNOWN_RESPONSE`,
          participantType: `REQUIRED`
        }
      ],
      meetingIdentifier: {
        id: `MeetingId-${params.meetingId}`
      },
      meetingTime: params.start,
      organizer: params.organizer.emailAddress,
      startDate: params.start,
      subject: params.title
    },
    meetingIdentifier: {
      id: `MeetingId-${params.meetingId}`
    }
  }, params);
}

describe(`plugin-calendar`, () => {
  describe(`#list()`, () => {
    let createdMeeting, creator, mccoy, meetingParams, spark, spock;

    before(`create test users`, () => testUsers.create({
      count: 3,
      config: {
        entitlements: [
          `spark`,
          `squaredCallInitiation`,
          `squaredInviter`,
          `squaredRoomModeration`,
          `webExSquared`,
          `squaredFusionCal`
        ]
      }
    })
      .then((users) => {
        [creator, spock, mccoy] = users;

        spark = new CiscoSpark({
          credentials: {
            authorization: creator.token
          },
          config: {
            device: {
              preDiscoveryServices: {
                whistlerServiceUrl: process.env.WHISTLER_API_SERVICE_URL || `http://internal-testing-services.wbx2.com:8084/api/v1`
              }
            }
          }
        });
      }));

    const hour = 1000 * 60 * 60;
    const startInterval = new Date(new Date().getTime() + hour * 2).toISOString();
    const endInterval = new Date(new Date(startInterval).getTime() + hour).toISOString();
    const meetingID = uuid.v4();
    const locusID = uuid.v4();

    before(`creates a meeting`, () => {
      meetingParams = {
        changeType: `CREATE`,
        meetingId: meetingID,
        start: startInterval,
        end: endInterval,
        title: `test-plugin-calendar-meeting-${meetingID}`,
        locusId: locusID,
        hasAttachments: false,
        isRecurring: false,
        isReminderSet: false,
        organizer: creator,
        participants: {
          participant1: mccoy,
          participant2: spock
        },
        location: `@spark`,
        body: `Test Agenda`
      };

      return spark.request({
        method: `POST`,
        service: `whistler`,
        resource: `calendarNotification`,
        body: makeMockMeeting(meetingParams),
        qs: {
          isinteg: false
        }
      })
        .then((res) => {
          createdMeeting = res.body;
          assert.isDefined(createdMeeting);
          assert.equal(createdMeeting.meeting.meetingIdentifier.id, `MeetingId-${meetingID}`);
          assert.equal(createdMeeting.userUUID, meetingParams.organizer.id);
          assert.equal(createdMeeting.meeting.startDate, meetingParams.start);
          assert.equal(createdMeeting.meeting.endDate, meetingParams.end);
        });
    });

    beforeEach(`registers to wdm`, () => spark.device.register());

    it(`retrieves the meeting list for default date range`, () => spark.calendar.list()
      .then((meetings) => {
        assert.equal(createdMeeting.meeting.icalUid, meetings[0].seriesId);
        assert.equal(createdMeeting.userUUID, meetings[0].organizer);
        assert.equal(createdMeeting.meeting.startDate, meetings[0].start);
        assert.equal(Math.round((new Date(createdMeeting.meeting.endDate).getTime() - new Date(createdMeeting.meeting.startDate).getTime()) / 60000), meetings[0].durationMinutes);

        // Validate decryption of subject, location and agenda
        assert.isDefined(meetings[0].encryptedSubject);
        assert.equal(meetingParams.title, meetings[0].encryptedSubject);
        assert.isDefined(meetings[0].encryptedLocation);
        assert.equal(meetingParams.location, meetings[0].encryptedLocation);
        assert.isDefined(meetings[0].encryptedNotes);
        assert.equal(meetingParams.body, meetings[0].encryptedNotes);

      }));
  });
});
