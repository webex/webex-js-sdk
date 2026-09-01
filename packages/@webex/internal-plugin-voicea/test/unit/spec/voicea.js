import 'jsdom-global/register';
import MockWebex from '@webex/test-helper-mock-webex';
import MockWebSocket from '@webex/test-helper-mock-web-socket';
import {assert, expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Mercury from '@webex/internal-plugin-mercury';

import {VoiceaChannel} from '../../../src/voicea';
import {EVENT_TRIGGERS, TOGGLE_MANUAL_CAPTION_STATUS} from '../../../src/constants';

/**
 * Creates a mock LLM channel for testing
 * @param {Object} [options] - Options for the mock channel
 * @param {boolean} [options.isConnected=true] - Whether the channel is connected
 * @param {string} [options.locusUrl] - The locus URL
 * @returns {Object} Mock channel
 */
function createMockLLMChannel(options = {}) {
  const mockWebSocket = new MockWebSocket();
  const {isConnected = true, locusUrl = 'locusUrl'} = options;

  return {
    isConnected: sinon.stub().returns(isConnected),
    getSocket: sinon.stub().returns(mockWebSocket),
    getBinding: sinon.stub().returns('binding'),
    getDatachannelUrl: sinon.stub().returns('datachannelUrl'),
    getLocusUrl: sinon.stub().returns(locusUrl),
    isDataChannelTokenEnabled: sinon.stub().resolves(true),
    on: sinon.stub(),
    off: sinon.stub(),
    once: sinon.stub(),
    socket: mockWebSocket,
  };
}

describe('plugin-voicea', () => {
  const locusUrl = 'locusUrl';

  describe('VoiceaChannel', () => {
    let webex, voiceaChannel, mockLLMChannel, requestStub;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          mercury: Mercury,
        },
      });

      requestStub = sinon.stub().resolves({
        headers: {},
        body: '',
      });

      mockLLMChannel = createMockLLMChannel({locusUrl});
      voiceaChannel = new VoiceaChannel(mockLLMChannel, requestStub);
    });

    afterEach(() => {
      voiceaChannel.deregisterEvents();
      sinon.restore();
    });

    describe('#constructor', () => {
      it('should init status', () => {
        assert.equal(voiceaChannel.getAnnounceStatus(), 'idle');
        assert.equal(voiceaChannel.getCaptionStatus(), 'idle');
      });

      it('should subscribe to relay events when llmChannel is provided', () => {
        assert.calledWith(mockLLMChannel.on, 'event:relay.event', sinon.match.func);
      });

      it('should not subscribe to events when llmChannel is undefined', () => {
        const channelWithoutLLM = new VoiceaChannel(undefined, requestStub);
        // No llmChannel means no subscription, just verify it doesn't throw
        assert.equal(channelWithoutLLM.getAnnounceStatus(), 'idle');
      });
    });

    describe('#sendAnnouncement', () => {
      it("sends announcement if voicea hasn't joined", () => {
        voiceaChannel.sendAnnouncement();
        assert.equal(voiceaChannel.getAnnounceStatus(), 'joining');

        assert.calledOnceWithExactly(mockLLMChannel.socket.send, {
          id: '1',
          type: 'publishRequest',
          recipients: [{route: 'binding'}],
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

      it('includes captionServiceId in headers when set', () => {
        voiceaChannel.captionServiceId = 'svc-123';

        voiceaChannel.sendAnnouncement();

        assert.calledOnceWithExactly(mockLLMChannel.socket.send, {
          id: '1',
          type: 'publishRequest',
          recipients: [{route: 'binding'}],
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
      it('sends interim manual closed caption when connected', () => {
        const text = 'Test interim caption';
        const timeStamp = 1234567890;
        const csis = [123456];
        const isFinal = false;

        voiceaChannel.sendManualClosedCaption(text, timeStamp, csis, isFinal);

        assert.calledOnceWithExactly(mockLLMChannel.socket.send, {
          id: '1',
          type: 'publishRequest',
          recipients: [{route: 'binding'}],
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
        });
      });

      it('sends final manual closed caption when connected', () => {
        const text = 'Test final caption';
        const timeStamp = 9876543210;
        const csis = [654321];
        const isFinal = true;

        voiceaChannel.sendManualClosedCaption(text, timeStamp, csis, isFinal);

        assert.calledOnceWithExactly(mockLLMChannel.socket.send, {
          id: '1',
          type: 'publishRequest',
          recipients: [{route: 'binding'}],
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
        });
      });

      it('does not send if not connected', () => {
        const disconnectedChannel = createMockLLMChannel({isConnected: false});
        const channel = new VoiceaChannel(disconnectedChannel, requestStub);

        channel.sendManualClosedCaption('Should not send', 111, [1], true);

        assert.notCalled(disconnectedChannel.socket.send);
      });
    });

    describe('#deregisterEvents', () => {
      beforeEach(async () => {
        voiceaChannel.keepTranscriptionSubscribed = true;
      });

      it('works when llmChannel is undefined', () => {
        const channelWithoutLLM = new VoiceaChannel(undefined, requestStub);
        channelWithoutLLM.areCaptionsEnabled = true;
        channelWithoutLLM.keepTranscriptionSubscribed = true;

        // Should not throw
        channelWithoutLLM.deregisterEvents();

        assert.equal(channelWithoutLLM.areCaptionsEnabled, false);
        assert.equal(channelWithoutLLM.keepTranscriptionSubscribed, false);
      });

      it('deregisters voicea channel and resets state', () => {
        voiceaChannel.areCaptionsEnabled = true;
        voiceaChannel.captionServiceId = 'ws';
        voiceaChannel.keepTranscriptionSubscribed = true;

        voiceaChannel.deregisterEvents();

        assert.equal(voiceaChannel.areCaptionsEnabled, false);
        assert.equal(voiceaChannel.captionServiceId, undefined);
        assert.equal(voiceaChannel.getAnnounceStatus(), 'idle');
        assert.equal(voiceaChannel.getCaptionStatus(), 'idle');
        assert.equal(voiceaChannel.keepTranscriptionSubscribed, false);
        assert.calledWith(mockLLMChannel.off, 'event:relay.event', sinon.match.func);
      });
    });

    describe('#requestLanguage', () => {
      it('requests caption language', () => {
        voiceaChannel.requestLanguage('en');

        assert.calledOnceWithExactly(mockLLMChannel.socket.send, {
          id: '1',
          type: 'publishRequest',
          recipients: [{route: 'binding'}],
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
        voiceaChannel.captionServiceId = 'svc-456';

        voiceaChannel.requestLanguage('fr');

        assert.calledOnceWithExactly(mockLLMChannel.socket.send, {
          id: '1',
          type: 'publishRequest',
          recipients: [{route: 'binding'}],
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

      it('does not send when not connected', () => {
        const disconnectedChannel = createMockLLMChannel({isConnected: false});
        const channel = new VoiceaChannel(disconnectedChannel, requestStub);

        channel.requestLanguage('en');

        assert.notCalled(disconnectedChannel.socket.send);
      });
    });

    describe('#setSpokenLanguage', () => {
      it('sets spoken language', async () => {
        const languageCode = 'en';
        const triggerSpy = sinon.spy();

        voiceaChannel.on(EVENT_TRIGGERS.SPOKEN_LANGUAGE_UPDATE, triggerSpy);
        await voiceaChannel.setSpokenLanguage(languageCode);

        assert.calledOnceWithExactly(triggerSpy, {languageCode});

        sinon.assert.calledWith(
          requestStub,
          sinon.match({
            method: 'PUT',
            url: `${locusUrl}/controls/`,
            body: {
              transcribe: {
                spokenLanguage: languageCode,
              },
            },
          })
        );
      });

      it('sets spoken language with language assignment', async () => {
        const languageCode = 'zh';
        const languageAssignment = 'DEFAULT';

        await voiceaChannel.setSpokenLanguage(languageCode, languageAssignment);

        sinon.assert.calledWith(
          requestStub,
          sinon.match({
            method: 'PUT',
            url: `${locusUrl}/controls/`,
            body: {
              transcribe: {
                spokenLanguage: languageCode,
                languageAssignment,
              },
            },
          })
        );
      });
    });

    describe('#isLLMConnected', () => {
      it('returns true when the LLM channel is connected', () => {
        assert.equal(voiceaChannel.isLLMConnected(), true);
      });

      it('returns false when the LLM channel is not connected', () => {
        mockLLMChannel.isConnected.returns(false);
        assert.equal(voiceaChannel.isLLMConnected(), false);
      });

      it('returns false when the LLM channel is undefined', () => {
        const channelWithoutLLM = new VoiceaChannel(undefined, requestStub);
        assert.equal(channelWithoutLLM.isLLMConnected(), false);
      });
    });

    describe('#getKeepTranscriptionSubscribed', () => {
      it('returns false when keepTranscriptionSubscribed is false', () => {
        voiceaChannel.keepTranscriptionSubscribed = false;
        assert.equal(voiceaChannel.getKeepTranscriptionSubscribed(), false);
      });

      it('returns true when keepTranscriptionSubscribed is true', () => {
        voiceaChannel.keepTranscriptionSubscribed = true;
        assert.equal(voiceaChannel.getKeepTranscriptionSubscribed(), true);
      });
    });

    describe('#announce', () => {
      it('announce to llm data channel', () => {
        const sendAnnouncementSpy = sinon.spy(voiceaChannel, 'sendAnnouncement');
        voiceaChannel.announce();
        assert.calledOnce(sendAnnouncementSpy);
      });

      it('throws when llm is not connected', () => {
        mockLLMChannel.isConnected.returns(false);
        assert.throws(
          () => voiceaChannel.announce(),
          'voicea can not announce before llm connected'
        );
      });

      it('should not announce duplicate when already processed', () => {
        voiceaChannel.announceStatus = 'joined';
        const sendAnnouncementSpy = sinon.spy(voiceaChannel, 'sendAnnouncement');
        voiceaChannel.announce();
        assert.notCalled(sendAnnouncementSpy);
      });
    });

    describe('#turnOnCaptions', () => {
      it('turns on captions', async () => {
        const announceSpy = sinon.spy(voiceaChannel, 'announce');
        const triggerSpy = sinon.spy();

        voiceaChannel.on(EVENT_TRIGGERS.CAPTIONS_TURNED_ON, triggerSpy);

        await voiceaChannel.turnOnCaptions();

        assert.equal(voiceaChannel.getCaptionStatus(), 'enabled');
        assert.calledOnce(announceSpy);
        assert.calledOnce(triggerSpy);
      });

      it('throws when llm is not connected', async () => {
        mockLLMChannel.isConnected.returns(false);

        await assert.isRejected(
          voiceaChannel.turnOnCaptions(),
          'can not turn on captions before llm connected'
        );
      });

      it('returns undefined when already sending', async () => {
        voiceaChannel.captionStatus = 'sending';
        const result = await voiceaChannel.turnOnCaptions();
        assert.equal(result, undefined);
      });

      it('throws error on request failure', async () => {
        requestStub.rejects(new Error('Request failed'));

        await assert.isRejected(voiceaChannel.turnOnCaptions(), 'turn on captions fail');
      });

      it('resets caption status to idle on error', async () => {
        requestStub.rejects(new Error('Request failed'));

        try {
          await voiceaChannel.turnOnCaptions();
        } catch {
          // expected
        }

        assert.equal(voiceaChannel.getCaptionStatus(), 'idle');
      });
    });

    describe('#toggleTranscribing', () => {
      it('turns on transcribing', async () => {
        await voiceaChannel.toggleTranscribing(true);

        sinon.assert.calledWith(
          requestStub,
          sinon.match({
            method: 'PUT',
            url: `${locusUrl}/controls/`,
            body: {transcribe: {transcribing: true}},
          })
        );
      });

      it('turns off transcribing', async () => {
        await voiceaChannel.toggleTranscribing(false);

        sinon.assert.calledWith(
          requestStub,
          sinon.match({
            method: 'PUT',
            url: `${locusUrl}/controls/`,
            body: {transcribe: {transcribing: false}},
          })
        );
      });

      it('calls turnOnCaptions when activating and captions not enabled', async () => {
        voiceaChannel.areCaptionsEnabled = false;
        const turnOnCaptionsSpy = sinon.spy(voiceaChannel, 'turnOnCaptions');

        await voiceaChannel.toggleTranscribing(true, 'en');

        assert.calledOnceWithExactly(turnOnCaptionsSpy, 'en');
      });

      it('does not call turnOnCaptions when captions already enabled', async () => {
        voiceaChannel.areCaptionsEnabled = true;
        const turnOnCaptionsSpy = sinon.spy(voiceaChannel, 'turnOnCaptions');

        await voiceaChannel.toggleTranscribing(true);

        assert.notCalled(turnOnCaptionsSpy);
      });
    });

    describe('#toggleManualCaption', () => {
      it('turns on manual caption', async () => {
        await voiceaChannel.toggleManualCaption(true);

        sinon.assert.calledWith(
          requestStub,
          sinon.match({
            method: 'PUT',
            url: `${locusUrl}/controls/`,
            body: {manualCaption: {enable: true}},
          })
        );
      });

      it('turns off manual caption', async () => {
        await voiceaChannel.toggleManualCaption(false);

        sinon.assert.calledWith(
          requestStub,
          sinon.match({
            method: 'PUT',
            url: `${locusUrl}/controls/`,
            body: {manualCaption: {enable: false}},
          })
        );
      });

      it('ignores when already sending', async () => {
        voiceaChannel.toggleManualCaptionStatus = TOGGLE_MANUAL_CAPTION_STATUS.SENDING;
        await voiceaChannel.toggleManualCaption(true);
        sinon.assert.notCalled(requestStub);
      });

      it('throws error on request failure', async () => {
        requestStub.rejects(new Error('Request failed'));

        await assert.isRejected(
          voiceaChannel.toggleManualCaption(true),
          'toggle manual captions fail'
        );
      });

      it('resets status to idle on error', async () => {
        requestStub.rejects(new Error('Request failed'));

        try {
          await voiceaChannel.toggleManualCaption(true);
        } catch {
          // expected
        }

        assert.equal(voiceaChannel.toggleManualCaptionStatus, TOGGLE_MANUAL_CAPTION_STATUS.IDLE);
      });
    });

    describe('#getCaptionStatus', () => {
      it('returns current caption status', () => {
        voiceaChannel.captionStatus = 'enabled';
        assert.equal(voiceaChannel.getCaptionStatus(), 'enabled');
      });
    });

    describe('#getAnnounceStatus', () => {
      it('returns current announce status', () => {
        voiceaChannel.announceStatus = 'joined';
        assert.equal(voiceaChannel.getAnnounceStatus(), 'joined');
      });
    });

    describe('#onSpokenLanguageUpdate', () => {
      it('should trigger SPOKEN_LANGUAGE_UPDATE event', () => {
        const triggerSpy = sinon.spy();
        voiceaChannel.on(EVENT_TRIGGERS.SPOKEN_LANGUAGE_UPDATE, triggerSpy);

        voiceaChannel.onSpokenLanguageUpdate('fr', '123');

        assert.equal(voiceaChannel.currentSpokenLanguage, 'fr');
        assert.calledOnceWithExactly(triggerSpy, {languageCode: 'fr', meetingId: '123'});
      });
    });

    describe('#onCaptionServiceIdUpdate', () => {
      it('does nothing when serviceId is falsy', () => {
        voiceaChannel.captionServiceId = 'existing-id';
        voiceaChannel.onCaptionServiceIdUpdate(undefined);
        voiceaChannel.onCaptionServiceIdUpdate('');
        assert.equal(voiceaChannel.captionServiceId, 'existing-id');
      });

      it('sets captionServiceId when no currentCaptionLanguage', () => {
        voiceaChannel.captionServiceId = undefined;
        voiceaChannel.currentCaptionLanguage = undefined;
        voiceaChannel.onCaptionServiceIdUpdate('svc-new');
        assert.equal(voiceaChannel.captionServiceId, 'svc-new');
      });

      it('re-sends language when serviceId changes and currentCaptionLanguage is set', () => {
        voiceaChannel.captionServiceId = 'old-svc';
        voiceaChannel.currentCaptionLanguage = 'es';

        voiceaChannel.onCaptionServiceIdUpdate('new-svc');

        assert.equal(voiceaChannel.captionServiceId, 'new-svc');
        assert.calledOnce(mockLLMChannel.socket.send);
      });
    });

    describe('#updateSubchannelSubscriptions', () => {
      it('sends subchannelSubscriptionRequest', async () => {
        await voiceaChannel.updateSubchannelSubscriptions({
          subscribe: ['transcription'],
          unsubscribe: ['polls'],
        });

        sinon.assert.calledOnceWithExactly(mockLLMChannel.socket.send, {
          id: '1',
          type: 'subchannelSubscriptionRequest',
          data: {
            datachannelUri: 'datachannelUrl',
            subscribe: ['transcription'],
            unsubscribe: ['polls'],
          },
          trackingId: sinon.match.string,
        });
      });

      it('does nothing when LLM is not connected', async () => {
        mockLLMChannel.isConnected.returns(false);

        await voiceaChannel.updateSubchannelSubscriptions({subscribe: ['transcription']});

        sinon.assert.notCalled(mockLLMChannel.socket.send);
      });

      it('does nothing when dataChannelToken is not enabled', async () => {
        mockLLMChannel.isDataChannelTokenEnabled.resolves(false);

        await voiceaChannel.updateSubchannelSubscriptions({subscribe: ['transcription']});

        sinon.assert.notCalled(mockLLMChannel.socket.send);
      });
    });

    describe('#updateSubchannelSubscriptionsAndSyncCaptionState', () => {
      it('updates caption intent and forwards to updateSubchannelSubscriptions', async () => {
        const updateSpy = sinon.spy(voiceaChannel, 'updateSubchannelSubscriptions');

        await voiceaChannel.updateSubchannelSubscriptionsAndSyncCaptionState(
          {subscribe: ['transcription']},
          true
        );

        assert.equal(voiceaChannel.getKeepTranscriptionSubscribed(), true);
        assert.calledOnceWithExactly(updateSpy, {subscribe: ['transcription']});
      });

      it('sets caption intent to false when isCCBoxOpen is false', async () => {
        const updateSpy = sinon.spy(voiceaChannel, 'updateSubchannelSubscriptions');

        await voiceaChannel.updateSubchannelSubscriptionsAndSyncCaptionState(
          {subscribe: ['transcription']},
          false
        );

        assert.equal(voiceaChannel.getKeepTranscriptionSubscribed(), false);
        assert.calledOnceWithExactly(updateSpy, {subscribe: ['transcription']});
      });

      it('defaults subscribe/unsubscribe to empty arrays when options is empty', async () => {
        const updateSpy = sinon.spy(voiceaChannel, 'updateSubchannelSubscriptions');

        await voiceaChannel.updateSubchannelSubscriptionsAndSyncCaptionState({}, true);

        assert.equal(voiceaChannel.getKeepTranscriptionSubscribed(), true);
        assert.calledOnceWithExactly(updateSpy, {});
      });

      it('still updates caption intent even if updateSubchannelSubscriptions does nothing (e.g., LLM not connected)', async () => {
        mockLLMChannel.isConnected.returns(false);
        const updateSpy = sinon.spy(voiceaChannel, 'updateSubchannelSubscriptions');

        await voiceaChannel.updateSubchannelSubscriptionsAndSyncCaptionState(
          {subscribe: ['transcription']},
          true
        );

        assert.equal(voiceaChannel.getKeepTranscriptionSubscribed(), true);
        assert.calledOnceWithExactly(updateSpy, {subscribe: ['transcription']});
      });
    });

    describe('event processor', () => {
      let eventHandler;

      beforeEach(() => {
        // Get the registered event handler
        const onCall = mockLLMChannel.on
          .getCalls()
          .find((call) => call.args[0] === 'event:relay.event');
        eventHandler = onCall?.args[1];
      });

      it('processes voicea announcement events', () => {
        const spy = sinon.spy();
        voiceaChannel.on(EVENT_TRIGGERS.VOICEA_ANNOUNCEMENT, spy);

        eventHandler({
          sequenceNumber: 1,
          headers: {from: 'ws-service'},
          data: {
            relayType: 'voicea.annc',
            voiceaPayload: {
              translation: {allowed_languages: ['en', 'es'], max_languages: 3},
              ASR: {spoken_languages: ['en']},
            },
          },
        });

        assert.equal(voiceaChannel.getAnnounceStatus(), 'joined');
        assert.calledOnceWithExactly(spy, {
          captionLanguages: ['en', 'es'],
          maxLanguages: 3,
          spokenLanguages: ['en'],
          currentSpokenLanguage: 'en',
        });
      });

      it('processes voicea announcement with empty payload', () => {
        const spy = sinon.spy();
        voiceaChannel.on(EVENT_TRIGGERS.VOICEA_ANNOUNCEMENT, spy);

        eventHandler({
          sequenceNumber: 1,
          headers: {from: 'ws-service'},
          data: {
            relayType: 'voicea.annc',
            voiceaPayload: {},
          },
        });

        assert.calledOnceWithExactly(spy, {
          captionLanguages: [],
          maxLanguages: 0,
          spokenLanguages: [],
          currentSpokenLanguage: 'en',
        });
      });

      it('processes transcription interim results', () => {
        const spy = sinon.spy();
        voiceaChannel.on(EVENT_TRIGGERS.NEW_CAPTION, spy);

        eventHandler({
          sequenceNumber: 1,
          headers: {},
          data: {
            relayType: 'voicea.transcription',
            voiceaPayload: {
              type: 'transcript_interim_results',
              transcript_id: 'tid-1',
              transcripts: [{text: 'Hello'}],
            },
          },
        });

        assert.calledOnceWithExactly(spy, {
          isFinal: false,
          transcriptId: 'tid-1',
          transcripts: [{text: 'Hello'}],
        });
      });

      it('processes transcription final results', () => {
        const spy = sinon.spy();
        voiceaChannel.on(EVENT_TRIGGERS.NEW_CAPTION, spy);

        eventHandler({
          sequenceNumber: 1,
          headers: {},
          data: {
            relayType: 'voicea.transcription',
            voiceaPayload: {
              type: 'transcript_final_result',
              transcript_id: 'tid-2',
              transcripts: [{text: 'Hello world', end_millis: 60000}],
            },
          },
        });

        assert.calledOnce(spy);
        const call = spy.getCall(0);
        assert.equal(call.args[0].isFinal, true);
        assert.equal(call.args[0].transcriptId, 'tid-2');
      });

      it('processes caption language response success', () => {
        const spy = sinon.spy();
        voiceaChannel.on(EVENT_TRIGGERS.CAPTION_LANGUAGE_UPDATE, spy);

        eventHandler({
          sequenceNumber: 1,
          headers: {},
          data: {
            relayType: 'voicea.transl.rsp',
            voiceaPayload: {statusCode: 200},
          },
        });

        assert.calledOnceWithExactly(spy, {statusCode: 200});
      });

      it('processes caption language response error', () => {
        const spy = sinon.spy();
        voiceaChannel.on(EVENT_TRIGGERS.CAPTION_LANGUAGE_UPDATE, spy);

        eventHandler({
          sequenceNumber: 1,
          headers: {},
          data: {
            relayType: 'voicea.transl.rsp',
            voiceaPayload: {statusCode: 400, errorCode: 400, message: 'Bad request'},
          },
        });

        assert.calledOnceWithExactly(spy, {statusCode: 400, errorMessage: 'Bad request'});
      });

      it('processes manual transcription events', () => {
        const spy = sinon.spy();
        voiceaChannel.on(EVENT_TRIGGERS.NEW_MANUAL_CAPTION, spy);

        eventHandler({
          sequenceNumber: 1,
          headers: {from: 'user-1'},
          data: {
            relayType: 'client.manual_transcription',
            transcriptPayload: {
              type: 'manual_caption_final_result',
              id: 'manual-id',
              transcripts: [{text: 'Manual caption'}],
            },
          },
        });

        assert.calledOnce(spy);
        const call = spy.getCall(0);
        assert.equal(call.args[0].isFinal, true);
        assert.equal(call.args[0].transcriptId, 'manual-id');
      });

      it('processes highlight created events', () => {
        const spy = sinon.spy();
        voiceaChannel.on(EVENT_TRIGGERS.HIGHLIGHT_CREATED, spy);

        eventHandler({
          sequenceNumber: 1,
          headers: {},
          data: {
            relayType: 'voicea.transcription',
            voiceaPayload: {
              type: 'highlight_created',
              highlight: {
                csis: [123],
                highlight_id: 'h-1',
                transcript: 'Highlighted text',
                highlight_label: 'important',
                highlight_source: 'user',
                end_millis: 30000,
              },
            },
          },
        });

        assert.calledOnce(spy);
      });

      it('processes eva wake events', () => {
        const spy = sinon.spy();
        voiceaChannel.on(EVENT_TRIGGERS.EVA_COMMAND, spy);

        eventHandler({
          sequenceNumber: 1,
          headers: {},
          data: {
            relayType: 'voicea.transcription',
            voiceaPayload: {type: 'eva_wake'},
          },
        });

        assert.calledOnceWithExactly(spy, {isListening: true});
      });

      it('processes eva cancel events', () => {
        const spy = sinon.spy();
        voiceaChannel.on(EVENT_TRIGGERS.EVA_COMMAND, spy);

        eventHandler({
          sequenceNumber: 1,
          headers: {},
          data: {
            relayType: 'voicea.transcription',
            voiceaPayload: {type: 'eva_cancel'},
          },
        });

        assert.calledOnceWithExactly(spy, {isListening: false});
      });

      it('processes eva thanks events', () => {
        const spy = sinon.spy();
        voiceaChannel.on(EVENT_TRIGGERS.EVA_COMMAND, spy);

        eventHandler({
          sequenceNumber: 1,
          headers: {},
          data: {
            relayType: 'voicea.transcription',
            voiceaPayload: {type: 'eva_thanks', command_response: 'OK, noted'},
          },
        });

        assert.calledOnceWithExactly(spy, {isListening: false, text: 'OK, noted'});
      });

      it('processes language detected when in spoken languages', () => {
        const spy = sinon.spy();
        voiceaChannel.on(EVENT_TRIGGERS.LANGUAGE_DETECTED, spy);

        // First set up spoken languages via announcement
        eventHandler({
          sequenceNumber: 1,
          headers: {from: 'ws-service'},
          data: {
            relayType: 'voicea.annc',
            voiceaPayload: {
              ASR: {spoken_languages: ['en', 'es', 'fr']},
            },
          },
        });

        // Then emit language detected
        eventHandler({
          sequenceNumber: 2,
          headers: {},
          data: {
            relayType: 'voicea.transcription',
            voiceaPayload: {type: 'language_detected', language: 'es'},
          },
        });

        assert.calledOnceWithExactly(spy, {languageCode: 'es'});
      });

      it('does not emit language detected when not in spoken languages', () => {
        const spy = sinon.spy();
        voiceaChannel.on(EVENT_TRIGGERS.LANGUAGE_DETECTED, spy);

        // First set up spoken languages via announcement
        eventHandler({
          sequenceNumber: 1,
          headers: {from: 'ws-service'},
          data: {
            relayType: 'voicea.annc',
            voiceaPayload: {
              ASR: {spoken_languages: ['en', 'es']},
            },
          },
        });

        // Then emit language detected for unsupported language
        eventHandler({
          sequenceNumber: 2,
          headers: {},
          data: {
            relayType: 'voicea.transcription',
            voiceaPayload: {type: 'language_detected', language: 'de'},
          },
        });

        assert.notCalled(spy);
      });
    });

    describe('#switchLLMChannel', () => {
      it('switches to a new LLM channel and preserves caption state', async () => {
        // First enable captions
        voiceaChannel.keepTranscriptionSubscribed = true;
        voiceaChannel.currentSpokenLanguage = 'es';

        const newMockLLMChannel = createMockLLMChannel({locusUrl: 'newLocusUrl'});

        await voiceaChannel.switchLLMChannel(newMockLLMChannel);

        // Wait for fire-and-forget turnOnCaptions to complete
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Should have unsubscribed from old channel
        assert.calledWith(mockLLMChannel.off, 'event:relay.event', sinon.match.func);

        // Should have subscribed to new channel
        assert.calledWith(newMockLLMChannel.on, 'event:relay.event', sinon.match.func);

        // Should have reset announcement state to joining (since captions were on and it re-announced)
        assert.equal(voiceaChannel.getAnnounceStatus(), 'joining');

        // turnOnCaptions sends both an announcement and a subchannel subscription
        assert.calledTwice(newMockLLMChannel.socket.send);

        // First call should be the announcement
        assert.calledWithExactly(newMockLLMChannel.socket.send.getCall(0), {
          id: '1',
          type: 'publishRequest',
          recipients: [{route: 'binding'}],
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

      it('skips switch when already on the same channel', async () => {
        // Enable captions to verify they are NOT re-enabled on no-op switch
        voiceaChannel.keepTranscriptionSubscribed = true;
        voiceaChannel.currentSpokenLanguage = 'es';

        // Switch to the same channel that voiceaChannel is already using
        await voiceaChannel.switchLLMChannel(mockLLMChannel);

        // Should NOT have unsubscribed (no-op)
        assert.notCalled(mockLLMChannel.off);

        // Should NOT have re-subscribed
        // The 'on' was already called in the constructor, but no NEW calls should happen
        // Since constructor already called 'on', we check it wasn't called again after construction
        // The mock was created fresh, so we just verify no additional sends
        assert.notCalled(mockLLMChannel.socket.send);
      });

      it('does not turn on captions if they were not on before switching', async () => {
        // Captions are off
        voiceaChannel.keepTranscriptionSubscribed = false;

        const newMockLLMChannel = createMockLLMChannel({locusUrl: 'newLocusUrl'});

        await voiceaChannel.switchLLMChannel(newMockLLMChannel);

        // Should have unsubscribed from old channel
        assert.calledWith(mockLLMChannel.off, 'event:relay.event', sinon.match.func);

        // Should have subscribed to new channel
        assert.calledWith(newMockLLMChannel.on, 'event:relay.event', sinon.match.func);

        // Should NOT have sent any messages (no announcement for captions)
        assert.notCalled(newMockLLMChannel.socket.send);

        // State should be idle since captions weren't re-enabled
        assert.equal(voiceaChannel.getAnnounceStatus(), 'idle');
      });

      it('handles case when not previously subscribed to events', async () => {
        // Create a new channel that hasn't subscribed to events
        const freshVoiceaChannel = new VoiceaChannel(mockLLMChannel, requestStub);
        freshVoiceaChannel.hasSubscribedToEvents = false;

        const newMockLLMChannel = createMockLLMChannel({locusUrl: 'newLocusUrl'});

        await freshVoiceaChannel.switchLLMChannel(newMockLLMChannel);

        // Should NOT have tried to unsubscribe from old channel (wasn't subscribed)
        assert.neverCalledWith(mockLLMChannel.off, 'event:relay.event', sinon.match.func);

        // Should have subscribed to new channel
        assert.calledWith(newMockLLMChannel.on, 'event:relay.event', sinon.match.func);
      });

      it('switches from undefined llmChannel to a valid one', async () => {
        // Create a channel without llmChannel
        const channelWithoutLLM = new VoiceaChannel(undefined, requestStub);

        const newMockLLMChannel = createMockLLMChannel({locusUrl: 'newLocusUrl'});

        await channelWithoutLLM.switchLLMChannel(newMockLLMChannel);

        // Should have subscribed to new channel
        assert.calledWith(newMockLLMChannel.on, 'event:relay.event', sinon.match.func);

        // isLLMConnected should now return true
        assert.equal(channelWithoutLLM.isLLMConnected(), true);
      });

      it('defers caption restoration when new channel is not connected', async () => {
        // Enable captions
        voiceaChannel.keepTranscriptionSubscribed = true;
        voiceaChannel.currentSpokenLanguage = 'fr';

        // Create a new channel that is NOT connected yet
        const newMockLLMChannel = createMockLLMChannel({
          isConnected: false,
          locusUrl: 'newLocusUrl',
        });

        await voiceaChannel.switchLLMChannel(newMockLLMChannel);

        // Should have subscribed to new channel events
        assert.calledWith(newMockLLMChannel.on, 'event:relay.event', sinon.match.func);

        // Should have registered a 'once' listener for 'online' event
        assert.calledWith(newMockLLMChannel.once, 'online', sinon.match.func);

        // Should NOT have sent any messages yet (waiting for connection)
        assert.notCalled(newMockLLMChannel.socket.send);
      });

      it('restores captions when deferred channel comes online', async () => {
        // Enable captions
        voiceaChannel.keepTranscriptionSubscribed = true;
        voiceaChannel.currentSpokenLanguage = 'de';

        // Create a new channel that is NOT connected yet
        const newMockLLMChannel = createMockLLMChannel({
          isConnected: false,
          locusUrl: 'newLocusUrl',
        });

        await voiceaChannel.switchLLMChannel(newMockLLMChannel);

        // Get the 'online' listener that was registered
        const onlineListener = newMockLLMChannel.once.getCall(0).args[1];

        // Simulate channel coming online
        newMockLLMChannel.isConnected.returns(true);
        onlineListener();

        // Wait for async turnOnCaptions to complete
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Now it should have sent messages (announcement + subchannel subscription)
        assert.calledTwice(newMockLLMChannel.socket.send);
      });

      it('removes pending online listener when deregisterEvents is called', async () => {
        // Enable captions
        voiceaChannel.keepTranscriptionSubscribed = true;

        // Create a new channel that is NOT connected yet
        const newMockLLMChannel = createMockLLMChannel({
          isConnected: false,
          locusUrl: 'newLocusUrl',
        });

        await voiceaChannel.switchLLMChannel(newMockLLMChannel);

        // Get the 'online' listener that was registered
        const onlineListener = newMockLLMChannel.once.getCall(0).args[1];

        // Now deregister events
        voiceaChannel.deregisterEvents();

        // Should have removed the 'online' listener
        assert.calledWith(newMockLLMChannel.off, 'online', onlineListener);
      });

      it('removes old pending online listener when switching channels again', async () => {
        // Enable captions
        voiceaChannel.keepTranscriptionSubscribed = true;

        // Create first new channel that is NOT connected
        const firstNewChannel = createMockLLMChannel({isConnected: false, locusUrl: 'firstUrl'});

        await voiceaChannel.switchLLMChannel(firstNewChannel);

        // Get the 'online' listener registered on first channel
        const firstOnlineListener = firstNewChannel.once.getCall(0).args[1];

        // Now switch to another channel (also not connected)
        const secondNewChannel = createMockLLMChannel({isConnected: false, locusUrl: 'secondUrl'});

        await voiceaChannel.switchLLMChannel(secondNewChannel);

        // Should have removed the 'online' listener from first channel
        assert.calledWith(firstNewChannel.off, 'online', firstOnlineListener);

        // Should have registered a new 'online' listener on second channel
        assert.calledWith(secondNewChannel.once, 'online', sinon.match.func);
      });

      it('does not duplicate caption HTTP requests on concurrent same-channel switches', async () => {
        // Enable captions
        voiceaChannel.keepTranscriptionSubscribed = true;
        voiceaChannel.currentSpokenLanguage = 'en';

        const newMockLLMChannel = createMockLLMChannel({locusUrl: 'newLocusUrl'});

        // Simulate concurrent switches to the same channel
        const switch1 = voiceaChannel.switchLLMChannel(newMockLLMChannel);
        const switch2 = voiceaChannel.switchLLMChannel(newMockLLMChannel);

        await Promise.all([switch1, switch2]);

        // Wait for fire-and-forget turnOnCaptions to complete
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Should only have sent 2 messages total (announcement + subchannel subscription)
        // NOT 4 messages (which would indicate duplicate switches)
        assert.calledTwice(newMockLLMChannel.socket.send);
      });
    });

    describe('#requireLLMChannel', () => {
      it('throws when llmChannel is undefined', () => {
        const channelWithoutLLM = new VoiceaChannel(undefined, requestStub);

        assert.throws(
          () => channelWithoutLLM.sendAnnouncement(),
          'VoiceaChannel: LLM channel not available'
        );
      });

      it('does not throw when llmChannel is defined', () => {
        // voiceaChannel has a mockLLMChannel, so this should not throw
        assert.doesNotThrow(() => voiceaChannel.sendAnnouncement());
      });
    });
  });
});
