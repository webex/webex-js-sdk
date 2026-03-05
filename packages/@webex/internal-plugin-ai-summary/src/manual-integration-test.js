/*!
 * Copyright (c) 2015-2025 Cisco Systems, Inc. See LICENSE file.
 *
 * Manual integration test for internal-plugin-ai-summary
 * Tests the full flow: getContainer -> getSummary (with KMS decryption)
 *
 * Skips device registration (token may not work for WDM).
 * Sets authorization header directly on each request so the auth
 * interceptor passes it through without needing the service catalog.
 *
 * Usage:
 *   node src/manual-integration-test.js
 */

/* eslint-disable no-console, require-jsdoc */

require('@webex/internal-plugin-ai-summary');

const WebexCore = require('@webex/webex-core').default;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const WEBEX_TOKEN = process.env.WEBEX_TOKEN || '<PASTE_YOUR_TOKEN_HERE>';
const CONTAINER_ID = '<PASTE_CONTAINER_ID_HERE>';
const PRAGYA_BASE_URL = '<PASTE_PRAGYA_BASE_URL_HERE>';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Step 1: Create WebexCore ===\n');
  const webex = new WebexCore({
    credentials: {
      access_token: WEBEX_TOKEN,
    },
  });

  // Step 2: Get container via direct request (bypasses service catalog)
  console.log('=== Step 2: getContainer (direct request) ===\n');
  const containerRequestOpts = {
    method: 'GET',
    uri: `${PRAGYA_BASE_URL}/containers/${CONTAINER_ID}`,
    headers: {'content-type': 'application/json'},
  };
  console.log('Request headers:', JSON.stringify(containerRequestOpts.headers, null, 2));
  const {body: container} = await webex.request(containerRequestOpts);
  console.log('Container ID:', container.id);
  console.log('objectType:', container.objectType);
  console.log('encryptionKeyUrl:', container.encryptionKeyUrl);

  // Check summaryData shape — API nests URLs under summaryData.data
  const summaryUrl = container.summaryData.data
    ? container.summaryData.data.summaryUrl
    : container.summaryData.summaryUrl;
  const transcriptUrl = container.summaryData.data
    ? container.summaryData.data.transcriptUrl
    : container.summaryData.transcriptUrl;

  console.log('summaryUrl:', summaryUrl);
  console.log('transcriptUrl:', transcriptUrl);

  // Step 3: Fetch summary content from summaryUrl
  console.log('\n=== Step 3: Fetch summary content ===\n');
  const summaryRequestOpts = {
    method: 'GET',
    uri: `${summaryUrl}?fields=note,shortnote,actionitems`,
    headers: {'content-type': 'application/json'},
  };
  console.log('Request headers:', JSON.stringify(summaryRequestOpts.headers, null, 2));
  const {body: summaryBody} = await webex.request(summaryRequestOpts);
  console.log('Summary response keys:', Object.keys(summaryBody));
  console.log('Summary ID:', summaryBody.id);

  // Content is nested: note.aiGeneratedContent, shortnote.aiGeneratedContent, actionitems.snippets[]
  const noteContent = summaryBody.note?.aiGeneratedContent;
  const shortnoteContent = summaryBody.shortnote?.aiGeneratedContent;
  const actionItems = summaryBody.actionitems?.snippets || [];

  console.log(
    'note.aiGeneratedContent (first 100 chars):',
    noteContent ? `${noteContent.substring(0, 100)}...` : 'N/A'
  );
  console.log(
    'shortnote.aiGeneratedContent (first 100 chars):',
    shortnoteContent ? `${shortnoteContent.substring(0, 100)}...` : 'N/A'
  );
  console.log('actionitems.snippets count:', actionItems.length);
  if (actionItems.length > 0) {
    console.log(
      'First action item aiGeneratedContent (first 100 chars):',
      actionItems[0].aiGeneratedContent
        ? `${actionItems[0].aiGeneratedContent.substring(0, 100)}...`
        : 'N/A'
    );
  }
  console.log('note keys:', summaryBody.note ? Object.keys(summaryBody.note) : 'N/A');
  console.log('note.feedbackUrl:', summaryBody.note?.feedbackUrl);
  console.log('links:', JSON.stringify(summaryBody.links, null, 2));

  // Step 4: Decrypt via plugin's _decryptContent
  console.log('\n=== Step 4: Decrypt summary via KMS ===\n');
  if (noteContent && container.encryptionKeyUrl) {
    try {
      const decrypted = await webex.internal.aisummary._decryptContent(
        noteContent,
        container.encryptionKeyUrl
      );
      console.log('Decrypted note:');
      console.log(decrypted);
    } catch (err) {
      console.error('Decryption failed:', err.message);
      console.log('\nKMS decryption requires device registration for key access.');
      console.log(
        'The encrypted content was fetched successfully — decryption is the only failing step.'
      );
    }
  } else {
    console.log('No note.aiGeneratedContent to decrypt.');
  }

  // Step 5: Call getSummary via plugin and log the return structure
  console.log('\n=== Step 5: getSummary via plugin ===\n');
  try {
    // Normalize summaryData.data nesting (same as getContainer does)
    const normalizedContainer = {...container};
    if (normalizedContainer.summaryData?.data) {
      normalizedContainer.summaryData = normalizedContainer.summaryData.data;
    }

    const summaryResult = await webex.internal.aisummary.getSummary({
      containerInfo: normalizedContainer,
    });

    console.log('=== getSummary return structure ===');
    const noteStr = summaryResult.note || '';
    const shortNoteStr = summaryResult.shortNote || '';
    const truncNote = noteStr.length > 200 ? `${noteStr.substring(0, 200)}...` : noteStr;
    const truncShort =
      shortNoteStr.length > 200 ? `${shortNoteStr.substring(0, 200)}...` : shortNoteStr;
    const truncated = {
      id: summaryResult.id,
      note: truncNote,
      shortNote: truncShort,
      actionItems: (summaryResult.actionItems || []).map((item) => {
        const content = item.aiGeneratedContent || '';
        const truncContent = content.length > 100 ? `${content.substring(0, 100)}...` : content;

        return {
          id: item.id,
          aiGeneratedContent: truncContent,
          editedContent: item.editedContent,
        };
      }),
      feedbackUrl: summaryResult.feedbackUrl,
    };
    console.log(JSON.stringify(truncated, null, 2));
  } catch (err) {
    console.error('getSummary via plugin failed:', err.message);
  }

  // Step 6: Fetch transcript URL
  console.log('\n=== Step 6: Fetch transcript content ===\n');
  try {
    const transcriptRequestOpts = {
      method: 'GET',
      uri: `${transcriptUrl}?fields=id,content`,
      headers: {'content-type': 'application/json'},
    };
    console.log('Request headers:', JSON.stringify(transcriptRequestOpts.headers, null, 2));
    const {body: transcriptBody} = await webex.request(transcriptRequestOpts);
    console.log('Transcript response keys:', Object.keys(transcriptBody));
    console.log(JSON.stringify(transcriptBody, null, 2).substring(0, 500));
  } catch (err) {
    console.error('Transcript fetch failed:', err.message);
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err.message || err);
  process.exit(1);
});
