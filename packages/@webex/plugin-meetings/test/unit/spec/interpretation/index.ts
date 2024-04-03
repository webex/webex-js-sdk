import {assert, expect} from '@webex/test-helper-chai';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import SimultaneousInterpretation from '@webex/plugin-meetings/src/interpretation';
import SILanguage from '@webex/plugin-meetings/src/interpretation/siLanguage';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';

describe('plugin-meetings', () => {
  describe('SimultaneousInterpretation', () => {
    let webex;
    let interpretation;

    beforeEach(() => {
      // @ts-ignore
      webex = new MockWebex({});
      webex.internal.mercury.on = sinon.stub();
      interpretation = new SimultaneousInterpretation({}, {parent: webex});
      interpretation.locusUrl = 'locusUrl';
      webex.request = sinon.stub().returns(Promise.resolve('REQUEST_RETURN_VALUE'));
      webex.meetings = {};
      webex.meetings.getMeetingByType = sinon.stub();
    });

    describe('#initialize', () => {
      it('creates SimultaneousInterpretation as expected', () => {
        assert.equal(interpretation.namespace, 'Meetings');
      });
      it('call querySupportLanguages correctly when meet the conditions', () => {
        interpretation.querySupportLanguages = sinon.stub();
        interpretation.set({
          canManageInterpreters: true,
        });
        assert.called(interpretation.querySupportLanguages);
      });
    });

    describe('#cleanUp', () => {
      it('stops listening', () => {
        interpretation.stopListening = sinon.stub();

        interpretation.cleanUp();

        assert.calledOnceWithExactly(interpretation.stopListening);
      });
    });

    describe('#locusUrlUpdate', () => {
      it('sets the locus url', () => {
        interpretation.locusUrlUpdate('newUrl');

        assert.equal(interpretation.locusUrl, 'newUrl');
      });
    });

    describe('#approvalUrlUpdate', () => {
      it('sets the approval url', () => {
        interpretation.approvalUrlUpdate('newUrl');

        assert.equal(interpretation.approvalUrl, 'newUrl');
      });
    });

    describe('#updateCanManageInterpreters', () => {
      it('update canManageInterpreters', () => {
        interpretation.updateCanManageInterpreters(true);

        assert.equal(interpretation.canManageInterpreters, true);

        interpretation.updateCanManageInterpreters(false);

        assert.equal(interpretation.canManageInterpreters, false);
      });
    });

    describe('#updateHostSIEnabled', () => {
      it('update hostSI feature is on or off', () => {
        interpretation.updateHostSIEnabled(true);

        assert.equal(interpretation.hostSIEnabled, true);

        interpretation.updateHostSIEnabled(false);

        assert.equal(interpretation.hostSIEnabled, false);
      });
    });

    describe('#updateMeetingSIEnabled', () => {
      it('update meeting SI feature is on or off, and self is scheduled interpreter or not', () => {
        interpretation.updateMeetingSIEnabled(true, false);

        assert.equal(interpretation.meetingSIEnabled, true);
        assert.equal(interpretation.selfIsInterpreter, false);

        interpretation.updateMeetingSIEnabled(true, true);

        assert.equal(interpretation.meetingSIEnabled, true);
        assert.equal(interpretation.selfIsInterpreter, true);

        interpretation.updateMeetingSIEnabled(false, false);

        assert.equal(interpretation.meetingSIEnabled, false);
        assert.equal(interpretation.selfIsInterpreter, false);
      });
    });

    describe('#updateInterpretation', () => {
      const checkSILanguage = (siLanguage, expectResult) => {
        return siLanguage?.languageCode === expectResult.languageCode && siLanguage?.languageName === expectResult.languageName
      }
      it('update interpretation correctly', () => {
        interpretation.updateInterpretation({siLanguages: [{languageName: 'en', languageCode: 1}]});
        checkSILanguage(interpretation.siLanguages.en, {languageName: 'en', languageCode: 1});
      });
    });

    describe('#updateSelfInterpretation', () => {
      it('update self interpretation correctly', () => {
        const sampleData: any = {
          interpretation: {
            originalLanguage: 'en',
            sourceLanguage: 'en',
            targetLanguage: 'zh',
            isActive: true,
            receiveLanguage: 'en',
            order: 0,
          }, selfParticipantId: '123'};
        assert.equal(interpretation.updateSelfInterpretation(sampleData), true);
        assert.equal(interpretation.originalLanguage, 'en');
        assert.equal(interpretation.sourceLanguage, 'en');
        assert.equal(interpretation.targetLanguage, 'zh');
        assert.equal(interpretation.receiveLanguage, 'en');
        assert.equal(interpretation.isActive, true);
        assert.equal(interpretation.order, 0);
        assert.equal(interpretation.selfIsInterpreter, true);

        sampleData.interpretation = {
          originalLanguage: 'en',
          targetLanguage: 'zh',
          order: 0,
        };
        assert.equal(interpretation.updateSelfInterpretation(sampleData), false);
        assert.equal(interpretation.sourceLanguage, undefined);
        assert.equal(interpretation.targetLanguage, 'zh');
        assert.equal(interpretation.receiveLanguage, undefined);
        assert.equal(interpretation.selfIsInterpreter, true);

        sampleData.interpretation = {
          order: 0,
        };
        assert.equal(interpretation.updateSelfInterpretation(sampleData), true);
        assert.equal(interpretation.originalLanguage, undefined);
        assert.equal(interpretation.targetLanguage, undefined);
        assert.equal(interpretation.selfIsInterpreter, false);
      });
    });

    describe('#getTargetLanguageCode', () => {
      it('get target language id if self is interpreter', () => {
        interpretation.siLanguages.set([{
          languageCode: 24,
          languageName: "fr"
        },
          {
            languageCode: 20,
            languageName: "en"
          }]);
        interpretation.selfIsInterpreter = true;
        interpretation.targetLanguage = 'fr';

        assert.equal(interpretation.getTargetLanguageCode(), 24);

        interpretation.targetLanguage = 'en';
        assert.equal(interpretation.getTargetLanguageCode(), 20);

        interpretation.selfIsInterpreter = false;
        assert.equal(interpretation.getTargetLanguageCode(), 0);

      });
    });

    describe('#querySupportLanguages', () => {
      it('makes the request as expected', async () => {
        const mockedReturnBody = {
          siLanguages: [{
              languageCode: 43,
              languageName: 'it'
            },
            {
              languageCode: 20,
              languageName: 'en'
            }]
        };
        webex.request.returns(
          Promise.resolve({
            body: mockedReturnBody,
          })
        );

        await interpretation.querySupportLanguages();
        assert.calledOnceWithExactly(webex.request, {
          method: 'GET',
          uri: 'locusUrl/languages/interpretation',
        });
        assert.deepEqual(interpretation.supportLanguages, mockedReturnBody.siLanguages);
      });

      it('rejects with error', async () => {
        const mockError = new Error('something wrong');
        webex.request.returns(Promise.reject(mockError));
        LoggerProxy.logger.error = sinon.stub();

        await assert.isRejected(interpretation.querySupportLanguages(), mockError, 'something wrong');

        assert.calledOnceWithExactly(
          LoggerProxy.logger.error,
          'Meeting:interpretation#querySupportLanguages failed',
          mockError
        );
      });
    });

    describe('#getInterpreters', () => {
      it('makes the request as expected', async () => {
        const mockedReturnBody = {
          interpreters: [{
            emailAddress : 'bob@example.com',
            emailHash : 'fdde32a3-97b0-4511-b0b5-2731cc9c5266',
            originalLanguageId : 0,
            originalLanguage : 'cn',
            sourceLanguageId : 0,
            sourceLanguage : 'cn',
            targetLanguageId : 1,
            targetLanguage : 'en',
            order : 0,
            isActive : true
          },]
        };
        webex.request.returns(
          Promise.resolve({
            body: mockedReturnBody,
          })
        );

        const result = await interpretation.getInterpreters();
        assert.calledOnceWithExactly(webex.request, {
          method: 'GET',
          uri: 'locusUrl/interpretation/interpreters',
        });
        assert.deepEqual(result, {body: mockedReturnBody})
      });

      it('rejects with error', async () => {
        const mockError = new Error('something wrong');
        webex.request.returns(Promise.reject(mockError));
        LoggerProxy.logger.error = sinon.stub();

        await assert.isRejected(interpretation.getInterpreters(), mockError, 'something wrong');

        assert.calledOnceWithExactly(
          LoggerProxy.logger.error,
          'Meeting:interpretation#getInterpreters failed',
          mockError
        );
      });
    });

    describe('#updateInterpreters', () => {
      it('makes the request as expected', async () => {
        const sampleData = [{
            emailAddress : 'bob@example.com',
            emailHash : 'fdde32a3-97b0-4511-b0b5-2731cc9c5266',
            originalLanguageId : 0,
            originalLanguage : 'cn',
            sourceLanguageId : 0,
            sourceLanguage : 'cn',
            targetLanguageId : 1,
            targetLanguage : 'en',
            order : 0,
            isActive : true
          },];
        webex.request.returns(Promise.resolve({}));

        await interpretation.updateInterpreters(sampleData);
        assert.calledOnceWithExactly(webex.request, {
          method: 'PATCH',
          uri: 'locusUrl/controls',
          body: {
            interpretation: {
              interpreters: sampleData,
            },
          },
        });
      });

      it('rejects with error', async () => {
        const mockError = new Error('something wrong');
        webex.request.returns(Promise.reject(mockError));
        LoggerProxy.logger.error = sinon.stub();

        await assert.isRejected(interpretation.updateInterpreters(), mockError, 'something wrong');

        assert.calledOnceWithExactly(
          LoggerProxy.logger.error,
          'Meeting:interpretation#updateInterpreters failed',
          mockError
        );
      });
    });

    describe('#changeDirection', () => {
      it('makes the request as expected', async () => {
        interpretation.set({
          sourceLanguage : 'cn',
          targetLanguage : 'en',
          isActive: true,
          order: 0,
          selfParticipantId: '123',
        });
        webex.request.returns(Promise.resolve({}));

        await interpretation.changeDirection();
        assert.calledOnceWithExactly(webex.request, {
          method: 'PATCH',
          uri: 'locusUrl/participant/123/controls',
          body: {
            interpretation: {
              sourceLanguage : 'en',
              targetLanguage : 'cn',
              isActive: true,
              order: 0,
            },
          },
        });
      });

      it('request rejects with error', async () => {
        interpretation.set({
          sourceLanguage : 'cn',
          targetLanguage : 'en',
          isActive: true,
          order: 0,
          selfParticipantId: '123',
        });
        const mockError = new Error('something wrong');
        webex.request.returns(Promise.reject(mockError));
        LoggerProxy.logger.error = sinon.stub();

        await assert.isRejected(interpretation.changeDirection(), mockError, 'something wrong');

        assert.calledOnceWithExactly(
          LoggerProxy.logger.error,
          'Meeting:interpretation#changeDirection failed',
          mockError
        );
      });

      it('rejects error when no sourceLanguage or targetLanguage', async () => {
        interpretation.set({
          sourceLanguage : 'cn',
          isActive: true,
          order: 0,
          selfParticipantId: '123',
        });
        LoggerProxy.logger.error = sinon.stub();

        await interpretation.changeDirection().catch((error) => {
          assert.equal(error.toString(), 'Error: Missing sourceLanguage or targetLanguage');
        });

        interpretation.set({
          targetLanguage : 'en',
          isActive: true,
          order: 0,
          selfParticipantId: '123',
        });
        await interpretation.changeDirection().catch((error) => {
          assert.equal(error.toString(), 'Error: Missing sourceLanguage or targetLanguage');
        });
      });

      it('rejects error when no self participant id', async () => {
        interpretation.set({
          sourceLanguage : 'cn',
          targetLanguage : 'en',
          isActive: true,
          order: 0,
        });
        LoggerProxy.logger.error = sinon.stub();

        await interpretation.changeDirection().catch((error) => {
          assert.equal(error.toString(), 'Error: Missing self participant id');
        });
      });
    });

    describe('#listenToHandoffRequests', () => {
      it('triggers handoff update event when the approval is related with self', () => {
        const call = webex.internal.mercury.on.getCall(0);
        const callback = call.args[1];

        assert.equal(call.args[0], 'event:locus.approval_request');
        interpretation.set('selfParticipantId', 'p123');

        let called = false;
        const triggerSpy = sinon.spy(interpretation, 'trigger');

        interpretation.listenTo(interpretation, 'HANDOFF_REQUESTS_ARRIVED', () => {
          called = true;
        });

        callback({
          data: {
            approval: {
              actionType: 'OFFERED',
              resourceType: 'SiHandover',
              receivers: [{
                participantId: 'p123',
              }],
              initiator: {participantId: 'p123'},
              url: 'testUrl',
            },
          }
        });

        assert.isTrue(called);
        assert.calledWithExactly(triggerSpy, 'HANDOFF_REQUESTS_ARRIVED', {
          actionType: 'OFFERED',
          isReceiver: true,
          isSender: true,
          senderId: 'p123',
          receiverId: 'p123',
          url: 'testUrl',
        });
      });

      it('not triggers handoff update event when the approval is not related with self', () => {
        const call = webex.internal.mercury.on.getCall(0);
        const callback = call.args[1];

        interpretation.set('selfParticipantId', 'p123');

        let called = false;

        interpretation.listenTo(interpretation, 'HANDOFF_REQUESTS_ARRIVED', () => {
          called = true;
        });

        callback({
          data: {
            approval: {
              actionType: 'OFFERED',
              resourceType: 'SiHandover',
              receivers: [{
                participantId: 'p444',
              }],
              initiator: {participantId: 'p444'},
              url: 'testUrl',
            },
          }
        });

        assert.isFalse(called);
      });
    });

    describe('#handoffInterpreter', () => {
      it('makes the request as expected', async () => {
        interpretation.approvalUrlUpdate('approvalUrl');
        await interpretation.handoffInterpreter('participant2');
        assert.calledOnceWithExactly(webex.request, {
          method: 'POST',
          uri: 'approvalUrl',
          body: {
            actionType: 'OFFERED',
            resourceType: 'SiHandover',
            receivers: [
              {
                participantId: 'participant2',
              },
            ],
          },
        });
      });

      it('rejects with error', async () => {
        const mockError = new Error('something wrong');
        webex.request.returns(Promise.reject(mockError));
        LoggerProxy.logger.error = sinon.stub();
        interpretation.approvalUrlUpdate('approvalUrl');

        await assert.isRejected(interpretation.handoffInterpreter('p2'), mockError, 'something wrong');

        assert.calledOnceWithExactly(
          LoggerProxy.logger.error,
          'Meeting:interpretation#handoffInterpreter failed',
          mockError
        );
      });

      it('rejects error when no target participant id', async () => {
        LoggerProxy.logger.error = sinon.stub();

        await interpretation.handoffInterpreter().catch((error) => {
          assert.equal(error.toString(), 'Error: Missing target participant id');
        });
      });

      it('rejects error when no approval url', async () => {
        LoggerProxy.logger.error = sinon.stub();

        await interpretation.handoffInterpreter('p2').catch((error) => {
          assert.equal(error.toString(), 'Error: Missing approval url');
        });
      });
    });

    describe('#requestHandoff', () => {
      it('makes the request as expected', async () => {
        interpretation.approvalUrlUpdate('approvalUrl');
        await interpretation.requestHandoff();
        assert.calledOnceWithExactly(webex.request, {
          method: 'POST',
          uri: 'approvalUrl',
          body: {
            actionType: 'REQUESTED',
            resourceType: 'SiHandover',
          },
        });
      });

      it('rejects with error', async () => {
        const mockError = new Error('something wrong');
        webex.request.returns(Promise.reject(mockError));
        LoggerProxy.logger.error = sinon.stub();
        interpretation.approvalUrlUpdate('approvalUrl');

        await assert.isRejected(interpretation.requestHandoff(), mockError, 'something wrong');

        assert.calledOnceWithExactly(
          LoggerProxy.logger.error,
          'Meeting:interpretation#requestHandoff failed',
          mockError
        );
      });

      it('rejects error when no approval url', async () => {
        LoggerProxy.logger.error = sinon.stub();

        await interpretation.requestHandoff().catch((error) => {
          assert.equal(error.toString(), 'Error: Missing approval url');
        });
      });
    });

    describe('#acceptRequest', () => {
      it('makes the request as expected', async () => {
        await interpretation.acceptRequest('testUrl');
        assert.calledOnceWithExactly(webex.request, {
          method: 'PUT',
          uri: 'testUrl',
          body: {
            actionType: 'ACCEPTED',
          },
        });
      });

      it('rejects with error', async () => {
        const mockError = new Error('something wrong');
        webex.request.returns(Promise.reject(mockError));
        LoggerProxy.logger.error = sinon.stub();

        await assert.isRejected(interpretation.acceptRequest('testUrl'), mockError, 'something wrong');

        assert.calledOnceWithExactly(
          LoggerProxy.logger.error,
          'Meeting:interpretation#acceptRequest failed',
          mockError
        );
      });

      it('rejects error when no url passed', async () => {
        LoggerProxy.logger.error = sinon.stub();

        await interpretation.acceptRequest().catch((error) => {
          assert.equal(error.toString(), 'Error: Missing the url to accept');
        });
      });
    });

    describe('#declineRequest', () => {
      it('makes the request as expected', async () => {
        await interpretation.declineRequest('testUrl');
        assert.calledOnceWithExactly(webex.request, {
          method: 'PUT',
          uri: 'testUrl',
          body: {
            actionType: 'DECLINED',
          },
        });
      });

      it('rejects with error', async () => {
        const mockError = new Error('something wrong');
        webex.request.returns(Promise.reject(mockError));
        LoggerProxy.logger.error = sinon.stub();

        await assert.isRejected(interpretation.declineRequest('testUrl'), mockError, 'something wrong');

        assert.calledOnceWithExactly(
          LoggerProxy.logger.error,
          'Meeting:interpretation#declineRequest failed',
          mockError
        );
      });

      it('rejects error when no url passed', async () => {
        LoggerProxy.logger.error = sinon.stub();

        await interpretation.declineRequest().catch((error) => {
          assert.equal(error.toString(), 'Error: Missing the url to decline');
        });
      });
    });
  });
});
