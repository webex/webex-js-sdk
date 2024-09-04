import {
    getSpeakerFromProxyOrStore,
    processNewCaptions,
    processHighlightCreated,
} from '@webex/plugin-meetings/src/meeting/voicea-meeting';
import {assert} from '@webex/test-helper-chai';
import { expect } from 'chai';

describe('plugin-meetings', () => {
    let fakeMeeting, fakeVoiceaPayload;
    const fakeMemberId = "4f35a5ab-f750-3ba7-b309-dea62a512257";
    beforeEach(() => {
        const fakeMemberList = {
            [fakeMemberId]: {
                participant: {
                    person: {
                        id: "8093d335-9b96-4f9d-a6b2-7293423be88a",
                        name: "John Doe",
                        isExternal: false,
                        orgId: "1eb65fdf-9643-417f-9974-ad72cae0e10f",
                        incomingCallProtocols: []
                    },
                    status: {
                        audioStatus: "SENDRECV",
                        videoStatus: "INACTIVE",
                        videoSlidesStatus: "RECVONLY",
                        audioSlidesStatus: "INACTIVE",
                        csis: [
                            3060099329,
                            3060099328,
                            1234867712,
                            1234867713
                        ]
                    },
                },
                id: fakeMemberId
            }
        };

        const fakeCaptions = {
            captions: [
                {
                    id: "6bece1b9-4e50-fafe-fb63-d27d5fb27280",
                    isFinal: true,
                    text: "Oh it's not update.",
                    currentSpokenLanguage: "en",
                    timestamp: "1:34",
                    speaker: {
                        speakerId: "8093d335-9b96-4f9d-a6b2-7293423be88a",
                        name: "John Doe"
                    }
                },
                {
                    id: "c34400a9-cb2b-20c3-d20c-bd7981cc62a9",
                    isFinal: true,
                    text: "Nice.",
                    currentSpokenLanguage: "en",
                    timestamp: "1:60",
                    speaker: {
                        speakerId: "8093d335-9b96-4f9d-a6b2-7293423be88a",
                        name: "John Doe"
                    }
                },
                {
                    id: "311cc182-e657-c077-c078-795f866c4e9b_8093d335-9b96-4f9d-a6b2-7293423be88a",
                    isFinal: false,
                    text: " Don't bother me talking I'm just going to get the transcript data that is interim and I",
                    currentCaptionLanguage: "en",
                    speaker: {
                        speakerId: "8093d335-9b96-4f9d-a6b2-7293423be88a",
                        name: "John Doe"
                    }
                }
            ],
            interimCaptions: {
                "6bece1b9-4e50-fafe-fb63-d27d5fb27280": [],
                "c34400a9-cb2b-20c3-d20c-bd7981cc62a9": [],
                "311cc182-e657-c077-c078-795f866c4e9b": [
                    "311cc182-e657-c077-c078-795f866c4e9b_8093d335-9b96-4f9d-a6b2-7293423be88a"
                ]
            },
            speakerProxy: {},
        };

        fakeMeeting = {
            members: {
                membersCollection: {
                    members: fakeMemberList
                }
            },
            transcription: fakeCaptions
        }

        fakeVoiceaPayload = {
            isFinal: true,
            transcriptId: "311cc182-e657-c077-c078-795f866c4e9b",
            transcripts: [
                {
                    text: "Don't bother me talking I'm just going to get the transcript data that is interim and I needed if I keep talking, I get the interim data",
                    csis: [
                        1234867712
                    ],
                    transcript_language_code: "en"
                }
            ]
        };
    });

    describe('voicea-meeting', () => {
        it('should export the correct members', () => {
            assert.isFunction(getSpeakerFromProxyOrStore);
            assert.isFunction(processNewCaptions);
        });

        describe('getSpeakerFromProxyOrStore', () => {
            it('should return a cached speaker if csisKey is in speakerProxy', () => {
                // Add a speaker to the speakerProxy
                const csisKey = 1234867712;
                const cachedSpeaker = {
                    speakerId: 'cached-speaker-id',
                    name: 'Cached Speaker'
                };
                fakeMeeting.transcription.speakerProxy[csisKey] = cachedSpeaker;
        
                const { speaker, needsCaching } = getSpeakerFromProxyOrStore({
                    csisKey,
                    meetingMembers: fakeMeeting.members.membersCollection.members,
                    transcriptData: fakeMeeting.transcription
                });
        
                expect(speaker).to.deep.equal(cachedSpeaker);
                expect(needsCaching).to.be.false;
            });
            
            it('should find and cache a speaker if not already in speakerProxy', () => {
                const csisKey = 1234867712; // This csis exists in the fakeMemberList
        
                // Ensure speakerProxy is empty
                fakeMeeting.transcription.speakerProxy = {};
        
                const { speaker, needsCaching } = getSpeakerFromProxyOrStore({
                    csisKey,
                    meetingMembers: fakeMeeting.members.membersCollection.members,
                    transcriptData: fakeMeeting.transcription
                });
        
                expect(speaker.speakerId).to.equal(fakeMeeting.members.membersCollection.members[fakeMemberId].participant.person.id);
                expect(speaker.name).to.equal(fakeMeeting.members.membersCollection.members[fakeMemberId].participant.person.name);
                expect(needsCaching).to.be.true;
            });
        });

        describe('processNewCaptions', () => {
            it('should process new final captions correctly', () => {
                let transcriptData = fakeMeeting.transcription;
                let transcriptId = fakeVoiceaPayload.transcriptId;

                // Assuming that processNewCaptions is a pure function that doesn't mutate the input but returns a new state
                processNewCaptions({
                  data: fakeVoiceaPayload,
                  meeting: fakeMeeting
                });

                // Check if speaker details are cached if needed
                const csisKey = fakeVoiceaPayload.transcripts[0].csis[0];
                const speaker = transcriptData.speakerProxy[csisKey];
                expect(speaker).to.exist;

                // Check if interim captions are removed
                expect(transcriptData.interimCaptions[transcriptId]).to.deep.equal([]);

                //check if the interim caption is removed
                const oldInterimCaption = transcriptData.captions.find(caption => caption.id === `${transcriptId}_${speaker.speakerId}`);
                console.log(oldInterimCaption);
                expect(oldInterimCaption).to.not.exist;

                // Check the final caption data
                const newCaption = transcriptData.captions.find(caption => caption.id === transcriptId);
                expect(newCaption).to.exist;
                expect(newCaption).to.include({
                  id: transcriptId,
                  isFinal: fakeVoiceaPayload.isFinal,
                  text: fakeVoiceaPayload.transcripts[0].text,
                  currentSpokenLanguage: fakeVoiceaPayload.transcripts[0].transcript_language_code,
                });

                // Check the speaker data in the new caption
                expect(newCaption.speaker).to.deep.equal(speaker);
            });

            it('should process new interim captions correctly', () => {
                let transcriptData = fakeMeeting.transcription;
                let transcriptId = fakeVoiceaPayload.transcriptId;

                transcriptData.captions.splice(transcriptData.length - 1, 1);
                fakeVoiceaPayload.isFinal = false;

                processNewCaptions({
                  data: fakeVoiceaPayload,
                  meeting: fakeMeeting
                });

                // Check if speaker details are cached if needed
                const csisKey = fakeVoiceaPayload.transcripts[0].csis[0];
                const speaker = transcriptData.speakerProxy[csisKey];
                expect(speaker).to.exist;

                // Check the final caption data
                const newCaption = transcriptData.captions.find(caption => caption.id === `${transcriptId}_${speaker.speakerId}`);
                expect(newCaption).to.exist;
                expect(newCaption).to.include({
                  id: `${transcriptId}_${speaker.speakerId}`,
                  isFinal: fakeVoiceaPayload.isFinal,
                  text: fakeVoiceaPayload.transcripts[0].text,
                  currentCaptionLanguage: fakeVoiceaPayload.transcripts[0].transcript_language_code,
                });

                // Check if interim captions has the right caption id
                expect(transcriptData.interimCaptions[transcriptId]).to.deep.equal([newCaption.id]);

                // Check the speaker data in the new caption
                expect(newCaption.speaker).to.deep.equal(speaker);
            });

            it('should process interim captions with an existing one correctly', () => {
                let transcriptData = fakeMeeting.transcription;
                let transcriptId = fakeVoiceaPayload.transcriptId;
                fakeVoiceaPayload.isFinal = false;

                processNewCaptions({
                  data: fakeVoiceaPayload,
                  meeting: fakeMeeting
                });

                // Check if speaker details are cached if needed
                const csisKey = fakeVoiceaPayload.transcripts[0].csis[0];
                const speaker = transcriptData.speakerProxy[csisKey];
                expect(speaker).to.exist;

                // Check the final caption data
                const newCaption = transcriptData.captions.find(caption => caption.id === `${transcriptId}_${speaker.speakerId}`);
                expect(newCaption).to.exist;
                expect(newCaption).to.include({
                  id: `${transcriptId}_${speaker.speakerId}`,
                  isFinal: fakeVoiceaPayload.isFinal,
                  text: fakeVoiceaPayload.transcripts[0].text,
                  currentCaptionLanguage: fakeVoiceaPayload.transcripts[0].transcript_language_code,
                });

                // Check if interim captions has the right caption id
                expect(transcriptData.interimCaptions[transcriptId]).to.deep.equal([newCaption.id]);

                // Check the speaker data in the new caption
                expect(newCaption.speaker).to.deep.equal(speaker);
            });
        });

        describe('processHighlightCreated', () => {
            beforeEach(() => {
              fakeVoiceaPayload = {
                highlightId: 'highlight1',
                highlightLabel: 'Important',
                highlightSource: 'User',
                text: 'This is a highlight',
                timestamp: '2023-10-10T10:00:00Z',
                csis: ['3060099329'],
              };
            });
        
            it('should initialize highlights array if it does not exist', () => {
              fakeMeeting.transcription.highlights = undefined;
        
              processHighlightCreated({data: fakeVoiceaPayload, meeting: fakeMeeting});
        
              expect(fakeMeeting.transcription.highlights).to.be.an('array');
              expect(fakeMeeting.transcription.highlights).to.have.lengthOf(1);
            });
        
            it('should process highlight creation correctly', () => {
              processHighlightCreated({data: fakeVoiceaPayload, meeting: fakeMeeting});
        
              const csisKey = fakeVoiceaPayload.csis[0];
              const speaker = fakeMeeting.transcription.speakerProxy[csisKey];
              expect(speaker).to.exist;
        
              const newHighlight = fakeMeeting.transcription.highlights.find(
                (highlight) => highlight.id === fakeVoiceaPayload.highlightId
              );
              expect(newHighlight).to.exist;
              expect(newHighlight).to.deep.include({
                id: fakeVoiceaPayload.highlightId,
                meta: {
                  label: fakeVoiceaPayload.highlightLabel,
                  source: fakeVoiceaPayload.highlightSource,
                },
                text: fakeVoiceaPayload.text,
                timestamp: fakeVoiceaPayload.timestamp,
              });
        
              expect(newHighlight.speaker).to.deep.equal(speaker);
            });
          });
    });
});