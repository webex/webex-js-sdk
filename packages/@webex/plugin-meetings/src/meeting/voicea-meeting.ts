import {type MeetingTranscriptPayload} from '@webex/internal-plugin-voicea';

export const getSpeaker = (members: Record<string, any>, csis: string[] = []) =>
  Object.values(members).find((member) => {
    const memberCSIs = member.participant.status.csis ?? [];

    return csis.some((csi) => memberCSIs.includes(csi));
  });

export const getSpeakerFromProxyOrStore = ({
  csisKey,
  meetingMembers,
  transcriptData,
}: Record<string, any>) => {
  let speaker = {
    speakerId: '',
    name: '',
  };

  let needsCaching = false;

  if (csisKey && transcriptData.speakerProxy[csisKey]) {
    speaker = transcriptData.speakerProxy[csisKey];

    return {speaker, needsCaching};
  }

  const meetingMember: any = getSpeaker(meetingMembers, [csisKey]);

  speaker = {
    speakerId: meetingMember?.participant.person.id ?? '',
    name: meetingMember?.participant.person.name ?? '',
  };

  needsCaching = true;

  return {speaker, needsCaching};
};

export const processNewCaptions = ({
  data,
  meeting,
}: {
  data: MeetingTranscriptPayload;
  meeting: any;
}) => {
  const {transcriptId} = data;
  const transcriptData = meeting.transcription;

  const {transcripts = []} = data;
  const transcriptsPerCsis = new Map();

  for (const transcript of transcripts) {
    const {
      text,
      transcript_language_code: currentSpokenLanguage,
      csis: [csisMember],
    } = transcript;

    const newCaption = `${transcriptsPerCsis.get(csisMember)?.text ?? ''} ${text}`.trim();

    transcriptsPerCsis.set(csisMember, {
      ...transcript,
      text: newCaption,
      currentSpokenLanguage,
    });
  }
  const interimTranscriptionIds = [];

  for (const [key, value] of transcriptsPerCsis) {
    const {needsCaching, speaker} = getSpeakerFromProxyOrStore({
      meetingMembers: meeting.members.membersCollection.members,
      transcriptData,
      csisKey: key,
    });
    const {speakerId} = speaker;
    const interimId = `${transcriptId}_${speakerId}`;

    if (needsCaching) {
      transcriptData.speakerProxy[key] = speaker;
    }

    const captionData = {
      id: interimId,
      isFinal: data.isFinal,
      translations: value.translations,
      text: value.text,
      currentCaptionLanguage:
        meeting.transcription?.languageOptions?.currentCaptionLanguage ||
        value.currentSpokenLanguage,
      currentSpokenLanguage:
        meeting.transcription?.languageOptions?.currentSpokenLanguage ||
        data.transcripts[0]?.transcript_language_code,
      timestamp: value?.timestamp,
      speaker,
    };

    if (!data.isFinal) {
      const interimTranscriptIndex = transcriptData.captions.findIndex(
        (transcript: {id: string}) => transcript.id === interimId
      );

      if (interimTranscriptIndex !== -1) {
        transcriptData.captions.splice(interimTranscriptIndex, 1);
      }

      interimTranscriptionIds.push(interimId);
    } else {
      transcriptData.interimCaptions[transcriptId].forEach((innerInterimId: string) => {
        const interimTranscriptIndex = transcriptData.captions.findIndex(
          (transcript: {id: string}) => transcript.id === innerInterimId
        );

        if (interimTranscriptIndex !== -1) {
          transcriptData.captions.splice(interimTranscriptIndex, 1);
        }
      });
      delete transcriptData.interimCaptions[transcriptId];
      captionData.id = transcriptId;
    }
    transcriptData.captions.push(captionData);
  }
  transcriptData.interimCaptions[transcriptId] = interimTranscriptionIds;
};
