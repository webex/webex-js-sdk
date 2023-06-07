import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import Meetings from '@webex/plugin-meetings';
import MeetingRequest from '@webex/plugin-meetings/src/meeting/request';
import uuid from 'uuid';
import { merge } from 'lodash';


describe('plugin-meetings', () => {
  let meetingsRequest;
  let locusDeltaRequestSpy;

  beforeEach(() => {
    const webex = new MockWebex({
      children: {
        meetings: Meetings,
      },
    });

    webex.meetings.clientRegion = {
      countryCode: 'US',
      regionCode: 'WEST-COAST',
    };

    webex.internal = {
      services: {
        get: sinon.mock().returns('locusUrl'),
        waitForCatalog: sinon.mock().returns(Promise.resolve({})),
      },
    };

    webex.boundedStorage.get = sinon.mock().returns(Promise.resolve(JSON.stringify({anycastEntryPoint: "aws-eu-west-1"})))

    const request = sinon.mock().returns(Promise.resolve({}));

    meetingsRequest = new MeetingRequest(
      {
        meeting: {
          request,
          locusInfo: {
            sequence: {}
          }
        }
      },
      {
        parent: webex,
      }
    );

    meetingsRequest.request = request;
    locusDeltaRequestSpy = sinon.spy(meetingsRequest, 'locusDeltaRequest');
  });

  const checkRequest = (expectedParams) => {
    assert.calledOnceWithExactly(locusDeltaRequestSpy, expectedParams);
    assert.calledOnceWithExactly(meetingsRequest.request, merge(expectedParams, {body: {sequence: {}}}));
  }

  describe('meeting request library', () => {

    beforeEach(() => {
      sinon.stub(uuid, 'v4').returns('12345');
    });

    afterEach(() => {
      uuid.v4.restore();
    });

    describe('#sendDTMF', () => {
      it('sends a POST to the sendDtmf locus endpoint', async () => {
        const locusUrl = 'locusURL';
        const deviceUrl = 'deviceUrl';
        const tones = '1234';



        await meetingsRequest.sendDTMF({
          locusUrl,
          deviceUrl,
          tones,
        });

        checkRequest({
          method: 'POST',
          uri: `${locusUrl}/sendDtmf`,
          body: {
            deviceUrl: 'deviceUrl',
            dtmf: {
              correlationId: '12345',
              tones: '1234',
            },
          },
        });
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
          content: {width: 1280, height: 720},
        });

        checkRequest({
          method: 'PUT',
          uri: `${locusUrl}/controls`,
          body: {
            layout: {
              deviceUrl,
              type: layoutType,
              layoutParams: {
                renderInfo: {main: {width: 640, height: 480}, content: {width: 1280, height: 720}},
              },
            },
          },
        });
      });

      it('throws if width is missing for main', async () => {
        await assert.isRejected(
          meetingsRequest.changeVideoLayout({
            locusUrl,
            deviceUrl,
            layoutType,
            main: {height: 100},
          })
        );
      });

      it('throws if height is missing for main', async () => {
        await assert.isRejected(
          meetingsRequest.changeVideoLayout({
            locusUrl,
            deviceUrl,
            layoutType,
            main: {width: 100},
          })
        );
      });

      it('throws if width is missing for content', async () => {
        await assert.isRejected(
          meetingsRequest.changeVideoLayout({
            locusUrl,
            deviceUrl,
            layoutType,
            content: {height: 100},
          })
        );
      });

      it('throws if height is missing for content', async () => {
        await assert.isRejected(
          meetingsRequest.changeVideoLayout({
            locusUrl,
            deviceUrl,
            layoutType,
            content: {width: 100},
          })
        );
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
          permissionToken,
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
          meetingNumber,
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
          inviteeAddress,
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'POST');
        assert.equal(requestParams.uri, 'locusUrl/loci/call?alternateRedirect=true');
        assert.equal(requestParams.body.invitee.address, 'sipUrl');
      });

      it('adds deviceCapabilities to request when breakouts are supported', async () => {
        await meetingsRequest.joinMeeting({
          breakoutsSupported: true
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.deepEqual(requestParams.body.deviceCapabilities, ['BREAKOUTS_SUPPORTED']);
      });

      it('adds deviceCapabilities to request when live annotation are supported', async () => {
        await meetingsRequest.joinMeeting({
          liveAnnotationSupported: true
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];
        assert.deepEqual(requestParams.body.deviceCapabilities, ['ANNOTATION_ON_SHARE_SUPPORTED']);
      });
      it('adds deviceCapabilities to request when breakouts and live annotation are supported', async () => {
        await meetingsRequest.joinMeeting({
          liveAnnotationSupported: true,
          breakoutsSupported: true,
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];
        assert.deepEqual(requestParams.body.deviceCapabilities, ['BREAKOUTS_SUPPORTED','ANNOTATION_ON_SHARE_SUPPORTED']);
      });
      it('does not add deviceCapabilities to request when breakouts and live annotation are not supported', async () => {
        await meetingsRequest.joinMeeting({});

        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.deepEqual(requestParams.body.deviceCapabilities, undefined);

      });

      it('adds deviceCapabilities and locale to request when they are provided', async () => {
        await meetingsRequest.joinMeeting({
          locale: 'en_UK',
          deviceCapabilities: ['SERVER_AUDIO_ANNOUNCEMENT_SUPPORTED']
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.deepEqual(requestParams.body.deviceCapabilities, ['SERVER_AUDIO_ANNOUNCEMENT_SUPPORTED']);
        assert.deepEqual(requestParams.body.locale, 'en_UK');
      });

      it('does not add deviceCapabilities and locale to request when they are not provided', async () => {
        await meetingsRequest.joinMeeting({});
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.deepEqual(requestParams.body.deviceCapabilities, undefined);
        assert.deepEqual(requestParams.body.locale, undefined);
      });

      it('includes joinCookie correctly', async () => {
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
          permissionToken,
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'POST');
        assert.equal(requestParams.uri, `${locusUrl}/participant?alternateRedirect=true`);
        assert.deepEqual(requestParams.body.clientMediaPreferences, {
          "joinCookie": {anycastEntryPoint: "aws-eu-west-1"},
          "preferTranscoding": true
        });
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
          dialInUrl,
        });

        checkRequest({
          method: 'POST',
          uri: `${locusUrl}/participant`,
          body: {
            device: {
              url: dialInUrl,
              deviceType: 'PROVISIONAL',
              provisionalType: 'DIAL_IN',
              clientUrl,
            },
            correlationId
          }
        });
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
          phoneNumber,
        });

        checkRequest({
          method: 'POST',
          uri: `${locusUrl}/participant`,
          body: {
            device: {
              url: dialOutUrl,
              deviceType: 'PROVISIONAL',
              provisionalType: 'DIAL_OUT',
              clientUrl,
              dialoutAddress: phoneNumber,
            },
            correlationId,
          },
        });

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
          phoneUrl,
        });

        checkRequest({
          method: 'PUT',
          uri: `${locusUrl}/participant/${selfId}/leave`,
          body: {
            device: {
              url: phoneUrl,
              deviceType: 'PROVISIONAL'
            },
            correlationId
          }
        });
      });
    });

    describe('#leaveMeeting', () => {
      it('sends the request to leave the meeting', async () => {
        const locusUrl = 'locusUrl';
        const selfId = 'selfId';
        const correlationId = 'random-uuid';
        const resourceId = 'resourceId';
        const deviceUrl = 'deviceUrl';

        meetingsRequest.config.meetings.deviceType = 'deviceType';

        await meetingsRequest.leaveMeeting({
          locusUrl,
          selfId,
          deviceUrl,
          resourceId,
          correlationId,
        });

        checkRequest({
          method: 'PUT',
          uri: 'locusUrl/participant/selfId/leave',
          body: {
            device: {deviceType: 'deviceType', url: 'deviceUrl'},
            usingResource: 'resourceId',
            correlationId: 'random-uuid',
          },
        });
      });
    });

    describe('#acknowledgeMeeting', () => {
      it('sends the request to acknowledge the meeting', async () => {
        const locusUrl = 'locusUrl';
        const correlationId = 'random-uuid';
        const deviceUrl = 'deviceUrl';

        meetingsRequest.config.meetings.deviceType = 'deviceType';

        await meetingsRequest.acknowledgeMeeting({
          locusUrl,
          deviceUrl,
          correlationId,
        });

        checkRequest({
          method: 'PUT',
          uri: 'locusUrl/participant/alert',
          body: {
            device: {deviceType: 'deviceType', url: 'deviceUrl'},
            correlationId: 'random-uuid',
          },
        });
      });
    });

    describe('#lockMeeting', () => {
      it('sends request to lock the meeting', async () => {
        const locusUrl = 'locusURL';

        await meetingsRequest.lockMeeting({
          locusUrl,
          lock: true,
        });

        checkRequest({
          method: 'PATCH',
          uri: `${locusUrl}/controls`,
          body: {
            lock: {locked: true}
          }
        });
      });
    });


    describe('#endMeetingForAll', () => {
      it('sends request to endMeetingForAll', async () => {
        const locusUrl = 'locusURL';

        await meetingsRequest.endMeetingForAll({
          locusUrl,
        });

        checkRequest({
          method: 'POST',
          uri: `${locusUrl}/end`,
        });
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

    describe('#sendReaction', () => {
      it('sends request to sendReaction', async () => {
        const reactionChannelUrl = 'reactionChannelUrl';
        const participantId = 'participantId';
        const reaction = {
          type: 'thumb_down',
          codepoints: '1F44E',
          shortcodes: ':thumbsdown:',
          tone: {type: 'normal_skin_tone', codepoints: '', shortcodes: ''},
        };

        await meetingsRequest.sendReaction({
          reactionChannelUrl,
          reaction,
          participantId,
        });
        const requestParams = meetingsRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'POST');
        assert.equal(requestParams.uri, reactionChannelUrl);
        assert.equal(requestParams.body.sender.participantId, participantId);
        assert.equal(requestParams.body.reaction, reaction);
      });
    });

    describe('#toggleReactions', () => {
      it('sends request to toggleReactions', async () => {
        const locusUrl = 'locusUrl';
        const requestingParticipantId = 'requestingParticipantId';

        await meetingsRequest.toggleReactions({
          enable: true,
          locusUrl,
          requestingParticipantId,
        });

        checkRequest({
          method: 'PUT',
          uri: `${locusUrl}/controls`,
          body: {
            reactions: {
              enabled: true,
            },
            requestingParticipantId,
          },
        });
      });
    });
  });

  describe('#declineMeeting', () => {

    it('sends a request to decline the meeting', async () => {
      const reason = 'reason';
      const deviceUrl = 'deviceUrl';
      const locusUrl = 'locusUrl';
      meetingsRequest.config.meetings.deviceType = 'deviceType';
  
      await meetingsRequest.declineMeeting({
        locusUrl,
        deviceUrl,
        reason
      });
  
      const expectedBody = {
        device: {
          deviceType: 'deviceType',
          url: deviceUrl,
        },
        reason,
      };
  
      checkRequest({
        method: 'PUT',
        uri: `${locusUrl}/participant/decline`,
        body: expectedBody,
      });
    });

  });

  describe('#getLocusStatusByUrl', () => {
    it('check locus status', async () => {
      const locusUrl = 'locusUrl';

      await meetingsRequest.getLocusStatusByUrl(locusUrl);
      assert.deepEqual(meetingsRequest.request.getCall(0).args[0], {
        method: 'GET',
        uri: locusUrl,
      })
    });
  });

  describe('#changeMeetingFloor', () => {

    it('change meeting floor', async () => {
      const options = {
        disposition: 'GRANTED',
        personUrl: 'personUrl',
        deviceUrl: 'deviceUrl',
        resourceId: 'resourceId',
        resourceUrl: 'resourceUrl',
        uri: 'optionsUrl',
        annotation:{
          version: '1',
          policy: 'Approval',
        },
      }

      const expectBody = {
        annotation: {
          policy: 'Approval',
          version: '1',
        },
        floor: {
          beneficiary: {
            devices: [
              {
                deviceType: undefined,
                url: "deviceUrl"
              }
            ],
            url: 'personUrl',
          },
          disposition: 'GRANTED',
          requester: {
            "url": "personUrl"
          }
        },
        resourceUrl: 'resourceUrl',
      };


      await meetingsRequest.changeMeetingFloor(options);

      assert.deepEqual(meetingsRequest.request.getCall(0).args[0], {
        method: 'PUT',
        uri: 'optionsUrl',
        body: expectBody,
      })
    });
  });
});
