import 'jsdom-global/register';
import MockWebex from '@webex/test-helper-mock-webex';
import MockWebSocket from '@webex/test-helper-mock-web-socket';
import {assert, expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Mercury from '@webex/internal-plugin-mercury';
import LLMChannel from '@webex/internal-plugin-llm';

import VoiceaService from '../../../src/index';
import {EVENT_TRIGGERS} from '../../../src/constants';

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

        assert.calledOnceWithExactly(spy, 'event:relay.event', sinon.match.func);
      });
    });

    describe('#deregisterEvents', () => {
      beforeEach(async () => {
        const mockWebSocket = new MockWebSocket();

        voiceaService.webex.internal.llm.socket = mockWebSocket;
      });

      it('deregisters voicea service', async () => {
        voiceaService.listenToEvents();
        await voiceaService.toggleTranscribing(true);

        // eslint-disable-next-line no-underscore-dangle
        voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {relayType: 'voicea.annc', voiceaPayload: {}},
        });

        assert.equal(voiceaService.areCaptionsEnabled, true);
        assert.equal(voiceaService.vmcDeviceId, 'ws');

        voiceaService.deregisterEvents();
        assert.equal(voiceaService.areCaptionsEnabled, false);
        assert.equal(voiceaService.vmcDeviceId, undefined);
        assert.equal(voiceaService.announceStatus, 'idle');
        assert.equal(voiceaService.captionStatus, 'idle');
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
        });
      });

      it('works on non-empty payload', async () => {
        const spy = sinon.spy();

        voiceaService.on(EVENT_TRIGGERS.VOICEA_ANNOUNCEMENT, spy);
        voiceaService.listenToEvents();
        await voiceaService.processAnnouncementMessage({});
        assert.calledOnceWithExactly(spy, {
          captionLanguages: [],
          spokenLanguages: [],
          maxLanguages: 0,
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
                spokenLanguage: languageCode
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

    describe("#announce", () => {
      let isAnnounceProcessing, sendAnnouncement;
      beforeEach(() => {
        voiceaService.webex.internal.llm.isConnected.returns(true);
        sendAnnouncement = sinon.stub(voiceaService, 'sendAnnouncement');
        isAnnounceProcessing = sinon.stub(voiceaService, 'isAnnounceProcessing').returns(false)
      });

      afterEach(() => {
        voiceaService.webex.internal.llm.isConnected.returns(true);
        isAnnounceProcessing.restore();
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

      it('should not announce duplicate', () => {
        isAnnounceProcessing.returns(true);
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
      let requestTurnOnCaptions, isCaptionProcessing;
      beforeEach(() => {
        requestTurnOnCaptions = sinon.stub(voiceaService, 'requestTurnOnCaptions');
        isCaptionProcessing = sinon.stub(voiceaService, 'isCaptionProcessing').returns(false);
        voiceaService.webex.internal.llm.isConnected.returns(true);
      });

      afterEach(() => {
        requestTurnOnCaptions.restore();
        isCaptionProcessing.restore();
        voiceaService.webex.internal.llm.isConnected.returns(true);
      });

      it('call request turn on captions', () => {
        isCaptionProcessing.returns(false);
        voiceaService.turnOnCaptions();
        assert.calledOnce(requestTurnOnCaptions);
      });

      it("turns on captions before llm connected", () => {
        isCaptionProcessing.returns(false);
        voiceaService.webex.internal.llm.isConnected.returns(true);
        // assert.throws(() => voiceaService.turnOnCaptions(), "can not turn on captions before llm connected");
        assert.notCalled(requestTurnOnCaptions);
      });

      it('should not turn on duplicate when processing', () => {
        isCaptionProcessing.returns(true);
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
      });

      it('turns on manual caption', async () => {
        // Turn on captions
        await voiceaService.turnOnCaptions();

        // eslint-disable-next-line no-underscore-dangle
        voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {relayType: 'voicea.annc', voiceaPayload: {}},
        });

        voiceaService.listenToEvents();

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
        await voiceaService.toggleManualCaption(true);

        voiceaService.listenToEvents();

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
    });

    describe('#processManualTranscription', () => {
      let triggerSpy, functionSpy;

      beforeEach(() => {
        triggerSpy = sinon.spy();
        functionSpy = sinon.spy(voiceaService, 'processManualTranscription');
        voiceaService.listenToEvents();
      });

      it('processes interim manual transcription', async () => {
        voiceaService.on(EVENT_TRIGGERS.NEW_MANUAL_CAPTION, triggerSpy);
        const transcriptPayload = {
          id: "747d711d-3414-fd69-7081-e842649f2d28",
          transcripts: [
            {
              "text": "Good",
            }
          ],
          type: "manual_caption_interim_results",
        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService.webex.internal.llm._emit('event:relay.event', {
          headers: {from: 'ws'},
          data: {relayType: 'aibridge.manual_transcription', transcriptPayload},
        });

        assert.calledOnceWithExactly(functionSpy, transcriptPayload);
        assert.calledOnceWithExactly(triggerSpy, {
          isFinal: false,
          transcriptId: '747d711d-3414-fd69-7081-e842649f2d28',
          transcripts: transcriptPayload.transcripts,
        });
      });

      it('processes final manual transcription', async () => {
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

        assert.calledOnceWithExactly(functionSpy, transcriptPayload);
        assert.calledOnceWithExactly(triggerSpy, {
          isFinal: true,
          transcriptId: '8d226d31-044a-8d11-cc39-cedbde183154',
          transcripts: transcriptPayload.transcripts,
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
  });
});
