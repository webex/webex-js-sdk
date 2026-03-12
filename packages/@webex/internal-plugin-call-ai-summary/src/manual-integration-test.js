/*!
 * Copyright (c) 2015-2025 Cisco Systems, Inc. See LICENSE file.
 *
 * Manual integration test for internal-plugin-call-ai-summary
 * Tests the full flow using the SDK service catalog (WDM):
 *   device.register() -> getContainer -> getSummary (with KMS decryption)
 *
 * The SDK resolves `service: 'pragya'` to the correct base URL via the
 * service catalog populated during device registration.
 *
 * Usage:
 *   WEBEX_TOKEN='<token>' node src/manual-integration-test.js
 */

/* eslint-disable no-console, require-jsdoc */

require('@webex/internal-plugin-call-ai-summary');

const WebexCore = require('@webex/webex-core').default;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const WEBEX_TOKEN = process.env.WEBEX_TOKEN || '<PASTE_YOUR_TOKEN_HERE>';
const CONTAINER_ID = process.env.CONTAINER_ID || '<PASTE_CONTAINER_ID_HERE>';

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

  // Step 2: Register device to populate service catalog
  console.log('=== Step 2: Register device (WDM) ===\n');
  await webex.internal.device.register();
  console.log('Device registered successfully.');
  console.log('Device URL:', webex.internal.device.url);

  // Log the pragya service URL from the service catalog
  try {
    const pragyaUrl = webex.internal.services.get('pragya');
    console.log('Pragya service URL (from catalog):', pragyaUrl);
  } catch (e) {
    console.log('Could not resolve pragya from service catalog:', e.message);
  }

  // Step 3: Get container via plugin (uses service: 'pragya' + resource)
  console.log('\n=== Step 3: getContainer via plugin ===\n');
  const container = await webex.internal.aisummary.getContainer({
    containerId: CONTAINER_ID,
  });
  console.log(
    'Container Info:',
    JSON.stringify(
      {
        id: container.id,
        objectType: container.objectType,
        encryptionKeyUrl: container.encryptionKeyUrl,
        summaryUrl: container.summaryData?.summaryUrl,
        transcriptUrl: container.summaryData?.transcriptUrl,
      },
      null,
      2
    )
  );

  // Step 4: Call getSummary via plugin (fetches + decrypts all content)
  console.log('\n=== Step 4: getSummary via plugin ===\n');
  const summaryResult = await webex.internal.aisummary.getSummary({
    containerInfo: container,
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

  // Step 5: Get transcript URL via plugin
  console.log('\n=== Step 5: getTranscriptUrl via plugin ===\n');
  const transcriptUrl = webex.internal.aisummary.getTranscriptUrl({
    containerInfo: container,
  });
  console.log('Transcript URL:', transcriptUrl);

  // Step 6: Fetch transcript content
  console.log('\n=== Step 6: Fetch transcript content ===\n');
  try {
    const {body: transcriptBody} = await webex.request({
      method: 'GET',
      uri: `${transcriptUrl}?fields=id,content`,
    });
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
