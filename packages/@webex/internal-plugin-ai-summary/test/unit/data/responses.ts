/*!
 * Copyright (c) 2015-2025 Cisco Systems, Inc. See LICENSE file.
 */

export const MOCK_ENCRYPTION_KEY_URL =
  'kms://kms-cisco.wbx2.com/keys/897e4d2d-6219-433d-be77-7ec73fe1c0db';

export const MOCK_CONTAINER_RESPONSE = {
  memberships: [{}],
  summaryData: {
    status: 'Active',
    summaryUrl: 'https://aibridge-url/summaries/c635e870-7b3b-4b3b-8b3b-7b3b7b3b7b3c',
    notesUrl: 'https://aibridge-url/summaries/c635e870-7b3b-4b3b-8b3b-7b3b7b3b7b3c/notes',
    actionItemsUrl:
      'https://aibridge-url/summaries/c635e870-7b3b-4b3b-8b3b-7b3b7b3b7b3c/action-items',
    transcriptUrl:
      'https://aibridge-url/summaries/c635e870-7b3b-4b3b-8b3b-7b3b7b3b7b3c/transcripts',
    summarizeAfterCall: true,
  },
  encryptionKeyUrl: MOCK_ENCRYPTION_KEY_URL,
  kmsResourceObjectUrl: 'kms://kms-cisco.wbx2.com/resources/f7316435-2147-4d23-bf4a-762d831cb58c',
  aclUrl: 'https://acl-a.wbx2.com/acl/api/v1/acls/78c4cd90-f880-11ee-96e9-3932dce37910',
  forkSessionId: '123e4567-e89b-12d3-a456-426614174000',
  callSessionId: '123e4567-e89b-12d3-a456-426614174000',
  ownerUserId: '123e4567-e89b-12d3-a456-426614174000',
  orgId: '123e4567-e89b-12d3-a456-426614174000',
  start: '2023-10-01T12:00:00Z',
  end: '2023-10-01T12:30:00Z',
};

export const MOCK_SUMMARY_RESPONSE = {
  id: 'summary-id-001',
  aiGeneratedContent: 'encrypted-summary-content',
  feedbackUrl:
    'https://summarizer-r.wbx2.com/summarizer/api/v1/feedback/report/80e44a80-b4c4-11f0-81a2-b1a3117d0ccf',
  keyUrl: MOCK_ENCRYPTION_KEY_URL,
};

export const MOCK_NOTES_RESPONSE = {
  id: 'notes-id-001',
  aiGeneratedContent: 'encrypted-notes-content',
  feedbackUrl:
    'https://summarizer-r.wbx2.com/summarizer/api/v1/feedback/report/90f55b91-c5d5-22f1-92b3-c2b4228e1dd0',
  keyUrl: MOCK_ENCRYPTION_KEY_URL,
};

export const MOCK_NOTES_RESPONSE_NO_FEEDBACK = {
  id: 'notes-id-002',
  aiGeneratedContent: 'encrypted-notes-content-2',
  keyUrl: MOCK_ENCRYPTION_KEY_URL,
};

export const MOCK_ACTION_ITEMS_RESPONSE = [
  {
    id: 'action-items-id-001',
    keyUrl: MOCK_ENCRYPTION_KEY_URL,
    snippets: [
      {
        id: 'snippet-001',
        content: 'User edited version of item 1',
        aiGeneratedContent: 'encrypted-action-item-1',
      },
      {
        id: 'snippet-002',
        aiGeneratedContent: 'encrypted-action-item-2',
      },
    ],
    feedbackUrl:
      'https://summarizer-r.wbx2.com/summarizer/api/v1/feedback/report/76f8ec60-b4c4-11f0-a1a1-699b3a514ce9',
  },
];

export const MOCK_ACTION_ITEMS_EMPTY_SNIPPETS = [
  {
    id: 'action-items-id-002',
    keyUrl: MOCK_ENCRYPTION_KEY_URL,
    snippets: [],
  },
];
