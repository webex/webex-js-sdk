import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';

import Meetings from '@webex/plugin-meetings';
import MeetingRequest from '@webex/plugin-meetings/src/meeting/request';

describe('plugin-meetings', () => {
  let meetingsRequest;

  beforeEach(() => {
    const webex = new MockWebex({
      children: {
        meetings: Meetings
      }
    });

    webex.meetings.clientRegion = {
      countryCode: 'US',
      regionCode: 'WEST-COAST'
    };

    webex.internal = {
      services: {
        get: sinon.mock().returns('locusUrl'),
        waitForCatalog: sinon.mock().returns(Promise.resolve({}))
      }
    };

    meetingsRequest = new MeetingRequest({}, {
      parent: webex
    });


    meetingsRequest.request = sinon.mock().returns(Promise.resolve({}));
  });

  describe('meeting request library', () => {
    describe('#sendDTMF', () => {
      it('sends a POST to the sendDtmf locus endpoint', async () => {
        const locusUrl = 'locusURL';
        const deviceUrl = 'deviceUrl';
        const tones = '1234';

        await meetingsRequest.sendDTMF({
          locusUrl,
          deviceUrl,
          tones
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'POST');
        assert.equal(requestParams.uri, `${locusUrl}/sendDtmf`);
        assert.equal(requestParams.body.dtmf.tones, tones);
        assert.equal(requestParams.body.deviceUrl, deviceUrl);
      });
    });

    describe('#changeVideoLayout', () => {
      const locusUrl = 'locusURL';
      const deviceUrl = 'deviceUrl';
      const layoutType = 'Equal';

      it('sends a PUT request to the controls endpoint', async () => {
        await meetingsRequest.changeVideoLayout({
          locusUrl,
          deviceUrl,
          layoutType,
          main: {width: 640, height: 480},
          content: {width: 1280, height: 720}
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'PUT');
        assert.equal(requestParams.uri, `${locusUrl}/controls`);
        assert.equal(requestParams.body.layout.type, layoutType);
        assert.equal(requestParams.body.layout.deviceUrl, deviceUrl);
        assert.deepEqual(requestParams.body.layout.layoutParams, {renderInfo: {main: {width: 640, height: 480}, content: {width: 1280, height: 720}}});
      });

      it('throws if width is missing for main', async () => {
        await assert.isRejected(meetingsRequest.changeVideoLayout({
          locusUrl,
          deviceUrl,
          layoutType,
          main: {height: 100}
        }));
      });

      it('throws if height is missing for main', async () => {
        await assert.isRejected(meetingsRequest.changeVideoLayout({
          locusUrl,
          deviceUrl,
          layoutType,
          main: {width: 100}
        }));
      });

      it('throws if width is missing for content', async () => {
        await assert.isRejected(meetingsRequest.changeVideoLayout({
          locusUrl,
          deviceUrl,
          layoutType,
          content: {height: 100}
        }));
      });

      it('throws if height is missing for content', async () => {
        await assert.isRejected(meetingsRequest.changeVideoLayout({
          locusUrl,
          deviceUrl,
          layoutType,
          content: {width: 100}
        }));
      });
    });

    describe('#joinMeeting', () => {
      it('sends /call requets for join', async () => {
        const locusUrl = 'locusURL';
        const deviceUrl = 'deviceUrl';
        const correlationId = 'random-uuid';
        const roapMessage = 'roap-message';
        const permissionToken = 'permission-token';

        await meetingsRequest.joinMeeting({
          locusUrl,
          deviceUrl,
          correlationId,
          roapMessage,
          permissionToken

        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'POST');
        assert.equal(requestParams.uri, `${locusUrl}/participant?alternateRedirect=true`);
        assert.equal(requestParams.body.device.url, deviceUrl);
        assert.equal(requestParams.body.device.countryCode, 'US');
        assert.equal(requestParams.body.permissionToken, 'permission-token');
        assert.equal(requestParams.body.device.regionCode, 'WEST-COAST');
      });

      it('sends /call with meetingNumber if inviteeAddress does not exist', async () => {
        const deviceUrl = 'deviceUrl';
        const correlationId = 'random-uuid';
        const roapMessage = 'roap-message';
        const meetingNumber = 'meetingNumber';

        await meetingsRequest.joinMeeting({
          deviceUrl,
          correlationId,
          roapMessage,
          meetingNumber
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'POST');
        assert.equal(requestParams.uri, 'locusUrl/loci/call?alternateRedirect=true');
        assert.equal(requestParams.body.invitee.address, 'wbxmn:meetingNumber');
      });

      it('sends /call with inviteeAddress over meetingNumber as preference', async () => {
        const deviceUrl = 'deviceUrl';
        const correlationId = 'random-uuid';
        const roapMessage = 'roap-message';
        const meetingNumber = 'meetingNumber';
        const inviteeAddress = 'sipUrl';

        await meetingsRequest.joinMeeting({
          deviceUrl,
          correlationId,
          roapMessage,
          meetingNumber,
          inviteeAddress
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'POST');
        assert.equal(requestParams.uri, 'locusUrl/loci/call?alternateRedirect=true');
        assert.equal(requestParams.body.invitee.address, 'sipUrl');
      });
    });

    describe('#pstn', () => {
      it('sends dial in pstn request', async () => {
        const locusUrl = 'locusUrl';
        const clientUrl = 'clientUrl';
        const correlationId = 'random-uuid';
        const dialInUrl = 'url';

        await meetingsRequest.dialIn({
          locusUrl,
          clientUrl,
          correlationId,
          dialInUrl
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'POST');
        assert.equal(requestParams.uri, `${locusUrl}/participant`);
        assert.equal(requestParams.body.device.url, dialInUrl);
        assert.equal(requestParams.body.device.deviceType, 'PROVISIONAL');
        assert.equal(requestParams.body.device.provisionalType, 'DIAL_IN');
        assert.equal(requestParams.body.device.clientUrl, 'clientUrl');
      });

      it('sends dial out pstn request', async () => {
        const locusUrl = 'locusUrl';
        const clientUrl = 'clientUrl';
        const correlationId = 'random-uuid';
        const dialOutUrl = 'url';
        const phoneNumber = '+442088241000';

        await meetingsRequest.dialOut({
          locusUrl,
          clientUrl,
          correlationId,
          dialOutUrl,
          phoneNumber
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'POST');
        assert.equal(requestParams.uri, `${locusUrl}/participant`);
        assert.equal(requestParams.body.device.url, dialOutUrl);
        assert.equal(requestParams.body.device.deviceType, 'PROVISIONAL');
        assert.equal(requestParams.body.device.provisionalType, 'DIAL_OUT');
        assert.equal(requestParams.body.device.clientUrl, 'clientUrl');
        assert.equal(requestParams.body.device.dialoutAddress, phoneNumber);
      });

      it('sends disconnect phone audio request', async () => {
        const locusUrl = 'locusUrl';
        const selfId = 'selfId';
        const correlationId = 'random-uuid';
        const phoneUrl = 'url';

        await meetingsRequest.disconnectPhoneAudio({
          locusUrl,
          selfId,
          correlationId,
          phoneUrl
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'PUT');
        assert.equal(requestParams.uri, `${locusUrl}/participant/${selfId}/leave`);
        assert.equal(requestParams.body.device.url, phoneUrl);
        assert.equal(requestParams.body.device.deviceType, 'PROVISIONAL');
      });
    });

    describe('#endMeetingForAll', () => {
      it('sends request to endMeetingForAll', async () => {
        const locusUrl = 'locusURL';

        await meetingsRequest.endMeetingForAll({
          locusUrl,
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'POST');
        assert.equal(requestParams.uri, `${locusUrl}/end`);
      });
    });

    describe('#keepAlive', () => {
      it('sends request to keepAlive', async () => {
        const keepAliveUrl = 'keepAliveURL';

        await meetingsRequest.keepAlive({
          keepAliveUrl,
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'GET');
        assert.equal(requestParams.uri, keepAliveUrl);
      });
    });
  });
});
