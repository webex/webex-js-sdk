import {assert, expect} from '@webex/test-helper-chai';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import SimultaneousInterpretation from '@webex/plugin-meetings/src/interpretation';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';

describe('plugin-meetings', () => {
  describe('SimultaneousInterpretation', () => {
    let webex;
    let interpretation;

    beforeEach(() => {
      // @ts-ignore
      webex = new MockWebex({});
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

    describe('#locusUrlUpdate', () => {
      it('sets the locus url', () => {
        interpretation.locusUrlUpdate('newUrl');

        assert.equal(interpretation.locusUrl, 'newUrl');
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

    describe('#updateInterpretation', () => {
      const checkSILanguage = (siLanguage, expectResult) => {
        return siLanguage?.languageCode === expectResult.languageCode && siLanguage?.languageName === expectResult.languageName
      }
      it('update interpretation correctly', () => {
        interpretation.updateInterpretation({siLanguages: [{languageName: 'en', languageCode: 1}]});
        checkSILanguage(interpretation.siLanguages.en, {languageName: 'en', languageCode: 1});
        assert.equal(interpretation.siEnabled, true);
      });

      it('check siEnable as false if input param interpretation is null/undefined', () => {
        interpretation.updateInterpretation(null);
        assert.equal(interpretation.siEnabled, false);

        interpretation.updateInterpretation(undefined);
        assert.equal(interpretation.siEnabled, false);
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
        interpretation.updateSelfInterpretation(sampleData);
        assert.equal(interpretation.originalLanguage, 'en');
        assert.equal(interpretation.sourceLanguage, 'en');
        assert.equal(interpretation.targetLanguage, 'zh');
        assert.equal(interpretation.receiveLanguage, 'en');
        assert.equal(interpretation.isActive, true);
        assert.equal(interpretation.order, 0);

        sampleData.interpretation = {
          originalLanguage: 'en',
          order: 0,
        };
        interpretation.updateSelfInterpretation(sampleData);
        assert.equal(interpretation.sourceLanguage, undefined);
        assert.equal(interpretation.targetLanguage, undefined);
        assert.equal(interpretation.receiveLanguage, undefined);
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
  });
});
