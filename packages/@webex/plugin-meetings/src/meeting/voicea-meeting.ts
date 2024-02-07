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
  }
  const meetingMember: any = getSpeaker(meetingMembers, [csisKey]);

  const speakerInStore = {
    speakerId: meetingMember?.participant.person.id ?? '',
    name: meetingMember?.participant.person.name ?? '',
  };

  if (
    meetingMember &&
    (speakerInStore.speakerId !== speaker.speakerId || speakerInStore.name !== speaker.name)
  ) {
    needsCaching = true;
    speaker = speakerInStore;
  }

  return {speaker, needsCaching};
};
export const processNewCaptions = ({data, meeting}) => {
  // TODO: processing the members
  //   {
  //     "isFinal": false,
  //     "transcriptId": "7408f2eb-e329-dc92-bae6-6d04a2f7b073",
  //     "transcripts": [
  //         {
  //             "text": "Hello",
  //             "csis": [
  //                 2001586688
  //             ],
  //             "transcript_language_code": "en"
  //         }
  //     ]
  // }
  const {transcriptId} = data;
  const transcriptData = meeting.transcription;

  if (data.isFinal) {
    const doesInterimTranscriptionExist = transcriptId in transcriptData.interimCaptions;

    if (doesInterimTranscriptionExist) {
      transcriptData.interimCaptions[transcriptId].forEach((fakeId) => {
        const fakeTranscriptIndex = transcriptData.captions.findIndex(
          (transcript) => transcript.id === fakeId
        );

        if (fakeTranscriptIndex !== -1) {
          transcriptData.captions.splice(fakeTranscriptIndex, 1);
        }
      });
      delete transcriptData.interimCaptions[transcriptId];
    }
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
      currentSpokenLanguage: data.transcript?.transcriptLanguageCode,
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

    const newCaption = `${transcriptsPerCsis.get(csisMember)?.text ?? ''} ${text}`;

    // eslint-disable-next-line camelcase
    transcriptsPerCsis.set(csisMember, {text: newCaption, currentSpokenLanguage});
  }
  const fakeTranscriptionIds = [];

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
    const fakeId = `${transcriptId}_${speakerId}`;
    const captionData = {
      id: fakeId,
      isFinal: data.isFinal,
      translations: value.translations,
      text: value.text,
      currentCaptionLanguage: value.currentSpokenLanguage,
      timestamp: value?.timestamp,
      speaker,
    };

    const fakeTranscriptIndex = transcriptData.captions.findIndex(
      (transcript) => transcript.id === fakeId
    );

    if (fakeTranscriptIndex !== -1) {
      transcriptData.captions.splice(fakeTranscriptIndex, 1);
    }

    fakeTranscriptionIds.push(fakeId);
    transcriptData.captions.push(captionData);
  }
  transcriptData.interimCaptions[transcriptId] = fakeTranscriptionIds;
};

export const processHighlightCreated = ({data, meeting}) => {
  const transcriptData = meeting.transcription;

  if (!transcriptData.highlights) {
    transcriptData.highlights = [];
  }

  const csisKey = data.csis && data.csis.length > 0 ? data.csis[0] : undefined;
  const {needsCaching, speaker} = getSpeakerFromProxyOrStore({
    meetingMembers: meeting.members.membersCollection.members,
    transcriptData,
    csisKey,
  });

  if (needsCaching) {
    transcriptData.speakerProxy[csisKey] = speaker;
  }

  const highlightCreated = {
    id: data.highlightId,
    meta: {
      label: data.highlightLabel,
      source: data.highlightSource,
    },
    text: data.text,
    timestamp: data.timestamp,
    speaker,
  };

  meeting.transcription.highlights.push(highlightCreated);
};

export const EVENT_TRIGGERS = {
  VOICEA_ANNOUNCEMENT: 'voicea:announcement',
  CAPTION_LANGUAGE_UPDATE: 'voicea:captionLanguageUpdate',
  SPOKEN_LANGUAGE_UPDATE: 'voicea:spokenLanguageUpdate',
  CAPTIONS_TURNED_ON: 'voicea:captionOn',
  TRANSCRIBING_ON: 'voicea:transcribingOn',
  TRANSCRIBING_OFF: 'voicea:transcribingOff',

  NEW_CAPTION: 'voicea:newCaption',
  EVA_COMMAND: 'voicea:wxa',
  HIGHLIGHT_CREATED: 'voicea:highlightCreated',
};
