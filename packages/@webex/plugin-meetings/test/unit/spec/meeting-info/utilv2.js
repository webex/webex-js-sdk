/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert, expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {DESTINATION_TYPE} from '@webex/plugin-meetings/src/constants';
import MeetingInfoUtil from '@webex/plugin-meetings/src/meeting-info/utilv2';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import LoggerConfig from '@webex/plugin-meetings/src/common/logs/logger-config';

describe('plugin-meetings', () => {
  const logger = {
    log: () => {},
    error: () => {},
    warn: () => {},
    trace: () => {},
    debug: () => {},
  };

  beforeEach(() => {
    LoggerConfig.set({verboseEvents: true, enable: false});
    LoggerProxy.set(logger);
  });

  describe('Meeting Info Utils V2', () => {
    beforeEach(() => {
      MeetingInfoUtil.getHydraId = sinon.stub().returns(false);
    });

    describe('#getDestinationType', () => {
      it('For destination with type', async () => {
        const res = await MeetingInfoUtil.getDestinationType({
          type: DESTINATION_TYPE.MEETING_ID,
          destination: '1234323',
        });

        assert.equal(res.type, DESTINATION_TYPE.MEETING_ID);
        assert.equal(res.destination, '1234323');
      });

      it('for meeting link', async () => {
        const res = await MeetingInfoUtil.getDestinationType({
          destination: 'https://cisco.webex.com/meet/arungane',
        });

        assert.equal(res.type, DESTINATION_TYPE.MEETING_LINK);
        assert.equal(res.destination, 'https://cisco.webex.com/meet/arungane');
      });

      it('for sip url', async () => {
        const res = await MeetingInfoUtil.getDestinationType({
          destination: 'testing@webex.com',
        });

        assert.equal(res.type, DESTINATION_TYPE.SIP_URI);
        assert.equal(res.destination, 'testing@webex.com');
      });

      it('for phone number', async () => {
        const res = await MeetingInfoUtil.getDestinationType({
          destination: '+14252086070',
        });

        assert.equal(res.type, DESTINATION_TYPE.SIP_URI);
        assert.equal(res.destination, '+14252086070');
      });

      it('for conversation url ', async () => {
        MeetingInfoUtil.isConversationUrl = sinon.stub().returns(true);
        const res = await MeetingInfoUtil.getDestinationType({
          destination: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/bfb49280',
        });

        assert.equal(res.type, DESTINATION_TYPE.CONVERSATION_URL);
        assert.equal(
          res.destination,
          'https://conv-a.wbx2.com/conversation/api/v1/conversations/bfb49280'
        );
      });

      describe('PMR', () => {
        const mockedListReturn = {
          userId: '01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e',
          orgId: '1eb65fdf-9643-417f-9974-ad72cae0e10f',
        };
        const mockedList = {
          items: [
            {
              id: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS8wMTgyNGI5Yi1hZGVmLTRiMTAtYjVjMS04YTJmZTJmYjdjMGU',
              orgId:
                'Y2lzY29zcGFyazovL3VzL09SR0FOSVpBVElPTi8xZWI2NWZkZi05NjQzLTQxN2YtOTk3NC1hZDcyY2FlMGUxMGY',
            },
          ],
        };

        it('should return a userID and orgID without passing a destination', async () => {
          const res = await MeetingInfoUtil.getDestinationType({
            type: DESTINATION_TYPE.PERSONAL_ROOM,
            webex: {
              internal: {
                device: {
                  userId: '01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e',
                  orgId: '1eb65fdf-9643-417f-9974-ad72cae0e10f',
                },
              },
            },
          });

          expect(res.destination.userId).to.equal('01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e');
          expect(res.destination.orgId).to.equal('1eb65fdf-9643-417f-9974-ad72cae0e10f');
        });

        it('should return a userID and orgID when passing an email', async () => {
          const res = await MeetingInfoUtil.getDestinationType({
            type: DESTINATION_TYPE.PERSONAL_ROOM,
            destination: 'amritesi@cisco.com',
            webex: {
              people: {list: sinon.stub().returns(mockedList)},
            },
          });
          const {orgId, userId} = res.destination;

          expect(userId).to.equal(mockedListReturn.userId);
          expect(orgId).to.equal(mockedListReturn.orgId);
        });

        it('should return a userID and orgID when passing an id', async () => {
          const res = await MeetingInfoUtil.getDestinationType({
            type: DESTINATION_TYPE.PERSONAL_ROOM,
            destination: '01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e',
            webex: {
              people: {list: sinon.stub().returns(mockedList)},
            },
          });
          const {orgId, userId} = res.destination;

          expect(userId).to.equal(mockedListReturn.userId);
          expect(orgId).to.equal(mockedListReturn.orgId);
        });
      });
    });

    describe('#getRequestBody', () => {

      it('for DESTINATION_TYPE.PERSONAL_ROOM', () => {
        const res = MeetingInfoUtil.getRequestBody({
          type: DESTINATION_TYPE.PERSONAL_ROOM,
          destination: {
            userId: '01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e',
            orgId: '1eb65fdf-9643-417f-9974-ad72cae0e10f',
          },
        });

        assert.equal(res.orgId, '1eb65fdf-9643-417f-9974-ad72cae0e10f');
        assert.equal(res.userId, '01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e');
      });

      it('for DESTINATION_TYPE.MEETING_ID', () => {
        const res = MeetingInfoUtil.getRequestBody({
          type: DESTINATION_TYPE.MEETING_ID,
          destination: '1234323',
        });

        assert.equal(res.meetingKey, '1234323');
      });

      it('for DESTINATION_TYPE.MEETING_LINK', () => {
        const res = MeetingInfoUtil.getRequestBody({
          type: DESTINATION_TYPE.MEETING_LINK,
          destination: 'https://cisco.webex.com/meet/arungane',
        });

        assert.equal(res.meetingUrl, 'https://cisco.webex.com/meet/arungane');
      });

      it('for DESTINATION_TYPE.SIP_URI', () => {
        const res = MeetingInfoUtil.getRequestBody({
          type: DESTINATION_TYPE.SIP_URI,
          destination: 'testing@webex.com',
        });

        assert.equal(res.sipUrl, 'testing@webex.com');
      });

      it('for DESTINATION_TYPE.MEETING_UUID', () => {
        const res = MeetingInfoUtil.getRequestBody({
          type: DESTINATION_TYPE.MEETING_UUID,
          destination: 'xsddsdsdsdssdsdsdsdsd',
        });

        assert.equal(res.meetingUUID, 'xsddsdsdsdssdsdsdsdsd');
      });

      it('for DESTINATION_TYPE.LOCUS_ID', () => {
        const res = MeetingInfoUtil.getRequestBody({
          type: DESTINATION_TYPE.LOCUS_ID,
          destination: {info: {webExMeetingId: '123456'}},
        });

        assert.equal(res.meetingKey, '123456');
      });

      it('for DESTINATION_TYPE.CONVERSATION_URL', () => {
        const res = MeetingInfoUtil.getRequestBody({
          type: DESTINATION_TYPE.CONVERSATION_URL,
          destination: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/bfb49280',
        });

        assert.equal(
          res.conversationUrl,
          'https://conv-a.wbx2.com/conversation/api/v1/conversations/bfb49280'
        );
      });

      it('allows for extra params to be provided', () => {
        const extraParams = {mtid: 'm9fe0afd8c435e892afcce9ea25b97046', joinTXId: 'TSmrX61wNF'}

        const res = MeetingInfoUtil.getRequestBody({
          type: DESTINATION_TYPE.CONVERSATION_URL,
          destination: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/bfb49281',
          extraParams,
        });

        assert.deepEqual(
          res,
          {
            conversationUrl: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/bfb49281',
            supportHostKey: true,
            supportCountryList: true,
            ...extraParams,
          }
        );
      });
    });

    describe('#getWebexSite', () => {
      it('SIP meeting address', () => {
        assert.equal(
          MeetingInfoUtil.getWebexSite('10019857020@convergedats.webex.com'),
          'convergedats.webex.com'
        );
      });
      it('SIP meeting address from excepted domain', () => {
        assert.equal(MeetingInfoUtil.getWebexSite('10019857020@meet.webex.com'), null);
      });
      it('SIP meeting address from excepted domain for IC', () => {
        assert.equal(MeetingInfoUtil.getWebexSite('10019857020@meet-intb.ciscospark.com'), null);
      });
      it('SIP meeting address from webex domain', () => {
        assert.equal(MeetingInfoUtil.getWebexSite('10019857020@webex.com'), null);
      });
      it('invalid domain', () => {
        assert.equal(MeetingInfoUtil.getWebexSite('invaliddomain'), null);
      });
    });

    describe('#getDirectMeetingInfoURI', () => {
      it('for DESTINATION_TYPE.SIP_URI', () => {
        assert.equal(
          MeetingInfoUtil.getDirectMeetingInfoURI({
            type: DESTINATION_TYPE.SIP_URI,
            destination: 'testing@convergedats.webex.com',
          }),
          'https://convergedats.webex.com/wbxappapi/v1/meetingInfo'
        );
      });

      it('for DESTINATION_TYPE.LOCUS_ID with webExSite', () => {
        assert.equal(
          MeetingInfoUtil.getDirectMeetingInfoURI({
            type: DESTINATION_TYPE.LOCUS_ID,
            destination: {
              info: {
                webExMeetingId: '123456',
                webExSite: 'convergedats.webex.com',
              },
            },
          }),
          'https://convergedats.webex.com/wbxappapi/v1/meetingInfo'
        );
      });

      // null means fall back to default meeting info URI
      it('for DESTINATION_TYPE.PERSONAL_ROOM', () => {
        assert.equal(
          MeetingInfoUtil.getDirectMeetingInfoURI({
            type: DESTINATION_TYPE.PERSONAL_ROOM,
            destination: {
              userId: '01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e',
              orgId: '1eb65fdf-9643-417f-9974-ad72cae0e10f',
            },
          }),
          null
        );
      });

      it('for DESTINATION_TYPE.MEETING_ID', () => {
        assert.equal(
          MeetingInfoUtil.getDirectMeetingInfoURI({
            type: DESTINATION_TYPE.MEETING_ID,
            destination: '1234323',
          }),
          null
        );
      });

      it('for DESTINATION_TYPE.MEETING_UUID', () => {
        assert.equal(
          MeetingInfoUtil.getDirectMeetingInfoURI({
            type: DESTINATION_TYPE.MEETING_UUID,
            destination: 'xsddsdsdsdssdsdsdsdsd',
          }),
          null
        );
      });

      it('for DESTINATION_TYPE.LOCUS_ID with sipUri with excepted domain', () => {
        assert.equal(
          MeetingInfoUtil.getDirectMeetingInfoURI({
            type: DESTINATION_TYPE.LOCUS_ID,
            destination: {info: {webExMeetingId: '123456', sipUri: 'testing@meetup.webex.com'}},
          }),
          null
        );
      });

      it('for DESTINATION_TYPE.CONVERSATION_URL', () => {
        assert.equal(
          MeetingInfoUtil.getDirectMeetingInfoURI({
            type: DESTINATION_TYPE.CONVERSATION_URL,
            destination: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/bfb49280',
          }),
          null
        );
      });

      it('for DESTINATION_TYPE.SIP_URI with an email address', () => {
        assert.equal(
          MeetingInfoUtil.getDirectMeetingInfoURI({
            type: DESTINATION_TYPE.SIP_URI,
            destination: 'testing@email.com',
          }),
          null
        );
      });
    });
  });
});
