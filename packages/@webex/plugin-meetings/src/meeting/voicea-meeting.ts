export const getSpeaker = (members, csis = []) =>
  Object.values(members).find((member: any) => {
    const memberCSIs = member.participant.status.csis ?? [];

    return csis.some((csi) => memberCSIs.includes(csi));
  });

export const getSpeakerFromProxyOrStore = ({csisKey, meetingMembers, transcriptData}) => {
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

export const processNewCaptions = ({data, meeting}) => {
  const {transcriptId} = data;
  const transcriptData = meeting.transcription;

  if (data.isFinal) {
    transcriptData.interimCaptions[transcriptId].forEach((interimId) => {
      const interimTranscriptIndex = transcriptData.captions.findIndex(
        (transcript) => transcript.id === interimId
      );

      if (interimTranscriptIndex !== -1) {
        transcriptData.captions.splice(interimTranscriptIndex, 1);
      }
    });
    delete transcriptData.interimCaptions[transcriptId];
    const csisKey = data.transcript?.csis[0];

    const {needsCaching, speaker} = getSpeakerFromProxyOrStore({
      meetingMembers: meeting.members.membersCollection.members,
      transcriptData,
      csisKey,
    });

    if (needsCaching) {
      transcriptData.speakerProxy[csisKey] = speaker;
    }
    const captionData = {
      id: transcriptId,
      isFinal: data.isFinal,
      translations: data.translations,
      text: data.transcript?.text,
      currentSpokenLanguage: data.transcript?.transcript_language_code,
      timestamp: data.timestamp,
      speaker,
    };
    transcriptData.captions.push(captionData);
  }
  const {transcripts = []} = data;
  const transcriptsPerCsis = new Map();

  for (const transcript of transcripts) {
    const {
      text,
      transcript_language_code: currentSpokenLanguage,
      csis: [csisMember],
    } = transcript;

    const newCaption = `${transcriptsPerCsis.get(csisMember)?.text ?? ''} ${text}`.trim();

    // eslint-disable-next-line camelcase
    transcriptsPerCsis.set(csisMember, {text: newCaption, currentSpokenLanguage});
  }
  const interimTranscriptionIds = [];

  for (const [key, value] of transcriptsPerCsis) {
    const {needsCaching, speaker} = getSpeakerFromProxyOrStore({
      meetingMembers: meeting.members.membersCollection.members,
      transcriptData,
      csisKey: key,
    });

    if (needsCaching) {
      transcriptData.speakerProxy[key] = speaker;
    }
    const {speakerId} = speaker;
    const interimId = `${transcriptId}_${speakerId}`;
    const captionData = {
      id: interimId,
      isFinal: data.isFinal,
      translations: value.translations,
      text: value.text,
      currentCaptionLanguage: value.currentSpokenLanguage,
      timestamp: value?.timestamp,
      speaker,
    };

    const interimTranscriptIndex = transcriptData.captions.findIndex(
      (transcript) => transcript.id === interimId
    );

    if (interimTranscriptIndex !== -1) {
      transcriptData.captions.splice(interimTranscriptIndex, 1);
    }

    interimTranscriptionIds.push(interimId);
    transcriptData.captions.push(captionData);
  }
  transcriptData.interimCaptions[transcriptId] = interimTranscriptionIds;
};
