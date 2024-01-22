export const processNewCaptions = () => {
  const {data} = payload;
  const {transcriptId} = data;
  const voiceaReduxData = this.transcripts;

  if (data.isFinal) {
    const doesInterimTranscriptionExist = transcriptId in voiceaReduxData.interimCaptions;

    if (doesInterimTranscriptionExist) {
      voiceaReduxData.interimCaptions[transcriptId].forEach((fakeId) => {
        const fakeTranscriptIndex = voiceaReduxData.captions.findIndex(
          (transcript) => transcript.id === fakeId
        );

        if (fakeTranscriptIndex !== -1) {
          voiceaReduxData.captions.splice(fakeTranscriptIndex, 1);
        }
      });
      delete voiceaReduxData.interimCaptions[transcriptId];
    }
    const csisKey = data.transcript?.csis[0];

    const {needsCaching, speaker} = getSpeakerFromProxyOrStore({
      meetingMembers: draft.meetingMembers[draft.activeMeetingId],
      voiceaReduxData,
      csisKey,
    });

    if (needsCaching) {
      voiceaReduxData.speakerProxy[csisKey] = speaker;
    }
    const captionData = {
      id: transcriptId,
      isFinal: data.isFinal,
      translations: data.translations,
      text: data.transcript?.text,
      currentCaptionLanguage: data.transcript?.transcriptLanguageCode,
      timestamp: data.timestamp,
      speaker,
    };

    voiceaReduxData.captions.push(captionData);
  } else {
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
        meetingMembers: draft.meetingMembers[draft.activeMeetingId],
        voiceaReduxData,
        csisKey: key,
      });

      if (needsCaching) {
        voiceaReduxData.speakerProxy[key] = speaker;
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

      const fakeTranscriptIndex = voiceaReduxData.captions.findIndex(
        (transcript) => transcript.id === fakeId
      );

      if (fakeTranscriptIndex !== -1) {
        voiceaReduxData.captions.splice(fakeTranscriptIndex, 1);
      }

      fakeTranscriptionIds.push(fakeId);
      voiceaReduxData.captions.push(captionData);
    }
    voiceaReduxData.interimCaptions[transcriptId] = fakeTranscriptionIds;
  }
};

