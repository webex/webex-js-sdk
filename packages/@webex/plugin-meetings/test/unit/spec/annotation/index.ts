import MockWebex from '@webex/test-helper-mock-webex';
import MockWebSocket from '@webex/test-helper-mock-web-socket';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Mercury from '@webex/internal-plugin-mercury';
import LLMChannel from '@webex/internal-plugin-llm';

import AnnotationService from '../../../../src/annotation/index';
import {ANNOTATION_RELAY_TYPES, ANNOTATION_REQUEST_TYPE, EVENT_TRIGGERS} from '../../../../src/annotation/constants';


describe('live-annotation', () => {
  const locusUrl = 'https://locus.wbx2.com/locus/api/v1/loci/163c1787-c1f5-47cc-95eb-ab2d660999e6';

  describe('annotation', () => {
    let webex, annotationService;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          mercury: Mercury,
          llm: LLMChannel,
          annotation: AnnotationService,
        },
      });


      annotationService = webex.internal.annotation;
      annotationService.connect = sinon.stub().resolves(true);
      annotationService.webex.internal.llm.isConnected = sinon.stub().returns(true);
      annotationService.webex.internal.llm.getBinding = sinon.stub().returns(undefined);
      annotationService.webex.internal.llm.getLocusUrl = sinon.stub().returns(locusUrl);
      annotationService.approvalUrl = 'url/approval';
      annotationService.locusUrl = locusUrl;


      webex.request = sinon.stub().returns(Promise.resolve('REQUEST_RETURN_VALUE'));
      annotationService.register = sinon.stub().resolves({
        body: {
          binding: 'binding',
          webSocketUrl: 'url',
        },
      });
    });


    describe('event message processing', () => {
      beforeEach(async () => {
        annotationService.decryptContent = sinon.stub().returns(Promise.resolve('decryptedContent'));
      });

      it('eventCommandProcessor call failed', () => {
        const spy = sinon.spy();
        annotationService.on(EVENT_TRIGGERS.ANNOTATION_COMMAND, spy);
        annotationService.eventCommandProcessor({});
        assert.notCalled(spy);


        annotationService.eventCommandProcessor({
          data: {
          }
        });
        assert.notCalled(spy);

        annotationService.eventCommandProcessor({
          data: {
            eventType: 'not:locus.approval_request',
            approval: {
              resourceType: 'AnnotationOnShare',
              actionType: 'actionType'
            }
          }
        });
        assert.notCalled(spy);

        annotationService.eventCommandProcessor({
          data: {
            eventType: 'locus.approval_request',
            approval: {
              resourceType: 'not:AnnotationOnShare',
              actionType: 'actionType'
            }
          }
        });
        assert.notCalled(spy);

        annotationService.eventCommandProcessor({
          data: {
            eventType: 'locus.approval_request',
            approval: {
              resourceType: 'AnnotationOnShare',
            }
          }
        });
        assert.notCalled(spy)
      });



      it('eventCommandProcessor call success', () => {
        const spy = sinon.spy();
        annotationService.on(EVENT_TRIGGERS.ANNOTATION_COMMAND, spy);

        annotationService.eventCommandProcessor({
          data: {
            eventType: 'locus.approval_request',
            approval: {
              resourceType: 'AnnotationOnShare',
              actionType: 'actionType'
            }
          }
        });

        assert.calledOnceWithExactly(spy, {
          type: 'actionType',
          payload: {
            resourceType: 'AnnotationOnShare',
            actionType: 'actionType',
          },
        });
      });

      it('eventDataProcessor call failed', () => {

        const spy = sinon.spy(annotationService, "processStrokeMessage");

        annotationService.eventDataProcessor();

        assert.notCalled(spy);

        annotationService.eventDataProcessor({data: {}});

        assert.notCalled(spy);

        annotationService.eventDataProcessor({data: {relayType: 'NOT:annotation.client'}});

        assert.notCalled(spy);
      });


      it('eventDataProcessor call success', () => {

        const spy = sinon.spy(annotationService, "processStrokeMessage");

        annotationService.eventDataProcessor({data: {relayType: 'annotation.client', request:{value:{encryptionKeyUrl:"encryptionKeyUrl"}}}});

        assert.calledOnceWithExactly(spy, {
          relayType: 'annotation.client',
          request: { value: { encryptionKeyUrl: 'encryptionKeyUrl' } }
        } );

      });


      it('processStrokeMessage', async () => {
        const spy = sinon.spy();
        annotationService.on(EVENT_TRIGGERS.ANNOTATION_STROKE_DATA, spy);

        await annotationService.processStrokeMessage({request:{value:{encryptionKeyUrl: 'encryptionKeyUrl', content: 'content'}}});

        assert.calledOnceWithExactly(spy, {
          payload:{request:{value:{encryptionKeyUrl: 'encryptionKeyUrl', content: 'decryptedContent'}}} ,
        });

      });

    });

    describe('event message processing',() =>{

      it('listens to mercury events once', () => {

        const spy = sinon.spy(annotationService.webex.internal.mercury, 'on');

        annotationService.listenToEvents();

        assert.calledOnceWithExactly(spy, 'event:locus.approval_request', sinon.match.func,sinon.match.object);
      });

      it('listens to llm events once', () => {

        const spy = sinon.spy(webex.internal.llm, 'on');

        annotationService.listenToEvents();

        assert.calledOnceWithExactly(spy, 'event:relay.event', sinon.match.func,sinon.match.object);
      });

    });


    describe('encrypt/decrypt Content', () => {
      beforeEach(async () => {
        annotationService.webex.internal.encryption.encryptText = sinon.stub().returns(Promise.resolve('RETURN_VALUE'));
        annotationService.webex.internal.encryption.decryptText = sinon.stub().returns(Promise.resolve('RETURN_VALUE'));
      });

      it('encryptContent', async () => {
        const result = await annotationService.encryptContent("encryptionKeyUrl", "content");
        assert.calledOnceWithExactly(webex.internal.encryption.encryptText, "encryptionKeyUrl", "content");
        assert.equal(result, 'RETURN_VALUE')
      });

      it('decryptContent', async() => {
        const result =  await annotationService.decryptContent("decryptionKeyUrl", "content");
        assert.calledOnceWithExactly(webex.internal.encryption.decryptText, "decryptionKeyUrl", "content");
        assert.equal(result, 'RETURN_VALUE')
      });

    });



    describe('publish Stroke Data with LLM is not connected', () => {

      beforeEach(async () => {
        annotationService.webex.internal.llm.socket = new MockWebSocket();
        annotationService.webex.internal.llm.isConnected = sinon.stub().returns(false);
      });

      it('publish Stroke Data with LLM is not connected', async () => {
        annotationService.sendStrokeData("", {});
        assert.notCalled(annotationService.webex.internal.llm.socket.send);
      });

    });

    describe('sendStrokeData', () => {

      beforeEach(async () => {
        annotationService.webex.internal.llm.socket = new MockWebSocket();
      });


      it('works on publish Stroke Data', async () => {
        const strokeData = {
          content: {
            "contentsBuffer": [{
              "contentArray": [{
                "curveId": "58dcf45c-1fc5-46bf-a902-053621dd8977",
                "curvePoints": [592.593, 352.963, 3.400, 596.710, 352.963, 3.400, 600.000, 352.963, 3.398, 600.000, 352.963, 3.398],
                "stride": 3
              }], "type": "curve", "name": "contentUpdate"
            }], "action": "contentUpdate", "sender": {"name": "perfect", "id": "4dd5eaf9-4cf8-4f0f-a1d6-014bf5d00741"}
          },
          deviceId: "525ead98-6c93-4fcb-899d-517305c47513",
          requesterId: '525ead98-6c93-4fcb-899d-517305c47513',
          toUserId: "987ead98-6c93-4fcb-899d-517305c47503",
          shareInstanceId: '7fa6fe07-dcb1-41ad-973d-7bcf65fab55d',
          encryptionKeyUrl: "encryptionKeyUrl",
          version: '1',
        } ;

        annotationService.publishEncrypted(strokeData.content, strokeData);

        const sendObject = {
          id: sinon.match.string,
          type: 'publishRequest',
          recipients: {route: undefined},
          headers: {to: '987ead98-6c93-4fcb-899d-517305c47503'},
          data: {
            eventType: 'relay.event',
            relayType: ANNOTATION_RELAY_TYPES.ANNOTATION_CLIENT,
            request: {
              value: {
                type: ANNOTATION_REQUEST_TYPE.ANNOTATION_MESSAGE,
                content: strokeData.content,
                version: '1',
                seq:sinon.match.number,
                deviceId: sinon.match.string,
                requesterId: sinon.match.string,
                shareInstanceId: strokeData.shareInstanceId,
                encryptionKeyUrl: 'encryptionKeyUrl',
              }
            }
          },
          trackingId: sinon.match.string,
          timestamp: sinon.match.number,
          sequenceNumber: 1,
          filterMessage: false,
        };

        assert.calledOnceWithExactly(annotationService.webex.internal.llm.socket.send, sendObject);
      });

    });


    describe('Locus API collection', () => {

      describe('send approve request', () => {
        it('makes  send request approved annotation as expected', async () => {
          const
            requestData = {
              toUserId: '4dd5eaf9-4cf8-4f0f-a1d6-014bf5d00741',
              toDeviceUrl: 'https://wdm-a.wbx2.com/wdm/api/v1/devices/a3018aa9-70cb-4142-ae9a-f03db4fe1057',
              shareInstanceId: '9428c492-da14-476f-a36c-b377ee8c4009',
            };


          const result = await annotationService.approveAnnotation(requestData);
          assert.calledOnceWithExactly(webex.request, {
            method: 'POST',
            url: 'url/approval',
            body: {
              actionType: 'REQUESTED',
              resourceType: 'AnnotationOnShare',
              shareInstanceId: '9428c492-da14-476f-a36c-b377ee8c4009',
              receivers: [{
                participantId: '4dd5eaf9-4cf8-4f0f-a1d6-014bf5d00741',
                deviceUrl: 'https://wdm-a.wbx2.com/wdm/api/v1/devices/a3018aa9-70cb-4142-ae9a-f03db4fe1057'
              }],
            }
          });

          assert.equal(result, 'REQUEST_RETURN_VALUE')
        });
      });

      describe('cancel Approve request', () => {
        it('makes the cancel Approve request annotation as expected', async () => {
          const
            requestData = {
              toUserId: '4dd5eaf9-4cf8-4f0f-a1d6-014bf5d00741',
              toDeviceUrl: 'https://wdm-a.wbx2.com/wdm/api/v1/devices/a3018aa9-70cb-4142-ae9a-f03db4fe1057',
              shareInstanceId: '9428c492-da14-476f-a36c-b377ee8c4009',
            };
          const approval = {url:"url/cancel"};


          const result = await annotationService.cancelApproveAnnotation(requestData,approval);
          assert.calledOnceWithExactly(webex.request, {
            method: 'PUT',
            url: 'url/cancel',
            body: {
              actionType: 'CANCELED',
              resourceType: 'AnnotationOnShare',
              shareInstanceId: '9428c492-da14-476f-a36c-b377ee8c4009',
            }
          });

          assert.equal(result, 'REQUEST_RETURN_VALUE')
        });
      });



      describe('close annotation', () => {
        it('makes the close annotation as expected', async () => {
          const
            requestData = {
              toUserId: '4dd5eaf9-4cf8-4f0f-a1d6-014bf5d00741',
              toDeviceUrl: 'https://wdm-a.wbx2.com/wdm/api/v1/devices/a3018aa9-70cb-4142-ae9a-f03db4fe1057',
              shareInstanceId: '9428c492-da14-476f-a36c-b377ee8c4009',
            };


          const result = await annotationService.closeAnnotation(requestData);
          assert.calledOnceWithExactly(webex.request, {
            method: 'POST',
            url: 'url/approval',
            body: {
              actionType: 'CLOSED',
              resourceType: 'AnnotationOnShare',
              shareInstanceId: '9428c492-da14-476f-a36c-b377ee8c4009',
              receivers: [{
                participantId: '4dd5eaf9-4cf8-4f0f-a1d6-014bf5d00741',
                deviceUrl: 'https://wdm-a.wbx2.com/wdm/api/v1/devices/a3018aa9-70cb-4142-ae9a-f03db4fe1057'
              }],
            }
          });

          assert.equal(result, 'REQUEST_RETURN_VALUE')
        });
      });


      describe('declined annotation', () => {
        it('makes the declined annotation as expected', async () => {
          const approval = {
            url: 'approvalUrl'
          }
          const result = await annotationService.declineRequest(approval);
          assert.calledOnceWithExactly(webex.request, {
            method: 'PUT',
            url: 'approvalUrl',
            body: {
              actionType: 'DECLINED',
              resourceType: 'AnnotationOnShare',
            }
          });

          assert.equal(result, 'REQUEST_RETURN_VALUE')
        });
      });

      describe('accept annotation', () => {
        it('makes the accepted annotation as expected', async () => {
          const approval = {
            url: 'approvalUrl'
          }
          const result = await annotationService.acceptRequest(approval);
          assert.calledOnceWithExactly(webex.request, {
            method: 'PUT',
            url: 'approvalUrl',
            body: {
              actionType: 'ACCEPTED',
              resourceType: 'AnnotationOnShare',
            }
          });

          assert.equal(result, 'REQUEST_RETURN_VALUE')
        });
      });
    });
  });

});
