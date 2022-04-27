/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert, expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {
  _MEETING_ID_,
  _SIP_URI_,
  _CONVERSATION_URL_,
  _MEETING_LINK_,
  _PERSONAL_ROOM_,
  _LOCUS_ID_,
  _MEETING_UUID_
} from '@webex/plugin-meetings/src/constants';
import MeetingInfoUtil from '@webex/plugin-meetings/src/meeting-info/utilv2';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import LoggerConfig from '@webex/plugin-meetings/src/common/logs/logger-config';

describe('plugin-meetings', () => {
  const logger = {
    log: () => {},
    error: () => {},
    warn: () => {},
    trace: () => {},
    debug: () => {}
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
          type: _MEETING_ID_,
          destination: '1234323'
        });

        assert.equal(res.type, _MEETING_ID_);
        assert.equal(res.destination, '1234323');
      });

      it('for meeting link', async () => {
        const res = await MeetingInfoUtil.getDestinationType({
          destination: 'https://cisco.webex.com/meet/arungane'
        });

        assert.equal(res.type, _MEETING_LINK_);
        assert.equal(res.destination, 'https://cisco.webex.com/meet/arungane');
      });

      it('for sip url', async () => {
        const res = await MeetingInfoUtil.getDestinationType({
          destination: 'testing@webex.com'
        });

        assert.equal(res.type, _SIP_URI_);
        assert.equal(res.destination, 'testing@webex.com');
      });

      it('for phone number', async () => {
        const res = await MeetingInfoUtil.getDestinationType({
          destination: '+14252086070'
        });

        assert.equal(res.type, _SIP_URI_);
        assert.equal(res.destination, '+14252086070');
      });

      it('for conversation url ', async () => {
        MeetingInfoUtil.isConversationUrl = sinon.stub().returns(true);
        const res = await MeetingInfoUtil.getDestinationType({
          destination: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/bfb49280'
        });

        assert.equal(res.type, _CONVERSATION_URL_);
        assert.equal(res.destination, 'https://conv-a.wbx2.com/conversation/api/v1/conversations/bfb49280');
      });

      describe('PMR', () => {
        const mockedListReturn = {userId: '01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e', orgId: '1eb65fdf-9643-417f-9974-ad72cae0e10f'};
        const mockedList = {
          items: [{
            id: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS8wMTgyNGI5Yi1hZGVmLTRiMTAtYjVjMS04YTJmZTJmYjdjMGU',
            orgId: 'Y2lzY29zcGFyazovL3VzL09SR0FOSVpBVElPTi8xZWI2NWZkZi05NjQzLTQxN2YtOTk3NC1hZDcyY2FlMGUxMGY'
          }]

        };

        it('should return a userID and orgID without passing a destination', async () => {
          const res = await MeetingInfoUtil.getDestinationType({
            type: _PERSONAL_ROOM_,
            webex: {
              internal: {
                device: {
                  userId: '01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e',
                  orgId: '1eb65fdf-9643-417f-9974-ad72cae0e10f'
                }
              }
            }
          });

          expect(res.destination.userId).to.equal('01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e');
          expect(res.destination.orgId).to.equal('1eb65fdf-9643-417f-9974-ad72cae0e10f');
        });

        it('should return a userID and orgID when passing an email', async () => {
          const res = await MeetingInfoUtil.getDestinationType({
            type: _PERSONAL_ROOM_,
            destination: 'amritesi@cisco.com',
            webex: {
              people: {list: sinon.stub().returns(mockedList)}

            }
          });
          const {orgId, userId} = res.destination;

          expect(userId).to.equal(mockedListReturn.userId);
          expect(orgId).to.equal(mockedListReturn.orgId);
        });

        it('should return a userID and orgID when passing an id', async () => {
          const res = await MeetingInfoUtil.getDestinationType({
            type: _PERSONAL_ROOM_,
            destination: '01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e',
            webex: {
              people: {list: sinon.stub().returns(mockedList)}
            }

          });
          const {orgId, userId} = res.destination;

          expect(userId).to.equal(mockedListReturn.userId);
          expect(orgId).to.equal(mockedListReturn.orgId);
        });
      });
    });

    describe('#getRequestBody', () => {
      it('for _PERSONAL_ROOM_', () => {
        const res = MeetingInfoUtil.getRequestBody({
          type: _PERSONAL_ROOM_,
          destination: {
            userId: '01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e',
            orgId: '1eb65fdf-9643-417f-9974-ad72cae0e10f'
          }
        });

        assert.equal(res.orgId, '1eb65fdf-9643-417f-9974-ad72cae0e10f');
        assert.equal(res.userId, '01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e');
      });

      it('for _MEETING_ID_', () => {
        const res = MeetingInfoUtil.getRequestBody({
          type: _MEETING_ID_,
          destination: '1234323'
        });

        assert.equal(res.meetingKey, '1234323');
      });

      it('for _MEETING_LINK_', () => {
        const res = MeetingInfoUtil.getRequestBody({
          type: _MEETING_LINK_,
          destination: 'https://cisco.webex.com/meet/arungane'
        });

        assert.equal(res.meetingUrl, 'https://cisco.webex.com/meet/arungane');
      });

      it('for _SIP_URI_', () => {
        const res = MeetingInfoUtil.getRequestBody({
          type: _SIP_URI_,
          destination: 'testing@webex.com'
        });

        assert.equal(res.sipUrl, 'testing@webex.com');
      });

      it('for _MEETING_UUID_', () => {
        const res = MeetingInfoUtil.getRequestBody({
          type: _MEETING_UUID_,
          destination: 'xsddsdsdsdssdsdsdsdsd'
        });

        assert.equal(res.meetingUUID, 'xsddsdsdsdssdsdsdsdsd');
      });

      it('for _LOCUS_ID_', () => {
        const res = MeetingInfoUtil.getRequestBody({
          type: _LOCUS_ID_,
          destination: {info: {webExMeetingId: '123456'}}
        });

        assert.equal(res.meetingKey, '123456');
      });

      it('for _CONVERSATION_URL_', () => {
        const res = MeetingInfoUtil.getRequestBody({
          type: _CONVERSATION_URL_,
          destination: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/bfb49280'
        });

        assert.equal(res.conversationUrl, 'https://conv-a.wbx2.com/conversation/api/v1/conversations/bfb49280');
      });
    });

    describe('#getWebexSite', () => {
      it('SIP meeting address', () => {
        assert.equal(MeetingInfoUtil.getWebexSite('10019857020@convergedats.webex.com'), 'convergedats.webex.com');
      });
      it('SIP meeting address from excepted domain', () => {
        assert.equal(MeetingInfoUtil.getWebexSite('10019857020@meet.webex.com'), null);
      });
      it('invalid domain', () => {
        assert.equal(MeetingInfoUtil.getWebexSite('invaliddomain'), null);
      });
    });

    describe('#getDirectMeetingInfoURI', () => {
      it('for _SIP_URI_', () => {
        assert.equal(MeetingInfoUtil.getDirectMeetingInfoURI({
          type: _SIP_URI_,
          destination: 'testing@convergedats.webex.com'
        }), 'https://convergedats.webex.com/wbxappapi/v1/meetingInfo');
      });

      it('for _LOCUS_ID_ with webExSite', () => {
        assert.equal(MeetingInfoUtil.getDirectMeetingInfoURI({
          type: _LOCUS_ID_,
          destination: {
            info: {
              webExMeetingId: '123456',
              webExSite: 'convergedats.webex.com'
            }
          }
        }), 'https://convergedats.webex.com/wbxappapi/v1/meetingInfo');
      });

      // null means fall back to default meeting info URI
      it('for _PERSONAL_ROOM_', () => {
        assert.equal(MeetingInfoUtil.getDirectMeetingInfoURI({
          type: _PERSONAL_ROOM_,
          destination: {
            userId: '01824b9b-adef-4b10-b5c1-8a2fe2fb7c0e',
            orgId: '1eb65fdf-9643-417f-9974-ad72cae0e10f'
          }
        }), null);
      });

      it('for _MEETING_ID_', () => {
        assert.equal(MeetingInfoUtil.getDirectMeetingInfoURI({
          type: _MEETING_ID_,
          destination: '1234323'
        }), null);
      });

      it('for _MEETING_UUID_', () => {
        assert.equal(MeetingInfoUtil.getDirectMeetingInfoURI({
          type: _MEETING_UUID_,
          destination: 'xsddsdsdsdssdsdsdsdsd'
        }), null);
      });

      it('for _LOCUS_ID_ with sipUri with excepted domain', () => {
        assert.equal(MeetingInfoUtil.getDirectMeetingInfoURI({
          type: _LOCUS_ID_,
          destination: {info: {webExMeetingId: '123456', sipUri: 'testing@meetup.webex.com'}}
        }), null);
      });

      it('for _CONVERSATION_URL_', () => {
        assert.equal(MeetingInfoUtil.getDirectMeetingInfoURI({
          type: _CONVERSATION_URL_,
          destination: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/bfb49280'
        }), null);
      });

      it('for _SIP_URI_ with an email address', () => {
        assert.equal(MeetingInfoUtil.getDirectMeetingInfoURI({
          type: _SIP_URI_,
          destination: 'testing@email.com'
        }), null);
      });
    });
  });
});
