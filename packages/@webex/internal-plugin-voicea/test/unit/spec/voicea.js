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
    socket: mockWebSocket,
  };
}

describe('plugin-voicea', () => {
  const locusUrl = 'locusUrl';

  describe('VoiceaChannel', () => {
    let webex, voiceaChannel, mockLLMChannel;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          mercury: Mercury,
        },
      });

      mockLLMChannel = createMockLLMChannel({locusUrl});
      voiceaChannel = new VoiceaChannel(mockLLMChannel, webex);

      webex.request = sinon.stub().resolves({
        headers: {},
        body: '',
      });
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

      it('should subscribe to relay events', () => {
        assert.calledWith(mockLLMChannel.on, 'event:relay.event', sinon.match.func);
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
        const channel = new VoiceaChannel(disconnectedChannel, webex);

        channel.sendManualClosedCaption('Should not send', 111, [1], true);

        assert.notCalled(disconnectedChannel.socket.send);
      });
    });

    describe('#deregisterEvents', () => {

      beforeEach(async () => {
        voiceaChannel.keepTranscriptionSubscribed = true;
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
        assert.equal(voiceaChannel.getIsCaptionBoxOn(), false);
        assert.calledWith(mockLLMChannel.off, 'event:relay.event', sinon.match.func);
      });
    });

    describe('#requestLanguage', () => {
      it('requests caption language', () => {
        voiceaChannel.requestLanguage('en');

        assert.calledOnceWithExactly(mockLLMChannel.socket.send, {
          id: '1',
          type: 'publishRequest',
          recipients: [{route: undefined}],
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
          recipients: [{route: undefined}],
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
        const channel = new VoiceaChannel(disconnectedChannel, webex);

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
          webex.request,
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
          webex.request,
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

    describe('#getIsCaptionBoxOn', () => {
      it('returns false when isCaptionBoxOn is false', () => {
        voiceaChannel.isCaptionBoxOn = false;
        assert.equal(voiceaChannel.getIsCaptionBoxOn(), false);
      });

      it('returns true when isCaptionBoxOn is true', () => {
        voiceaChannel.isCaptionBoxOn = true;
        assert.equal(voiceaChannel.getIsCaptionBoxOn(), true);
      });
    });

    describe('#isAnnounceProcessing', () => {
      ['joining', 'joined'].forEach((status) => {
        it(`should return true when status is ${status}`, () => {
          voiceaChannel.announceStatus = status;
          assert.equal(voiceaChannel.isAnnounceProcessing(), true);
        });
      });

      it('should return false when status is idle', () => {
        voiceaChannel.announceStatus = 'idle';
        assert.equal(voiceaChannel.isAnnounceProcessing(), false);
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

    describe('#isCaptionProcessing', () => {
      ['sending', 'enabled'].forEach((status) => {
        it(`should return true when status is ${status}`, () => {
          voiceaChannel.captionStatus = status;
          assert.equal(voiceaChannel.isCaptionProcessing(), true);
        });
      });

      it('should return false when status is idle', () => {
        voiceaChannel.captionStatus = 'idle';
        assert.equal(voiceaChannel.isCaptionProcessing(), false);
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
        webex.request.rejects(new Error('Request failed'));

        await assert.isRejected(voiceaChannel.turnOnCaptions(), 'turn on captions fail');
      });

      it('resets caption status to idle on error', async () => {
        webex.request.rejects(new Error('Request failed'));

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
          webex.request,
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
          webex.request,
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
          webex.request,
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
          webex.request,
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
        sinon.assert.notCalled(webex.request);
      });

      it('throws error on request failure', async () => {
        webex.request.rejects(new Error('Request failed'));

        await assert.isRejected(
          voiceaChannel.toggleManualCaption(true),
          'toggle manual captions fail'
        );
      });

      it('resets status to idle on error', async () => {
        webex.request.rejects(new Error('Request failed'));

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

    describe('#isAnnounceProcessed', () => {
      it('returns true when status is joined', () => {
        voiceaChannel.announceStatus = 'joined';
        assert.equal(voiceaChannel.isAnnounceProcessed(), true);
      });

      it('returns false when status is idle', () => {
        voiceaChannel.announceStatus = 'idle';
        assert.equal(voiceaChannel.isAnnounceProcessed(), false);
      });

      it('returns false when status is joining', () => {
        voiceaChannel.announceStatus = 'joining';
        assert.equal(voiceaChannel.isAnnounceProcessed(), false);
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
  });
});
