import 'jsdom-global/register';
import MockWebex from '@webex/test-helper-mock-webex';
import MockWebSocket from '@webex/test-helper-mock-web-socket';
import {assert, expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Mercury from '@webex/internal-plugin-mercury';
import LLMChannel from '@webex/internal-plugin-llm';

import VoiceaService from '../../../src/index';
import {
  EVENT_TRIGGERS,
  LLM_PRACTICE_SESSION,
  TOGGLE_MANUAL_CAPTION_STATUS,
} from '../../../src/constants';

describe('plugin-voicea', () => {
  const locusUrl = 'locusUrl';

  describe('voicea', () => {
    let webex, voiceaService;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          mercury: Mercury,
          llm: LLMChannel,
          voicea: VoiceaService,
        },
      });

      voiceaService = webex.internal.voicea;
      voiceaService.connect = sinon.stub().resolves(true);
      voiceaService.webex.internal.llm.isConnected = sinon.stub().returns(true);
      voiceaService.webex.internal.llm.getBinding = sinon.stub().returns(undefined);
      voiceaService.webex.internal.llm.getSocket = sinon.stub().returns(undefined);
      voiceaService.webex.internal.llm.getLocusUrl = sinon.stub().returns(locusUrl);

      voiceaService.request = sinon.stub().resolves({
        headers: {},
        body: '',
      });
      voiceaService.register = sinon.stub().resolves({
        body: {
          binding: 'binding',
          webSocketUrl: 'url',
        },
      });
    });

    describe("#constructor", () => {
      it('should init status', () => {
        assert.equal(voiceaService.announceStatus, 'idle');
        assert.equal(voiceaService.captionStatus, 'idle');
      });
    });

    describe('#sendAnnouncement', () => {
      beforeEach(async () => {
        const mockWebSocket = new MockWebSocket();

        voiceaService.webex.internal.llm.socket = mockWebSocket;
        voiceaService.announceStatus = "idle";
      });

      it("sends announcement if voicea hasn't joined", () => {
        const spy = sinon.spy(voiceaService, 'listenToEvents');

        voiceaService.sendAnnouncement();
        assert.equal(voiceaService.announceStatus, 'joining');
        assert.calledOnce(spy);

        assert.calledOnceWithExactly(voiceaService.webex.internal.llm.socket.send, {
          id: '1',
          type: 'publishRequest',
          recipients: {route: undefined},
          headers: {},
          data: {
            clientPayload: {
              version: 'v2',
            },
            eventType: 'relay.event',
            relayType: 'client.annc',
          },
          trackingId: sinon.match.string,
        });
      });

      it('listens to events once', () => {
        const spy = sinon.spy(webex.internal.llm, 'on');

        voiceaService.sendAnnouncement();

        voiceaService.sendAnnouncement();

        assert.calledTwice(spy);
        assert.calledWith(spy, 'event:relay.event', sinon.match.func);
        assert.calledWith(spy, `event:relay.event:${LLM_PRACTICE_SESSION}`, sinon.match.func);
      });

      it('includes captionServiceId in headers when set', () => {
        const mockWebSocket = new MockWebSocket();

        voiceaService.webex.internal.llm.socket = mockWebSocket;
        voiceaService.announceStatus = 'idle';
        voiceaService.captionServiceId = 'svc-123';

        voiceaService.sendAnnouncement();

        assert.calledOnceWithExactly(voiceaService.webex.internal.llm.socket.send, {
          id: '1',
          type: 'publishRequest',
          recipients: {route: undefined},
          headers: {to: 'svc-123'},
          data: {
            clientPayload: {
              version: 'v2',
            },
            eventType: 'relay.event',
            relayType: 'client.annc',
          },
          trackingId: sinon.match.string,
        });
      });
    });

    describe('#sendManualClosedCaption', () => {
      beforeEach(async () => {
        const mockWebSocket = new MockWebSocket();
        voiceaService.webex.internal.llm.socket = mockWebSocket;
        voiceaService.seqNum = 1;
      });

      it('sends interim manual closed caption when connected', () => {
        const text = 'Test interim caption';
        const timeStamp = 1234567890;
        const csis = [123456];
        const isFinal = false;

        voiceaService.sendManualClosedCaption(text, timeStamp, csis, isFinal);

        assert.calledOnceWithExactly(
          voiceaService.webex.internal.llm.socket.send,
          {
            id: '1',
            type: 'publishRequest',
            recipients: {route: undefined},
            headers: {},
            data: {
              eventType: 'relay.event',
              relayType: 'client.manual_transcription',
              transcriptPayload: {
                type: 'manual_caption_interim_result',
                id: sinon.match.string,
                transcripts: [
                  {
                    text: 'Test interim caption',
                    start_millis: 1234567890,
                    end_millis: 1234567890,
                    csis: [123456],
                  },
                ],
                transcript_id: sinon.match.string,
              },
            },
            trackingId: sinon.match.string,
          }
        );
        // seqNum should increment
        assert.equal(voiceaService.seqNum, 2);
      });

      it('sends final manual closed caption when connected', () => {
        const text = 'Test final caption';
        const timeStamp = 9876543210;
        const csis = [654321];
        const isFinal = true;

        voiceaService.sendManualClosedCaption(text, timeStamp, csis, isFinal);

        assert.calledOnceWithExactly(
          voiceaService.webex.internal.llm.socket.send,
          {
            id: '1',
            type: 'publishRequest',
            recipients: {route: undefined},
            headers: {},
            data: {
              eventType: 'relay.event',
              relayType: 'client.manual_transcription',
              transcriptPayload: {
                type: 'manual_caption_final_result',
                id: sinon.match.string,
                transcripts: [
                  {
                    text: 'Test final caption',
                    start_millis: 9876543210,
                    end_millis: 9876543210,
                    csis: [654321],
                  },
                ],
                transcript_id: sinon.match.string,
              },
            },
            trackingId: sinon.match.string,
          }
        );
        // seqNum should increment
        assert.equal(voiceaService.seqNum, 2);
      });

      it('does not send if not connected', () => {
        voiceaService.webex.internal.llm.isConnected.returns(false);

        const text = 'Should not send';
        const timeStamp = 111;
        const csis = [1];
        const isFinal = true;

        voiceaService.sendManualClosedCaption(text, timeStamp, csis, isFinal);

        assert.notCalled(voiceaService.webex.internal.llm.socket.send);
      });
    });
    describe('#deregisterEvents', () => {
      beforeEach(async () => {
        const mockWebSocket = new MockWebSocket();
        voiceaService.webex.internal.llm.socket = mockWebSocket;
        voiceaService.isCaptionBoxOn = true;
      });

      it('deregisters voicea service and resets caption state', async () => {
        voiceaService.listenToEvents();
        await voiceaService.toggleTranscribing(true);

        voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {relayType: 'voicea.annc', voiceaPayload: {}},
        });

        assert.equal(voiceaService.areCaptionsEnabled, true);
        assert.equal(voiceaService.captionServiceId, 'ws');
        assert.equal(voiceaService.isCaptionBoxOn, true);

        voiceaService.deregisterEvents();
        assert.equal(voiceaService.areCaptionsEnabled, false);
        assert.equal(voiceaService.captionServiceId, undefined);
        assert.equal(voiceaService.announceStatus, 'idle');
        assert.equal(voiceaService.captionStatus, 'idle');
        assert.equal(voiceaService.isCaptionBoxOn, false);
      });
    });
    describe('#processAnnouncementMessage', () => {
      it('works on non-empty payload', async () => {
        const voiceaPayload = {
          translation: {
            allowed_languages: ['af', 'am'],
            max_languages: 5,
          },
          ASR: {
            spoken_languages: ['en'],
          },

          version: 'v2',
        };

        const spy = sinon.spy();

        voiceaService.on(EVENT_TRIGGERS.VOICEA_ANNOUNCEMENT, spy);
        voiceaService.listenToEvents();
        voiceaService.processAnnouncementMessage(voiceaPayload);
        assert.calledOnceWithExactly(spy, {
          captionLanguages: ['af', 'am'],
          spokenLanguages: ['en'],
          maxLanguages: 5,
          currentSpokenLanguage: 'en',
        });
      });

      it('works on empty payload', async () => {
        const spy = sinon.spy();

        voiceaService.on(EVENT_TRIGGERS.VOICEA_ANNOUNCEMENT, spy);
        voiceaService.listenToEvents();
        voiceaService.currentSpokenLanguage = 'fr';
        await voiceaService.processAnnouncementMessage({});
        assert.calledOnceWithExactly(spy, {
          captionLanguages: [],
          spokenLanguages: [],
          maxLanguages: 0,
          currentSpokenLanguage: 'fr',
        });
      });
    });

    describe('#requestLanguage', () => {
      beforeEach(async () => {
        const mockWebSocket = new MockWebSocket();

        voiceaService.webex.internal.llm.socket = mockWebSocket;
      });

      it('requests caption language', () => {
        voiceaService.requestLanguage('en');

        assert.calledOnceWithExactly(voiceaService.webex.internal.llm.socket.send, {
          id: '1',
          type: 'publishRequest',
          recipients: {route: undefined},
          headers: {to: undefined},
          data: {
            clientPayload: {
              translationLanguage: 'en',
              id: sinon.match.string,
            },
            eventType: 'relay.event',
            relayType: 'voicea.transl.req',
          },
          trackingId: sinon.match.string,
        });
      });

      it('uses captionServiceId as "to" header when set', () => {
        voiceaService.captionServiceId = 'svc-456';

        voiceaService.requestLanguage('fr');

        assert.calledOnceWithExactly(voiceaService.webex.internal.llm.socket.send, {
          id: '1',
          type: 'publishRequest',
          recipients: {route: undefined},
          headers: {to: 'svc-456'},
          data: {
            clientPayload: {
              translationLanguage: 'fr',
              id: sinon.match.string,
            },
            eventType: 'relay.event',
            relayType: 'voicea.transl.req',
          },
          trackingId: sinon.match.string,
        });
      });
    });

    describe('#setSpokenLanguage', () => {
      it('sets spoken language', async () => {
        const languageCode = 'en';
        const triggerSpy = sinon.spy();

        voiceaService.on(EVENT_TRIGGERS.SPOKEN_LANGUAGE_UPDATE, triggerSpy);
        voiceaService.listenToEvents();
        await voiceaService.setSpokenLanguage(languageCode);

        assert.calledOnceWithExactly(triggerSpy, {languageCode});

        sinon.assert.calledWith(
          voiceaService.request,
          sinon.match({
            method: 'PUT',
            url: `${locusUrl}/controls/`,
            body: {
              transcribe: {
                spokenLanguage: languageCode,
              }
            },
          })
        );
      });
      it('sets spoken language with language assignment', async () => {
        const languageCode = 'zh';
        const languageAssignment = 'DEFAULT';
        const triggerSpy = sinon.spy();

        voiceaService.on(EVENT_TRIGGERS.SPOKEN_LANGUAGE_UPDATE, triggerSpy);
        voiceaService.listenToEvents();
        await voiceaService.setSpokenLanguage(languageCode, languageAssignment);

        assert.calledOnceWithExactly(triggerSpy, {languageCode});

        sinon.assert.calledWith(
          voiceaService.request,
          sinon.match({
            method: 'PUT',
            url: `${locusUrl}/controls/`,
            body: {
              transcribe: {
                spokenLanguage: languageCode,
                languageAssignment,
              }
            },
          })
        );
      });

    });

    describe('#requestTurnOnCaptions', () => {
      beforeEach(async () => {
        const mockWebSocket = new MockWebSocket();

        voiceaService.webex.internal.llm.socket = mockWebSocket;
        voiceaService.captionStatus = 'idle';
      });

      afterEach( () => {
        voiceaService.captionStatus = 'idle';
      })

      it('turns on captions', async () => {
        const announcementSpy = sinon.spy(voiceaService, 'announce');
        const updateSubchannelSubscriptionsAndSyncCaptionStateSpy = sinon.spy(voiceaService, 'updateSubchannelSubscriptionsAndSyncCaptionState');

        const triggerSpy = sinon.spy();

        voiceaService.on(EVENT_TRIGGERS.CAPTIONS_TURNED_ON, triggerSpy);
        voiceaService.listenToEvents();

        await voiceaService.requestTurnOnCaptions();
        assert.equal(voiceaService.captionStatus, 'enabled');
        sinon.assert.calledWith(
          voiceaService.request,
          sinon.match({
            method: 'PUT',
            url: `${locusUrl}/controls/`,
            body: {transcribe: {caption: true}},
          })
        );

        assert.calledOnceWithExactly(triggerSpy);

        assert.calledOnce(announcementSpy);
        assert.calledOnceWithExactly(
          updateSubchannelSubscriptionsAndSyncCaptionStateSpy,
          { subscribe: ['transcription'] },
          true
        );
      });

      it("should handle request fail", async () => {
        voiceaService.captionStatus = 'sending';
        voiceaService.request = sinon.stub().rejects();

        try {
          await voiceaService.requestTurnOnCaptions();
        } catch (error) {
          expect(error.message).to.include('turn on captions fail');
          return;
        }
        assert.equal(voiceaService.captionStatus, 'idle');
      });
    });

    describe("#isAnnounceProcessing", () => {
      afterEach(() => {
        voiceaService.announceStatus = 'idle';
      });

      ['joining', 'joined'].forEach((status) => {
        it(`should return true when status is ${status}`, () => {
          voiceaService.announceStatus = status;
          assert.equal(voiceaService.isAnnounceProcessing(), true);
        });
      });

      it('should return false when status is not processing status', () => {
        voiceaService.announceStatus = 'idle';
          assert.equal(voiceaService.isAnnounceProcessing(), false);
      });
    });

    describe('#isLLMConnected', () => {
      it('returns true when the default llm connection is connected', () => {
        voiceaService.webex.internal.llm.isConnected.callsFake((channel) =>
          channel === LLM_PRACTICE_SESSION ? false : true
        );

        assert.equal(voiceaService.isLLMConnected(), true);
      });

      it('returns true when only the practice session llm connection is connected', () => {
        voiceaService.webex.internal.llm.isConnected.callsFake((channel) =>
          channel === LLM_PRACTICE_SESSION
        );

        assert.equal(voiceaService.isLLMConnected(), true);
      });

      it('returns false when neither llm connection is connected', () => {
        voiceaService.webex.internal.llm.isConnected.returns(false);

        assert.equal(voiceaService.isLLMConnected(), false);
      });
    });

    describe('#getIsCaptionBoxOn', () => {
      beforeEach(() => {
        voiceaService.isCaptionBoxOn = false;
      });

      it('returns false when captions are disabled', () => {
        voiceaService.isCaptionBoxOn = false;

        const result = voiceaService.getIsCaptionBoxOn();

        assert.equal(result, false);
      });

      it('returns true when captions are enabled', () => {
        voiceaService.isCaptionBoxOn = true;

        const result = voiceaService.getIsCaptionBoxOn();

        assert.equal(result, true);
      });
    });

    describe("#announce", () => {
      let isAnnounceProcessed, sendAnnouncement;
      beforeEach(() => {
        sendAnnouncement = sinon.stub(voiceaService, 'sendAnnouncement');
        isAnnounceProcessed = sinon.stub(voiceaService, 'isAnnounceProcessed').returns(false)
      });

      afterEach(() => {
        isAnnounceProcessed.restore();
        sendAnnouncement.restore();
      });

      it('announce to llm data channel', ()=> {
        voiceaService.announce();
        assert.calledOnce(sendAnnouncement);
      });

      it('announce to llm data channel before llm connected', ()=> {
        voiceaService.webex.internal.llm.isConnected.returns(false);
        assert.throws(() =>  voiceaService.announce(), "voicea can not announce before llm connected");
        assert.notCalled(sendAnnouncement);
      });

      it('announce to llm data channel when only practice session is connected', ()=> {
        voiceaService.webex.internal.llm.isConnected.callsFake((channel) =>
          channel === LLM_PRACTICE_SESSION
        );

        voiceaService.announce();

        assert.calledOnce(sendAnnouncement);
      });

      it('should not announce duplicate', () => {
        isAnnounceProcessed.returns(true);
        voiceaService.announce();
        assert.notCalled(sendAnnouncement);
      })
    });

    describe("#isCaptionProcessing", () => {
      afterEach(() => {
        voiceaService.captionStatus = 'idle';
      });

      ['sending', 'enabled'].forEach((status) => {
        it(`should return true when status is ${status}`, () => {
          voiceaService.captionStatus = status;
          assert.equal(voiceaService.isCaptionProcessing(), true);
        });
      });

      it('should return false when status is not processing status', () => {
        voiceaService.captionStatus = 'idle';
          assert.equal(voiceaService.isCaptionProcessing(), false);
      });
    });

    describe('#turnOnCaptions', () => {
      let requestTurnOnCaptions;
      beforeEach(() => {
        requestTurnOnCaptions = sinon.stub(voiceaService, 'requestTurnOnCaptions');
        voiceaService.captionStatus = 'idle';
      });

      afterEach(() => {
        requestTurnOnCaptions.restore();
        voiceaService.captionStatus = 'idle';
      });

      it('call request turn on captions', () => {
        voiceaService.captionStatus = 'idle';
        voiceaService.turnOnCaptions();
        assert.calledOnce(requestTurnOnCaptions);
      });

      it('throws before turning on captions when llm is not connected', async () => {
        voiceaService.captionStatus = 'idle';
        voiceaService.webex.internal.llm.isConnected.returns(false);

        await assert.isRejected(
          voiceaService.turnOnCaptions(),
          'can not turn on captions before llm connected'
        );
        assert.notCalled(requestTurnOnCaptions);
      });

      it('turns on captions when only the practice session llm connection is connected', () => {
        voiceaService.webex.internal.llm.isConnected.callsFake((channel) =>
          channel === LLM_PRACTICE_SESSION
        );

        voiceaService.turnOnCaptions();

        assert.calledOnce(requestTurnOnCaptions);
      });

      it('should not turn on duplicate when processing', () => {
        voiceaService.captionStatus = 'sending';
        voiceaService.turnOnCaptions();
        assert.notCalled(voiceaService.requestTurnOnCaptions);
      });
    });

    describe('#toggleTranscribing', () => {
      beforeEach(async () => {
        const mockWebSocket = new MockWebSocket();

        voiceaService.webex.internal.llm.socket = mockWebSocket;
      });

      it('turns on transcribing with CC enabled', async () => {
        // Turn on captions
        await voiceaService.turnOnCaptions();
        const announcementSpy = sinon.spy(voiceaService, 'sendAnnouncement');

        // eslint-disable-next-line no-underscore-dangle
        voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {relayType: 'voicea.annc', voiceaPayload: {}},
        });

        voiceaService.listenToEvents();

        await voiceaService.toggleTranscribing(true);
        sinon.assert.calledWith(
          voiceaService.request,
          sinon.match({
            method: 'PUT',
            url: `${locusUrl}/controls/`,
            body: {transcribe: {transcribing: true}},
          })
        );

        assert.notCalled(announcementSpy);
      });

      it('turns on transcribing with CC disabled', async () => {
        const announcementSpy = sinon.spy(voiceaService, 'sendAnnouncement');

        voiceaService.listenToEvents();

        await voiceaService.toggleTranscribing(true);
        sinon.assert.calledWith(
          voiceaService.request,
          sinon.match({
            method: 'PUT',
            url: `${locusUrl}/controls/`,
            body: {transcribe: {transcribing: true}},
          })
        );

        assert.calledOnce(announcementSpy);
      });

      it('turns off transcribing', async () => {
        await voiceaService.toggleTranscribing(true);

        const announcementSpy = sinon.spy(voiceaService, 'sendAnnouncement');

        voiceaService.listenToEvents();

        await voiceaService.toggleTranscribing(false);
        sinon.assert.calledWith(
          voiceaService.request,
          sinon.match({
            method: 'PUT',
            url: `${locusUrl}/controls/`,
            body: {transcribe: {transcribing: true}},
          })
        );

        assert.notCalled(announcementSpy);
      });
    });

    describe('#toggleManualCaption', () => {
      beforeEach(async () => {
        const mockWebSocket = new MockWebSocket();

        voiceaService.webex.internal.llm.socket = mockWebSocket;
        voiceaService.toggleManualCaptionStatus = TOGGLE_MANUAL_CAPTION_STATUS.IDLE;
      });

      it('turns on manual caption', async () => {
        await voiceaService.toggleManualCaption(true);
        sinon.assert.calledWith(
          voiceaService.request,
          sinon.match({
            method: 'PUT',
            url: `${locusUrl}/controls/`,
            body: {manualCaption: {enable: true}},
          })
        );

      });


      it('turns off manual caption', async () => {
        await voiceaService.toggleManualCaption(false);
        sinon.assert.calledWith(
          voiceaService.request,
          sinon.match({
            method: 'PUT',
            url: `${locusUrl}/controls/`,
            body: {manualCaption: {enable: false}},
          })
        );

      });

      it('ignore toggle manual caption', async () => {
        voiceaService.toggleManualCaptionStatus = TOGGLE_MANUAL_CAPTION_STATUS.SENDING;
        await voiceaService.toggleManualCaption(true);

        sinon.assert.notCalled(voiceaService.request);

      });
    });

    describe('#processCaptionLanguageResponse', () => {
      it('responds to process caption language', async () => {
        const triggerSpy = sinon.spy();
        const functionSpy = sinon.spy(voiceaService, 'processCaptionLanguageResponse');

        voiceaService.on(EVENT_TRIGGERS.CAPTION_LANGUAGE_UPDATE, triggerSpy);
        voiceaService.listenToEvents();

        // eslint-disable-next-line no-underscore-dangle
        voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {
            relayType: 'voicea.transl.rsp',
            voiceaPayload: {
              statusCode: 200,
            },
          },
        });

        assert.calledOnceWithExactly(triggerSpy, {statusCode: 200});
        assert.calledOnce(functionSpy);
      });

      it('responds to process caption language for a failed response', async () => {
        const triggerSpy = sinon.spy();
        const functionSpy = sinon.spy(voiceaService, 'processCaptionLanguageResponse');

        voiceaService.on(EVENT_TRIGGERS.CAPTION_LANGUAGE_UPDATE, triggerSpy);
        voiceaService.listenToEvents();

        const payload = {
          errorCode: 300,
          message: 'error text',
        };

        // eslint-disable-next-line no-underscore-dangle
        voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {relayType: 'voicea.transl.rsp', voiceaPayload: payload},
        });
        assert.calledOnce(functionSpy);
        assert.calledOnceWithExactly(triggerSpy, {statusCode: 300, errorMessage: 'error text'});
      });
    });

    describe('#processTranscription', () => {
      let triggerSpy, functionSpy;

      beforeEach(() => {
        triggerSpy = sinon.spy();
        functionSpy = sinon.spy(voiceaService, 'processTranscription');
        voiceaService.listenToEvents();
      });

      it('processes interim transcription', async () => {
        voiceaService.on(EVENT_TRIGGERS.NEW_CAPTION, triggerSpy);
        const transcripts = [
          {
            text: 'Hello.',
            csis: [3556942592],
            transcript_language_code: 'en',
            translations: {
              fr: 'Bonjour.',
            },
          },
          {
            text: 'This is Webex',
            csis: [3556942593],
            transcript_language_code: 'en',
            translations: {
              fr: "C'est Webex",
            },
          },
        ];
        const voiceaPayload = {
          audio_received_millis: 0,
          command_response: '',
          csis: [3556942592],
          data: 'Hello.',
          id: '38093ff5-f6a8-581c-9e59-035ec027994b',
          meeting: '61d4e269-8419-42ab-9e56-3917974cda01',
          transcript_id: '3ec73890-bffb-f28b-e77f-99dc13caea7e',
          ts: 1611653204.3147924,
          type: 'transcript_interim_results',

          transcripts,
        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {relayType: 'voicea.transcription', voiceaPayload},
        });

        assert.calledOnceWithExactly(functionSpy, voiceaPayload);
        assert.calledOnceWithExactly(triggerSpy, {
          isFinal: false,
          transcriptId: '3ec73890-bffb-f28b-e77f-99dc13caea7e',
          transcripts,
        });
      });

      it('processes final transcription', async () => {
        voiceaService.on(EVENT_TRIGGERS.NEW_CAPTION, triggerSpy);

        const voiceaPayload = {
          audio_received_millis: 0,
          command_response: '',
          csis: [3556942592],
          data: 'Hello. This is Webex',
          id: '38093ff5-f6a8-581c-9e59-035ec027994b',
          meeting: '61d4e269-8419-42ab-9e56-3917974cda01',
          transcript_id: '3ec73890-bffb-f28b-e77f-99dc13caea7e',
          ts: 1611653204.3147924,
          type: 'transcript_final_result',
          translations: {
            en: "Hello?",
          },
          transcript: {
            alignments: [
              {
                end_millis: 12474,
                start_millis: 12204,
                word: 'Hello?',
              },
            ],
            csis: [3556942592],
            end_millis: 13044,
            last_packet_timestamp_ms: 1611653206784,
            start_millis: 12204,
            text: 'Hello?',
            transcript_language_code: 'en',
            timestamp: '0:13'
          },
          transcripts: [
            {
              start_millis: 12204,
              end_millis: 13044,
              text: 'Hello.',
              csis: [3556942592],
              transcript_language_code: 'en',
              translations: {
                fr: 'Bonjour.',
              },
              timestamp: '0:13'
            },
            {
              start_millis: 12204,
              end_millis: 13044,
              text: 'This is Webex',
              csis: [3556942593],
              transcript_language_code: 'en',
              translations: {
                fr: "C'est Webex",
              },
              timestamp: '0:13'
            },
          ],
        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {relayType: 'voicea.transcription', voiceaPayload},
        });

        assert.calledOnceWithExactly(functionSpy, voiceaPayload);
        assert.calledOnceWithExactly(triggerSpy, {
          isFinal: true,
          transcriptId: '3ec73890-bffb-f28b-e77f-99dc13caea7e',
          transcripts: voiceaPayload.transcripts,
        });
      });

      it('processes a eva wake up', async () => {
        voiceaService.on(EVENT_TRIGGERS.EVA_COMMAND, triggerSpy);

        const voiceaPayload = {
          audio_received_millis: 1616137504810,
          command_response: '',
          id: '31fb2f81-fb55-4257-32a0-f421ef8ba4b0',
          meeting: 'fd5bd0fc-06fb-4fd1-982b-554c4368f101',
          trigger: {
            detected_at: '2021-03-19T07:05:04.810669662Z',
            ews_confidence: 0.99497044086456299,
            ews_keyphrase: 'OkayWebEx',
            model_version: 'WebEx',
            offset_seconds: 2336.5900000000001,
            recording_file_name:
              'OkayWebEx_fd5bd0fc-06fb-4fd1-982b-554c4368f101_47900f3f-8579-25eb-3f6a-74d81a3c66a4_2335.8900000000003_2336.79.raw',
            type: 'live-hotword',
          },
          ts: 1616137504.8107769,
          type: 'eva_wake',
        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {relayType: 'voicea.transcription', voiceaPayload},
        });

        assert.calledOnceWithExactly(functionSpy, voiceaPayload);
        assert.calledOnceWithExactly(triggerSpy, {
          isListening: true,
        });
      });

      it('processes a eva thanks', async () => {
        voiceaService.on(EVENT_TRIGGERS.EVA_COMMAND, triggerSpy);

        const voiceaPayload = {
          audio_received_millis: 0,
          command_response: 'OK! Decision created.',
          id: '9bc51440-1a22-7c81-6add-4b6ff7b59f7c',
          intent: 'decision',
          meeting: 'fd5bd0fc-06fb-4fd1-982b-554c4368f101',
          ts: 1616135828.2552843,
          type: 'eva_thanks',
        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {relayType: 'voicea.transcription', voiceaPayload},
        });

        assert.calledOnceWithExactly(functionSpy, voiceaPayload);
        assert.calledOnceWithExactly(triggerSpy, {
          isListening: false,
          text: 'OK! Decision created.',
        });
      });

      it('processes a eva cancel', async () => {
        voiceaService.on(EVENT_TRIGGERS.EVA_COMMAND, triggerSpy);

        const voiceaPayload = {
          audio_received_millis: 0,
          command_response: '',
          id: '9bc51440-1a22-7c81-6add-4b6ff7b59f7c',
          intent: 'decision',
          meeting: 'fd5bd0fc-06fb-4fd1-982b-554c4368f101',
          ts: 1616135828.2552843,
          type: 'eva_cancel',
        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {relayType: 'voicea.transcription', voiceaPayload},
        });

        assert.calledOnceWithExactly(functionSpy, voiceaPayload);

        assert.calledOnceWithExactly(triggerSpy, {
          isListening: false,
        });
      });

      it('processes a highlight', async () => {
        voiceaService.on(EVENT_TRIGGERS.HIGHLIGHT_CREATED, triggerSpy);
        const voiceaPayload = {
          audio_received_millis: 0,
          command_response: '',
          highlight: {
            created_by_email: '',
            csis: [3932881920],
            end_millis: 660160,
            highlight_id: '219af4b1-1579-5106-53ab-f621094a0c5a',
            highlight_label: 'Decision',
            highlight_source: 'voice-command',
            start_millis: 652756,
            transcript: 'Create a decision to move ahead with the last proposal.',
            trigger_info: {type: 'live-hotword'},
          },
          id: 'e6df0262-6289-db2e-581a-d44bb41b1c9c',
          meeting: 'fd5bd0fc-06fb-4fd1-982b-554c4368f101',
          ts: 1616135858.5349569,
          type: 'highlight_created',
        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {relayType: 'voicea.transcription', voiceaPayload},
        });

        assert.calledOnceWithExactly(functionSpy, voiceaPayload);
        assert.calledOnceWithExactly(triggerSpy, {
          csis: [3932881920],
          highlightId: '219af4b1-1579-5106-53ab-f621094a0c5a',
          text: 'Create a decision to move ahead with the last proposal.',
          highlightLabel: 'Decision',
          highlightSource: 'voice-command',
          timestamp: '11:00',
        });
      });

      it('processes a language detected if language is in spoken languages', async () => {
        voiceaService.on(EVENT_TRIGGERS.LANGUAGE_DETECTED, triggerSpy);

        const voiceaPayload = {
          id: '9bc51440-1a22-7c81-6add-4b6ff7b59f7c',
          meeting: 'fd5bd0fc-06fb-4fd1-982b-554c4368f101',
          type: 'language_detected',
          language: 'en',
          translation: {
            allowed_languages: ['af', 'am'],
            max_languages: 5,
          },
          ASR: {
            spoken_languages: ['en', 'pl'],
          },

          version: 'v2',
        };

          const spy = sinon.spy();

        voiceaService.on(EVENT_TRIGGERS.VOICEA_ANNOUNCEMENT, spy);
        voiceaService.listenToEvents();
        voiceaService.processAnnouncementMessage(voiceaPayload);

          // eslint-disable-next-line no-underscore-dangle
        await voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {relayType: 'voicea.transcription', voiceaPayload},
        });

        assert.calledOnceWithExactly(functionSpy, voiceaPayload);
        assert.calledOnceWithExactly(triggerSpy, {
            languageCode: 'en',
        });
      });

    });

    describe('#processManualTranscription', () => {
      let triggerSpy, functionSpy;

      beforeEach(() => {
        triggerSpy = sinon.spy();
        functionSpy = sinon.spy(voiceaService, 'processManualTranscription');
        voiceaService.listenToEvents();
      });

      it('processes interim manual transcription from aibridge', async () => {
        voiceaService.on(EVENT_TRIGGERS.NEW_MANUAL_CAPTION, triggerSpy);

        const transcriptPayload = {
          id: "747d711d-3414-fd69-7081-e842649f2d28",
          transcripts: [
            {
              text: "Good",
            }
          ],
          type: "manual_caption_interim_result",
        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {relayType: 'aibridge.manual_transcription', transcriptPayload},
        });

        assert.calledOnceWithExactly(functionSpy, {...transcriptPayload, sender: 'ws', data_source: 'aibridge.manual_transcription'});
        assert.calledOnceWithExactly(triggerSpy, {
          isFinal: false,
          transcriptId: '747d711d-3414-fd69-7081-e842649f2d28',
          transcripts: transcriptPayload.transcripts,
          sender: 'ws',
          source: 'aibridge.manual_transcription'
        });
      });

      it('processes final manual transcription from aibridge', async () => {
        voiceaService.on(EVENT_TRIGGERS.NEW_MANUAL_CAPTION, triggerSpy);

        const transcriptPayload = {
          id: "8d226d31-044a-8d11-cc39-cedbde183154",
          transcripts: [
            {
              text: "Good Morning",
              start_millis: 10420,
              end_millis: 11380,
            }
          ],
          type: "manual_caption_final_result",
        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {relayType: 'aibridge.manual_transcription', transcriptPayload},
        });

        assert.calledOnceWithExactly(functionSpy, {...transcriptPayload, sender: 'ws', data_source: 'aibridge.manual_transcription'});
        assert.calledOnceWithExactly(triggerSpy, {
          isFinal: true,
          transcriptId: '8d226d31-044a-8d11-cc39-cedbde183154',
          transcripts: transcriptPayload.transcripts,
          sender: 'ws',
          source: 'aibridge.manual_transcription'
        });
      });

      it('processes interim manual transcription from captioner', async () => {
        voiceaService.on(EVENT_TRIGGERS.NEW_MANUAL_CAPTION, triggerSpy);

        const transcriptPayload = {
          id: "747d711d-3414-fd69-7081-e842649f2d28",
          transcripts: [
            {
              text: "Good",
            }
          ],
          type: "manual_caption_interim_result",
        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: '654321'},
          data: {relayType: 'client.manual_transcription', transcriptPayload},
        });

        assert.calledOnceWithExactly(functionSpy, {...transcriptPayload, sender: '654321', data_source: 'client.manual_transcription'});
        assert.calledOnceWithExactly(triggerSpy, {
          isFinal: false,
          transcriptId: '747d711d-3414-fd69-7081-e842649f2d28',
          transcripts: transcriptPayload.transcripts,
          sender: '654321',
          source: 'client.manual_transcription'
        });
      });

      it('processes final manual transcription from captioner', async () => {
        voiceaService.on(EVENT_TRIGGERS.NEW_MANUAL_CAPTION, triggerSpy);

        const transcriptPayload = {
          id: "8d226d31-044a-8d11-cc39-cedbde183154",
          transcripts: [
            {
              text: "Good Morning",
              start_millis: 10420,
              end_millis: 11380,
            }
          ],
          type: "manual_caption_final_result",
        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: '654321'},
          data: {relayType: 'client.manual_transcription', transcriptPayload},
        });

        assert.calledOnceWithExactly(functionSpy, {...transcriptPayload, sender: '654321', data_source: 'client.manual_transcription'});
        assert.calledOnceWithExactly(triggerSpy, {
          isFinal: true,
          transcriptId: '8d226d31-044a-8d11-cc39-cedbde183154',
          transcripts: transcriptPayload.transcripts,
          sender: '654321',
          source: 'client.manual_transcription'
        });
      });
    });

    describe("#getCaptionStatus", () => {
      it('works correctly', () => {
        voiceaService.captionStatus = "enabled"
        assert.equal(voiceaService.getCaptionStatus(), "enabled");
      });
    });

    describe("#getAnnounceStatus", () => {
      it('works correctly', () => {
        voiceaService.announceStatus = "joined"
        assert.equal(voiceaService.getAnnounceStatus(), "joined");
      });
    });

    describe('#onSpokenLanguageUpdate', () => {
      it('should trigger SPOKEN_LANGUAGE_UPDATE event with correct languageCode', () => {
        const triggerSpy = sinon.spy();
        voiceaService.on(EVENT_TRIGGERS.SPOKEN_LANGUAGE_UPDATE, triggerSpy);

        const languageCode = 'fr';
        voiceaService.onSpokenLanguageUpdate(languageCode, '123');
        assert.equal(voiceaService.currentSpokenLanguage, languageCode);
        assert.calledOnceWithExactly(triggerSpy, {languageCode, meetingId: '123'});
      });
    });

    describe('#onCaptionServiceIdUpdate', () => {
      let mockWebSocket;

      beforeEach(() => {
        mockWebSocket = new MockWebSocket();
        voiceaService.webex.internal.llm.socket = mockWebSocket;
        voiceaService.webex.internal.llm.isConnected.returns(true);
        voiceaService.seqNum = 1;
      });

      it('does nothing when serviceId is falsy', () => {
        voiceaService.captionServiceId = 'existing-id';
        voiceaService.currentCaptionLanguage = 'en';

        voiceaService.onCaptionServiceIdUpdate(undefined);
        voiceaService.onCaptionServiceIdUpdate('');

        assert.equal(voiceaService.captionServiceId, 'existing-id');
        assert.notCalled(voiceaService.webex.internal.llm.socket.send);
      });

      it('sets captionServiceId when no currentCaptionLanguage', () => {
        voiceaService.captionServiceId = undefined;
        voiceaService.currentCaptionLanguage = undefined;

        voiceaService.onCaptionServiceIdUpdate('svc-new');

        assert.equal(voiceaService.captionServiceId, 'svc-new');
        assert.notCalled(voiceaService.webex.internal.llm.socket.send);
      });

      it('re-sends language when serviceId changes and currentCaptionLanguage is set', () => {
        voiceaService.captionServiceId = 'old-svc';
        voiceaService.currentCaptionLanguage = 'es';

        voiceaService.onCaptionServiceIdUpdate('new-svc');

        assert.equal(voiceaService.captionServiceId, 'new-svc');
        assert.calledOnce(voiceaService.webex.internal.llm.socket.send);

        const callArgs = voiceaService.webex.internal.llm.socket.send.getCall(0).args[0];
        expect(callArgs).to.have.nested.property('headers.to', 'new-svc');
        expect(callArgs).to.have.nested.property('data.clientPayload.translationLanguage', 'es');
      });

      it('does not re-send language when serviceId is unchanged', () => {
        voiceaService.captionServiceId = 'same-svc';
        voiceaService.currentCaptionLanguage = 'de';

        voiceaService.onCaptionServiceIdUpdate('same-svc');

        assert.equal(voiceaService.captionServiceId, 'same-svc');
        assert.notCalled(voiceaService.webex.internal.llm.socket.send);
      });
    });

    describe('#updateSubchannelSubscriptions', () => {
      beforeEach(() => {
        const mockWebSocket = new MockWebSocket();

        sinon.stub(voiceaService, 'getPublishTransport').returns({
          socket: mockWebSocket,
          datachannelUrl: 'mock-datachannel-uri',
        });

        voiceaService.seqNum = 1;

        voiceaService.isLLMConnected = sinon.stub().returns(true);
        voiceaService.webex.internal.llm.isDataChannelTokenEnabled = sinon.stub().resolves(true);
      });

      it('sends subchannelSubscriptionRequest with subscribe and unsubscribe lists', async () => {
        await voiceaService.updateSubchannelSubscriptions({
          subscribe: ['transcription'],
          unsubscribe: ['polls'],
        });

        const socket = voiceaService.getPublishTransport().socket;

        sinon.assert.calledOnceWithExactly(
          socket.send,
          {
            id: '1',
            type: 'subchannelSubscriptionRequest',
            data: {
              datachannelUri: 'mock-datachannel-uri',
              subscribe: ['transcription'],
              unsubscribe: ['polls'],
            },
            trackingId: sinon.match.string,
          }
        );

        sinon.assert.match(voiceaService.seqNum, 2);
      });

      it('sends empty arrays when no subscribe/unsubscribe provided', async () => {
        await voiceaService.updateSubchannelSubscriptions({});

        const socket = voiceaService.getPublishTransport().socket;

        sinon.assert.calledOnceWithExactly(
          socket.send,
          {
            id: '1',
            type: 'subchannelSubscriptionRequest',
            data: {
              datachannelUri: 'mock-datachannel-uri',
              subscribe: [],
              unsubscribe: [],
            },
            trackingId: sinon.match.string,
          }
        );

        sinon.assert.match(voiceaService.seqNum, 2);
      });

      it('does nothing when LLM is not connected', async () => {
        voiceaService.isLLMConnected = sinon.stub().returns(false);

        await voiceaService.updateSubchannelSubscriptions({
          subscribe: ['transcription'],
        });

        const socket = voiceaService.getPublishTransport().socket;

        sinon.assert.notCalled(socket.send);
        sinon.assert.match(voiceaService.seqNum, 1);
      });

      it('does nothing when dataChannelToken is not enabled', async () => {
        voiceaService.webex.internal.llm.isDataChannelTokenEnabled = sinon.stub().resolves(false);

        await voiceaService.updateSubchannelSubscriptions({
          subscribe: ['transcription'],
        });

        const socket = voiceaService.getPublishTransport().socket;

        sinon.assert.notCalled(socket.send);
        sinon.assert.match(voiceaService.seqNum, 1);
      });
    });


    describe('#updateSubchannelSubscriptionsAndSyncCaptionState', () => {
      beforeEach(() => {
        const mockWebSocket = new MockWebSocket();
        voiceaService.webex.internal.llm.socket = mockWebSocket;

        voiceaService.webex.internal.llm.getDatachannelUrl = sinon.stub().returns('mock-datachannel-uri');

        voiceaService.seqNum = 1;

        voiceaService.isLLMConnected = sinon.stub().returns(true);
        voiceaService.webex.internal.llm.isDataChannelTokenEnabled = sinon.stub().resolves(true);

        sinon.spy(voiceaService, 'updateSubchannelSubscriptions');
      });

      afterEach(() => {
        sinon.restore();
      });

      it('updates caption intent and forwards subscribe/unsubscribe to updateSubchannelSubscriptions', async () => {
        await voiceaService.updateSubchannelSubscriptionsAndSyncCaptionState(
          {
            subscribe: ['transcription'],
            unsubscribe: ['polls'],
          },
          true
        );

        assert.equal(voiceaService.isCaptionBoxOn, true);

        assert.calledOnceWithExactly(
          voiceaService.updateSubchannelSubscriptions,
          {
            subscribe: ['transcription'],
            unsubscribe: ['polls'],
          }
        );
      });

      it('sets caption intent to false when isCCBoxOpen is false', async () => {
        await voiceaService.updateSubchannelSubscriptionsAndSyncCaptionState(
          { subscribe: ['transcription'] },
          false
        );

        assert.equal(voiceaService.isCaptionBoxOn, false);

        assert.calledOnceWithExactly(
          voiceaService.updateSubchannelSubscriptions,
          { subscribe: ['transcription'] }
        );
      });

      it('defaults subscribe/unsubscribe to empty arrays when options is empty', async () => {
        await voiceaService.updateSubchannelSubscriptionsAndSyncCaptionState({}, true);

        assert.equal(voiceaService.isCaptionBoxOn, true);

        assert.calledOnceWithExactly(
          voiceaService.updateSubchannelSubscriptions,
          {}
        );
      });

      it('still updates caption intent even if updateSubchannelSubscriptions does nothing (e.g., LLM not connected)', async () => {
        voiceaService.isLLMConnected = sinon.stub().returns(false);

        await voiceaService.updateSubchannelSubscriptionsAndSyncCaptionState(
          { subscribe: ['transcription'] },
          true
        );

        assert.equal(voiceaService.isCaptionBoxOn, true);

        assert.calledOnceWithExactly(
          voiceaService.updateSubchannelSubscriptions,
          { subscribe: ['transcription'] }
        );
      });
    });

    describe('#multiple llm connections', () => {
      let defaultSocket;
      let practiceSocket;
      let isPracticeSessionConnected;

      beforeEach(() => {
        defaultSocket = new MockWebSocket();
        practiceSocket = new MockWebSocket();
        isPracticeSessionConnected = true;

        voiceaService.webex.internal.llm.socket = defaultSocket;
        voiceaService.webex.internal.llm.isConnected.callsFake((channel) =>
          channel === LLM_PRACTICE_SESSION ? isPracticeSessionConnected : true
        );
        voiceaService.webex.internal.llm.getSocket.callsFake((channel) =>
          channel === LLM_PRACTICE_SESSION ? practiceSocket : undefined
        );
        voiceaService.webex.internal.llm.getBinding.callsFake((channel) =>
          channel === LLM_PRACTICE_SESSION ? 'practice-binding' : 'default-binding'
        );
        voiceaService.seqNum = 1;
      });

      it('sendAnnouncement uses the practice session socket and binding when available', () => {
        voiceaService.announceStatus = 'idle';

        voiceaService.sendAnnouncement();

        assert.calledOnce(practiceSocket.send);
        assert.notCalled(defaultSocket.send);

        const sent = practiceSocket.send.getCall(0).args[0];
        expect(sent).to.have.nested.property('recipients.route', 'practice-binding');
      });

      it('sendAnnouncement falls back to the default socket and binding when the practice session is not connected', () => {
        voiceaService.announceStatus = 'idle';
        isPracticeSessionConnected = false;

        voiceaService.sendAnnouncement();

        assert.calledOnce(defaultSocket.send);
        assert.notCalled(practiceSocket.send);

        const sent = defaultSocket.send.getCall(0).args[0];
        expect(sent).to.have.nested.property('recipients.route', 'default-binding');
      });

      it('requestLanguage uses the practice session socket and binding when available', () => {
        voiceaService.requestLanguage('fr');

        assert.calledOnce(practiceSocket.send);
        assert.notCalled(defaultSocket.send);

        const sent = practiceSocket.send.getCall(0).args[0];
        expect(sent).to.have.nested.property('recipients.route', 'practice-binding');
        expect(sent).to.have.nested.property('data.clientPayload.translationLanguage', 'fr');
      });

      it('requestLanguage falls back to the default socket and binding when the practice session is not connected', () => {
        isPracticeSessionConnected = false;

        voiceaService.requestLanguage('fr');

        assert.calledOnce(defaultSocket.send);
        assert.notCalled(practiceSocket.send);

        const sent = defaultSocket.send.getCall(0).args[0];
        expect(sent).to.have.nested.property('recipients.route', 'default-binding');
        expect(sent).to.have.nested.property('data.clientPayload.translationLanguage', 'fr');
      });

      it('sendManualClosedCaption uses the practice session socket and binding when available', () => {
        voiceaService.sendManualClosedCaption('caption', 123, [456], true);

        assert.calledOnce(practiceSocket.send);
        assert.notCalled(defaultSocket.send);

        const sent = practiceSocket.send.getCall(0).args[0];
        expect(sent).to.have.nested.property('recipients.route', 'practice-binding');
        expect(sent).to.have.nested.property(
          'data.transcriptPayload.type',
          'manual_caption_final_result'
        );
      });

      it('sendManualClosedCaption falls back to the default socket and binding when the practice session is not connected', () => {
        isPracticeSessionConnected = false;

        voiceaService.sendManualClosedCaption('caption', 123, [456], false);

        assert.calledOnce(defaultSocket.send);
        assert.notCalled(practiceSocket.send);

        const sent = defaultSocket.send.getCall(0).args[0];
        expect(sent).to.have.nested.property('recipients.route', 'default-binding');
        expect(sent).to.have.nested.property(
          'data.transcriptPayload.type',
          'manual_caption_interim_result'
        );
      });

      it('processes relay events from the practice session channel', async () => {
        const announcementSpy = sinon.spy(voiceaService, 'processAnnouncementMessage');

        voiceaService.listenToEvents();

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService.webex.internal.llm._emit(`event:relay.event:${LLM_PRACTICE_SESSION}`, {
          headers: {from: 'svc-practice'},
          data: {
            relayType: 'voicea.annc',
            voiceaPayload: {
              translation: {allowed_languages: ['en'], max_languages: 1},
              ASR: {spoken_languages: ['en']},
            },
          },
          sequenceNumber: 10,
        });

        assert.calledOnce(announcementSpy);
        assert.equal(voiceaService.captionServiceId, 'svc-practice');
      });
    });
  });
});