export const processHighlightCreated = () => {
  const {data} = action.payload;

  const voiceaReduxData = draft.meetings[draft.activeMeetingId].voicea;

  if (!voiceaReduxData.highlights) {
    voiceaReduxData.highlights = [];
  }

  const csisKey = data.csis && data.csis.length > 0 ? data.csis[0] : undefined;
  const {needsCaching, speaker} = getSpeakerFromProxyOrStore({
    meetingMembers: draft.meetingMembers[draft.activeMeetingId],
    voiceaReduxData,
    csisKey,
  });

  if (needsCaching) {
    voiceaReduxData.speakerProxy[csisKey] = speaker;
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

  draft.meetings[draft.activeMeetingId].voicea.highlights.push(highlightCreated);
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

// this.locusInfo.on(EVENT_TRIGGERS.VOICEA_ANNOUNCEMENT, (payload: {captionLanguages: string,maxLanguages: number,spokenLanguages: Array<string>}) => {

//   this.transcripts.languageOptions = payload;

// }

// this.locusInfo.on(EVENT_TRIGGERS.CAPTION_LANGUAGE_UPDATE, (payload) => {

//   const {data} = payload;
//   const {statusCode} = data;

//   if (statusCode === 200) {
//     this.transcripts.languageOptions = {
//       ...this.transcripts.languageOptions,
//       currentCaptionLanguage:
//       this.transcripts.languageOptions.requestedCaptionLanguage ?? ENGLISH_LANGUAGE,
//     };
//   } else {
//     // TODO Handle Status Code and alert - SPARK-370923
//   }

// }

// this.locusInfo.on(EVENT_TRIGGERS.SPOKEN_LANGUAGE_UPDATE, (payload: {captionLanguages: string,maxLanguages: number,spokenLanguages: Array<string>}) => {

//   const {data} = payload;

//   if (data?.languageCode) {
//     this.transcripts.languageOptions = {
//       ...this.transcripts.languageOptions,
//       currentSpokenLanguage: data?.languageCode,
//     };
//   }
//   break;

// }

// this.locusInfo.on(EVENT_TRIGGERS.TRANSCRIBING_ON, (payload) => {

//   const {meetingId, status} = payload;

//   switch (status) {
//     case PENDING: {
//         this.transcripts.transcribingRequestStatus = WXA_TRANSCRIBING_REQUEST_STATUS.PENDING;
//       break;
//     }
//     case FAILURE: {
//         this.transcripts.transcribingRequestStatus = WXA_TRANSCRIBING_REQUEST_STATUS.INACTIVE;
//       break;
//     }
//     case SUCCESS: {
//         this.transcripts.transcribingRequestStatus = WXA_TRANSCRIBING_REQUEST_STATUS.ACTIVE;
//       break;
//     }
//   }

// }
// this.locusInfo.on(EVENT_TRIGGERS.TRANSCRIBING_OFF, (payload) => {

//   const {meetingId, status} = payload;

//   switch (status) {
//     case PENDING: {
//         this.transcripts.transcribingRequestStatus = WXA_TRANSCRIBING_REQUEST_STATUS.PENDING;
//       break;
//     }
//     case FAILURE: {
//         this.transcripts.transcribingRequestStatus = WXA_TRANSCRIBING_REQUEST_STATUS.ACTIVE;
//       break;
//     }
//     case SUCCESS: {
//         this.transcripts.transcribingRequestStatus = WXA_TRANSCRIBING_REQUEST_STATUS.INACTIVE;
//       break;
//     }
//   }
// }
// this.locusInfo.on(EVENT_TRIGGERS.EVA_COMMAND, (payload) => {

//   const {data} = payload;

//   this.transcripts.isListening = !!data.isListening;
//   this.transcripts.commandText = data.text ?? '';

// }
// this.locusInfo.on(EVENT_TRIGGERS.NEW_CAPTION, (payload: {captionLanguages: string,maxLanguages: number,spokenLanguages: Array<string>}) => {

//   const {data} = payload;
//   const {transcriptId} = data;
//   const voiceaReduxData = this.transcripts;

//   if (data.isFinal) {
//     const doesInterimTranscriptionExist = transcriptId in voiceaReduxData.interimCaptions;

//     if (doesInterimTranscriptionExist) {
//       voiceaReduxData.interimCaptions[transcriptId].forEach((fakeId) => {
//         const fakeTranscriptIndex = voiceaReduxData.captions.findIndex((transcript) => transcript.id === fakeId);

//         if (fakeTranscriptIndex !== -1) {
//           voiceaReduxData.captions.splice(fakeTranscriptIndex, 1);
//         }
//       });
//       delete voiceaReduxData.interimCaptions[transcriptId];
//     }
//     const csisKey = data.transcript?.csis[0];

//     const {needsCaching, speaker} = getSpeakerFromProxyOrStore({
//       meetingMembers: draft.meetingMembers[draft.activeMeetingId],
//       voiceaReduxData,
//       csisKey,
//     });

//     if (needsCaching) {
//       voiceaReduxData.speakerProxy[csisKey] = speaker;
//     }
//     const captionData = {
//       id: transcriptId,
//       isFinal: data.isFinal,
//       translations: data.translations,
//       text: data.transcript?.text,
//       currentCaptionLanguage: data.transcript?.transcriptLanguageCode,
//       timestamp: data.timestamp,
//       speaker,
//     };

//     voiceaReduxData.captions.push(captionData);
//   } else {
//     const {transcripts = []} = data;
//     const transcriptsPerCsis = new Map();

//     for (const transcript of transcripts) {
//       const {
//         text,
//         transcript_language_code: currentSpokenLanguage,
//         csis: [csisMember],
//       } = transcript;

//       const newCaption = `${transcriptsPerCsis.get(csisMember)?.text ?? ''} ${text}`;

//       // eslint-disable-next-line camelcase
//       transcriptsPerCsis.set(csisMember, {text: newCaption, currentSpokenLanguage});
//     }
//     const fakeTranscriptionIds = [];

//     for (const [key, value] of transcriptsPerCsis) {
//       const {needsCaching, speaker} = getSpeakerFromProxyOrStore({
//         meetingMembers: draft.meetingMembers[draft.activeMeetingId],
//         voiceaReduxData,
//         csisKey: key,
//       });

//       if (needsCaching) {
//         voiceaReduxData.speakerProxy[key] = speaker;
//       }
//       const {speakerId} = speaker;
//       const fakeId = `${transcriptId}_${speakerId}`;
//       const captionData = {
//         id: fakeId,
//         isFinal: data.isFinal,
//         translations: value.translations,
//         text: value.text,
//         currentCaptionLanguage: value.currentSpokenLanguage,
//         timestamp: value?.timestamp,
//         speaker,
//       };

//       const fakeTranscriptIndex = voiceaReduxData.captions.findIndex((transcript) => transcript.id === fakeId);

//       if (fakeTranscriptIndex !== -1) {
//         voiceaReduxData.captions.splice(fakeTranscriptIndex, 1);
//       }

//       fakeTranscriptionIds.push(fakeId);
//       voiceaReduxData.captions.push(captionData);
//     }
//     voiceaReduxData.interimCaptions[transcriptId] = fakeTranscriptionIds;
//   }

// }
// this.locusInfo.on(EVENT_TRIGGERS.HIGHLIGHT_CREATED, (payload: {captionLanguages: string,maxLanguages: number,spokenLanguages: Array<string>}) => {

//     const {data} = action.payload;

//     const voiceaReduxData = draft.meetings[draft.activeMeetingId].voicea;

//     if (!voiceaReduxData.highlights) {
//       voiceaReduxData.highlights = [];
//     }

//     const csisKey = data.csis && data.csis.length > 0 ? data.csis[0] : undefined;
//     const {needsCaching, speaker} = getSpeakerFromProxyOrStore({
//       meetingMembers: draft.meetingMembers[draft.activeMeetingId],
//       voiceaReduxData,
//       csisKey,
//     });

//     if (needsCaching) {
//       voiceaReduxData.speakerProxy[csisKey] = speaker;
//     }

//     const highlightCreated = {
//       id: data.highlightId,
//       meta: {
//         label: data.highlightLabel,
//         source: data.highlightSource,
//       },
//       text: data.text,
//       timestamp: data.timestamp,
//       speaker,
//     };

//     draft.meetings[draft.activeMeetingId].voicea.highlights.push(highlightCreated);

// }
