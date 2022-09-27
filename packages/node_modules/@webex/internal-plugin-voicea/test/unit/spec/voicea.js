import MockWebex from '@webex/test-helper-mock-webex';
import MockWebSocket from '@webex/test-helper-mock-web-socket';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Mercury from '@webex/internal-plugin-mercury';
import LLMChannel from '@webex/internal-plugin-llm';
import {EVENT_TRIGGERS} from '@webex/internal-plugin-voicea/src/constants';
import VoiceaService from '@webex/internal-plugin-voicea';

describe('plugin-voicea', () => {
  const locusUrl = 'locusUrl';
  const datachannelUrl = 'datachannelUrl';

  describe('voicea', () => {
    let webex, voiceaService;


    beforeEach(() => {
      webex = new MockWebex({
        children: {
          mercury: Mercury,
          llm: LLMChannel,
          voicea: VoiceaService
        },
      });

      voiceaService = webex.internal.voicea;
      voiceaService.connect = sinon.stub().resolves(true);
      voiceaService.request = sinon.stub().resolves({
        headers: {},
        body: ''
      });
      voiceaService.register = sinon.stub().resolves({
        body: {
          binding: 'binding',
          webSocketUrl: 'url'
        }
      });
    });

    describe('#sendAnnouncement', () => {
      beforeEach(async () => {
        await voiceaService.registerAndConnect(locusUrl, datachannelUrl);
        const mockWebSocket = new MockWebSocket();

        voiceaService.socket = mockWebSocket;
      });

      it("sends announcement if voicea hasn't joined", () => {
        voiceaService.sendAnnouncement();
        assert.calledOnceWithExactly(voiceaService.socket.send, {
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
          trackingId: sinon.match.string
        });
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
            spoken_languages: ['en']
          },

          version: 'v2'
        };

        const spy = sinon.spy();

        voiceaService.on(EVENT_TRIGGERS.VOICEA_ANNOUNCEMENT, spy);
        voiceaService.processAnnouncementMessage(voiceaPayload);
        assert.calledOnceWithExactly(spy, {
          captionLanguages: ['af', 'am'],
          spokenLanguages: ['en'],
          maxLanguages: 5
        });
      });

      it('works on non-empty payload', async () => {
        const spy = sinon.spy();

        voiceaService.on(EVENT_TRIGGERS.VOICEA_ANNOUNCEMENT, spy);
        await voiceaService.processAnnouncementMessage({});
        assert.calledOnceWithExactly(spy, {
          captionLanguages: [],
          spokenLanguages: [],
          maxLanguages: 0
        });
      });
    });

    describe('#requestLanguage', () => {
      beforeEach(async () => {
        await voiceaService.registerAndConnect(locusUrl, datachannelUrl);
        const mockWebSocket = new MockWebSocket();

        voiceaService.socket = mockWebSocket;
      });

      it('requests caption language', () => {
        voiceaService.requestLanguage('en');

        assert.calledOnceWithExactly(voiceaService.socket.send, {
          id: '1',
          type: 'publishRequest',
          recipients: {route: undefined},
          headers: {to: undefined},
          data: {
            clientPayload: {
              translationLanguage: 'en',
              id: sinon.match.string
            },
            eventType: 'relay.event',
            relayType: 'voicea.transl.req'
          },
          trackingId: sinon.match.string
        });
      });
    });

    describe('#setSpokenLanguage', () => {
      beforeEach(async () => {
        await voiceaService.registerAndConnect(locusUrl, datachannelUrl);
      });

      it('sets spoken language', async () => {
        const languageCode = 'en';
        const triggerSpy = sinon.spy();

        voiceaService.on(EVENT_TRIGGERS.SPOKEN_LANGUAGE_UPDATE, triggerSpy);
        await voiceaService.setSpokenLanguage(languageCode);

        assert.calledOnceWithExactly(triggerSpy, {languageCode});

        sinon.assert.calledWith(voiceaService.request, sinon.match({
          method: 'PUT',
          url: `${locusUrl}/controls/`,
          body: {languageCode}
        }));
      });
    });

    describe('#turnOnCaptions', () => {
      beforeEach(async () => {
        await voiceaService.registerAndConnect(locusUrl, datachannelUrl);

        const mockWebSocket = new MockWebSocket();

        voiceaService.socket = mockWebSocket;
      });

      it('turns on captions', async () => {
        const announcementSpy = sinon.spy(voiceaService, 'sendAnnouncement');

        const triggerSpy = sinon.spy();

        voiceaService.on(EVENT_TRIGGERS.CAPTIONS_TURNED_ON, triggerSpy);
        await voiceaService.turnOnCaptions();
        sinon.assert.calledWith(voiceaService.request, sinon.match({
          method: 'PUT',
          url: `${locusUrl}/controls/`,
          body: {transcribe: {caption: true}}
        }));

        assert.calledOnceWithExactly(triggerSpy, undefined);
        assert.calledOnce(announcementSpy);
      });

      it('doesn\'t call API on captions', async () => {
        await voiceaService.turnOnCaptions();

        // eslint-disable-next-line no-underscore-dangle
        voiceaService._emit('event:relay.event', {headers: {from: 'ws'}, voiceaPayload: {}, data: {relayType: 'voicea.annc'}});

        const response = await voiceaService.turnOnCaptions();

        assert.equal(response, undefined);
      });
    });

    describe('#toggleTranscribing', () => {
      beforeEach(async () => {
        await voiceaService.registerAndConnect(locusUrl, datachannelUrl);

        const mockWebSocket = new MockWebSocket();

        voiceaService.socket = mockWebSocket;
      });

      it('turns on transcribing with CC enabled', async () => {
        // Turn on captions
        await voiceaService.turnOnCaptions();
        const announcementSpy = sinon.spy(voiceaService, 'sendAnnouncement');

        // eslint-disable-next-line no-underscore-dangle
        voiceaService._emit('event:relay.event', {headers: {from: 'ws'}, voiceaPayload: {}, data: {relayType: 'voicea.annc'}});

        const triggerSpy = sinon.spy();

        voiceaService.on(EVENT_TRIGGERS.TRANSCRIBING_ON, triggerSpy);
        await voiceaService.toggleTranscribing(true);
        sinon.assert.calledWith(voiceaService.request, sinon.match({
          method: 'PUT',
          url: `${locusUrl}/controls/`,
          body: {transcribe: {transcribing: true}}
        }));

        assert.calledOnce(triggerSpy);
        assert.notCalled(announcementSpy);
      });

      it('turns on transcribing with CC disabled', async () => {
        const announcementSpy = sinon.spy(voiceaService, 'sendAnnouncement');

        const triggerSpy = sinon.spy();

        voiceaService.on(EVENT_TRIGGERS.TRANSCRIBING_ON, triggerSpy);
        await voiceaService.toggleTranscribing(true);
        sinon.assert.calledWith(voiceaService.request, sinon.match({
          method: 'PUT',
          url: `${locusUrl}/controls/`,
          body: {transcribe: {transcribing: true}}
        }));

        assert.calledOnce(triggerSpy);
        assert.calledOnce(announcementSpy);
      });

      it('turns off transcribing', async () => {
        await voiceaService.toggleTranscribing(true);

        const announcementSpy = sinon.spy(voiceaService, 'sendAnnouncement');

        const triggerSpy = sinon.spy();

        voiceaService.on(EVENT_TRIGGERS.TRANSCRIBING_OFF, triggerSpy);
        await voiceaService.toggleTranscribing(false);
        sinon.assert.calledWith(voiceaService.request, sinon.match({
          method: 'PUT',
          url: `${locusUrl}/controls/`,
          body: {transcribe: {transcribing: true}}
        }));

        assert.calledOnce(triggerSpy);
        assert.notCalled(announcementSpy);
      });

      it('doesn\'t call API on same value', async () => {
        await voiceaService.toggleTranscribing(true);
        const triggerSpy = sinon.spy();
        const announcementSpy = sinon.spy(voiceaService, 'sendAnnouncement');


        voiceaService.on(EVENT_TRIGGERS.TRANSCRIBING_OFF, triggerSpy);

        await voiceaService.toggleTranscribing(true);

        assert.notCalled(triggerSpy);
        assert.notCalled(announcementSpy);

        sinon.assert.calledTwice(voiceaService.request);
      });
    });

    describe('#processCaptionLanguageResponse', () => {
      it('responds to process caption language', async () => {
        const triggerSpy = sinon.spy();
        const functionSpy = sinon.spy(voiceaService, 'processCaptionLanguageResponse');

        voiceaService.on(EVENT_TRIGGERS.CAPTION_LANGUAGE_UPDATE, triggerSpy);

        // eslint-disable-next-line no-underscore-dangle
        voiceaService._emit('event:relay.event', {
          headers: {from: 'ws'},
          voiceaPayload: {
            statusCode: 200
          },
          data: {relayType: 'voicea.transl.rsp'}
        });

        assert.calledOnceWithExactly(triggerSpy, {statusCode: 200});
        assert.calledOnce(functionSpy);
      });
      it('responds to process caption language for a failed response', async () => {
        const triggerSpy = sinon.spy();
        const functionSpy = sinon.spy(voiceaService, 'processCaptionLanguageResponse');

        voiceaService.on(EVENT_TRIGGERS.CAPTION_LANGUAGE_UPDATE, triggerSpy);

        const payload = {
          errorCode: 300,
          message: 'error text'
        };

        // eslint-disable-next-line no-underscore-dangle
        voiceaService._emit('event:relay.event', {
          headers: {from: 'ws'},
          voiceaPayload: payload,
          data: {relayType: 'voicea.transl.rsp'}
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
      });

      it('processes interim transcription', async () => {
        voiceaService.on(EVENT_TRIGGERS.NEW_CAPTION, triggerSpy);

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

          transcripts: [
            {
              text: 'Hello.',
              csis: [
                3556942592
              ],
              transcript_language_code: 'en',
              translations: {
                fr: 'Bonjour.'
              }
            },
            {
              text: 'This is Webex',
              csis: [
                3556942593
              ],
              transcript_language_code: 'en',
              translations: {
                fr: "C'est Webex"
              }
            }
          ]

        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService._emit('event:relay.event', {
          headers: {from: 'ws'},
          voiceaPayload,
          data: {relayType: 'voicea.transcription'}
        });

        assert.calledOnceWithExactly(functionSpy, voiceaPayload);
        assert.calledOnceWithExactly(triggerSpy, {
          isFinal: false, transcriptId: '3ec73890-bffb-f28b-e77f-99dc13caea7e', translations: undefined, transcript: {text: 'Hello.', csis: [3556942592]}
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
          transcript: {
            alignments: [
              {
                end_millis: 12474,
                start_millis: 12204,
                word: 'Hello?'
              }
            ],
            csis: [
              3556942592
            ],
            end_millis: 13044,
            last_packet_timestamp_ms: 1611653206784,
            start_millis: 12204,
            text: 'Hello?',
            transcript_language_code: 'en'
          },
          transcripts: [
            {
              start_millis: 12204,
              end_millis: 13044,
              text: 'Hello.',
              csis: [
                3556942592
              ],
              transcript_language_code: 'en',
              translations: {
                fr: 'Bonjour.'
              }
            },
            {
              start_millis: 12204,
              end_millis: 13044,
              text: 'This is Webex',
              csis: [
                3556942593
              ],
              transcript_language_code: 'en',
              translations: {
                fr: "C'est Webex"
              }
            }
          ]

        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService._emit('event:relay.event', {
          headers: {from: 'ws'},
          voiceaPayload,
          data: {relayType: 'voicea.transcription'}
        });

        assert.calledOnceWithExactly(functionSpy, voiceaPayload);
        assert.calledOnceWithExactly(triggerSpy, {
          isFinal: true, transcriptId: '3ec73890-bffb-f28b-e77f-99dc13caea7e', translations: undefined, timestamp: '0:01', transcript: {text: 'Hello. This is Webex', csis: [3556942592]}
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
            recording_file_name: 'OkayWebEx_fd5bd0fc-06fb-4fd1-982b-554c4368f101_47900f3f-8579-25eb-3f6a-74d81a3c66a4_2335.8900000000003_2336.79.raw',
            type: 'live-hotword'
          },
          ts: 1616137504.8107769,
          type: 'eva_wake'
        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService._emit('event:relay.event', {
          headers: {from: 'ws'},
          voiceaPayload,
          data: {relayType: 'voicea.transcription'}
        });

        assert.calledOnceWithExactly(functionSpy, voiceaPayload);
        assert.calledOnceWithExactly(triggerSpy, {
          isListening: true
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
          type: 'eva_thanks'
        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService._emit('event:relay.event', {
          headers: {from: 'ws'},
          voiceaPayload,
          data: {relayType: 'voicea.transcription'}
        });

        assert.calledOnceWithExactly(functionSpy, voiceaPayload);
        assert.calledOnceWithExactly(triggerSpy, {
          isListening: false, text: 'OK! Decision created.'
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
          type: 'eva_cancel'
        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService._emit('event:relay.event', {
          headers: {from: 'ws'},
          voiceaPayload,
          data: {relayType: 'voicea.transcription'}
        });

        assert.calledOnceWithExactly(functionSpy, voiceaPayload);
        assert.calledOnceWithExactly(triggerSpy, {
          isListening: false
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
            trigger_info: {type: 'live-hotword'}
          },
          id: 'e6df0262-6289-db2e-581a-d44bb41b1c9c',
          meeting: 'fd5bd0fc-06fb-4fd1-982b-554c4368f101',
          ts: 1616135858.5349569,
          type: 'highlight_created'
        };

        // eslint-disable-next-line no-underscore-dangle
        await voiceaService._emit('event:relay.event', {
          headers: {from: 'ws'},
          voiceaPayload,
          data: {relayType: 'voicea.transcription'}
        });

        assert.calledOnceWithExactly(functionSpy, voiceaPayload);
        assert.calledOnceWithExactly(triggerSpy, {
          csis: [3932881920],
          highlightId: '219af4b1-1579-5106-53ab-f621094a0c5a',
          text: 'Create a decision to move ahead with the last proposal.',
          highlightLabel: 'Decision',
          highlightSource: 'voice-command',
          timestamp: '0:07'
        });
      });
    });
  });
});
