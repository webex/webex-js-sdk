/*!
 * Copyright (c) 2015-2025 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * Mock Pragya and AI Bridge responses.
 *
 * These shapes are the upstream wire bodies as observed against the live Pragya
 * and AI Bridge services. Both surfaces are externally owned, so this file is
 * the repository's only record of them: `src/types.ts` declares only the subset
 * the plugin consumes. Keep these fixtures faithful to the wire, not to the DTOs.
 */

/** Raw Pragya container response, with summary URLs still nested under `summaryData.data`. */
export const rawPragyaContainer = {
  id: '34125120-13b5-11f1-9b36-adb685725098',
  objectType: 'callingAIContainer',
  summaryData: {
    extensionId: 'extension-id',
    objectType: 'extension',
    extensionType: 'callingAISummary',
    data: {
      id: 'summary-id',
      objectType: 'callingAISummary',
      status: 'Active',
      summaryUrl: 'https://aibridge-url/summaries/c635e870',
      transcriptUrl: 'https://aibridge-url/summaries/c635e870/transcripts',
      summarizeAfterCall: true,
      aclUrl: 'https://acl-a.wbx2.com/acl/api/v1/acls/inner',
      kmsResourceObjectUrl: 'kms://kms-cisco.wbx2.com/resources/inner',
    },
  },
  encryptionKeyUrl: 'kms://kms-cisco.wbx2.com/keys/897e4d2d',
  kmsResourceObjectUrl: 'kms://kms-cisco.wbx2.com/resources/f7316435',
  aclUrl: 'https://acl-a.wbx2.com/acl/api/v1/acls/78c4cd90',
  forkSessionId: '123e4567-fork',
  callSessionId: '123e4567-call',
  ownerUserId: '123e4567-owner',
  orgId: '123e4567-org',
  start: '2023-10-01T12:00:00Z',
  end: '2023-10-01T12:00:00Z',
};

/** A container as callers see it after `getContainer` flattens `summaryData.data`. */
export const flattenedContainer = {
  summaryData: {
    status: 'Active',
    summaryUrl: 'https://aibridge-url/summaries/c635e870',
    notesUrl: 'https://aibridge-url/summaries/c635e870/notes',
    actionItemsUrl: 'https://aibridge-url/summaries/c635e870/action-items',
    transcriptUrl: 'https://aibridge-url/summaries/c635e870/transcripts',
    summarizeAfterCall: true,
  },
  encryptionKeyUrl: 'kms://kms-cisco.wbx2.com/keys/897e4d2d',
};

/** AI Bridge response for `summaryUrl?fields=note,shortnote,actionitems`. */
export const summaryResponse = {
  id: '10293-dk93-ddie-odir-did932j3kdde',
  keyUrl: 'kms://kms-us-int.wbx2.com/keys/f19d4d28',
  note: {aiGeneratedContent: '<encrypted_note_content>'},
  shortnote: {aiGeneratedContent: '<encrypted_short_note_content>'},
  actionitems: {
    snippets: [
      {
        id: '394r0087',
        content: 'edited version',
        aiGeneratedContent: '<encrypted_ai_generated_content>',
      },
    ],
  },
  links: [
    {
      rel: 'feedback',
      href: 'https://summarizer-r.wbx2.com/summarizer/api/v1/feedback/1',
    },
  ],
};

/** AI Bridge response for the standalone `notesUrl` endpoint. */
export const notesResponse = {
  id: '10293-dk93-ddie-odir-did932j3kdde',
  aiGeneratedContent: '<encrypted_content>',
  feedbackUrl: 'https://summarizer-r.wbx2.com/summarizer/api/v1/feedback/report/1',
  keyUrl: 'kms://kms-us-int.wbx2.com/keys/f19d4d28',
};

/** AI Bridge response for the standalone `actionItemsUrl` endpoint. Note the array wrapper. */
export const actionItemsResponse = [
  {
    id: '1234-dk93-ddie-odir-dk93dj33',
    keyUrl: 'kms://kms-us-int.wbx2.com/keys/f19d4d28',
    snippets: [
      {
        id: '394r0087',
        content: 'edited version',
        aiGeneratedContent: '<encrypted_ai_generated_content>',
      },
    ],
  },
];

/** AI Bridge response for `transcriptUrl`. */
export const transcriptResponse = {
  id: 'transcript-id',
  totalCount: 2,
  transcriptSnippetList: [
    {
      startTime: '1000',
      endTime: '2000',
      content: '<encrypted_snippet_1>',
      audioCSI: 'csi-1',
      speaker: {speakerName: 'Ada Lovelace', speakerId: 'speaker-1'},
    },
    {
      startTime: '2000',
      endTime: '3000',
      content: '<encrypted_snippet_2>',
      audioCSI: 'csi-2',
      speaker: {speakerName: 'Alan Turing', speakerId: 'speaker-2'},
    },
  ],
};
