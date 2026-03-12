/*!
 * Copyright (c) 2015-2025 Cisco Systems, Inc. See LICENSE file.
 *
 * Manual test for internal-plugin-call-ai-summary
 *
 * Usage:
 *   WEBEX_TOKEN='<your-token>' node manual-test.js
 *
 * Or paste your token directly into WEBEX_TOKEN below.
 */

/* eslint-disable no-console, require-jsdoc */

require('@webex/internal-plugin-call-ai-summary');

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
  if (WEBEX_TOKEN === '<PASTE_YOUR_TOKEN_HERE>') {
    console.error('ERROR: Set WEBEX_TOKEN env var or paste your token in the script.');
    process.exit(1);
  }

  const webex = new WebexCore({
    credentials: {
      access_token: WEBEX_TOKEN,
    },
  });

  console.log('--- Fetching container', CONTAINER_ID, '(SDK auth) ---\n');

  const response = await webex.request({
    method: 'GET',
    uri: `${PRAGYA_BASE_URL}/containers/${CONTAINER_ID}`,
    headers: {
      'content-type': 'application/json',
    },
  });

  const container = response.body;
  let passed = 0;
  let failed = 0;

  function check(label, actual, expected) {
    if (actual === expected) {
      console.log(`  PASS: ${label}`);
      passed += 1;
    } else {
      console.log(
        `  FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
      );
      failed += 1;
    }
  }

  function checkExists(label, value) {
    if (value !== undefined && value !== null) {
      console.log(`  PASS: ${label} exists`);
      passed += 1;
    } else {
      console.log(`  FAIL: ${label} is missing`);
      failed += 1;
    }
  }

  function checkType(label, value, type) {
    const actual = Array.isArray(value) ? 'array' : typeof value;
    const expected = type;
    if (type === 'array' ? Array.isArray(value) : actual === expected) {
      console.log(`  PASS: ${label} is ${type}`);
      passed += 1;
    } else {
      console.log(`  FAIL: ${label} — expected ${type}, got ${actual}`);
      failed += 1;
    }
  }

  function checkMatch(label, value, regex) {
    if (regex.test(value)) {
      console.log(`  PASS: ${label} matches ${regex}`);
      passed += 1;
    } else {
      console.log(`  FAIL: ${label} — ${JSON.stringify(value)} does not match ${regex}`);
      failed += 1;
    }
  }

  // --- Top-level container ---
  console.log('\n--- Top-level container ---');
  checkType('container', container, 'object');
  check('container.id', container.id, CONTAINER_ID);
  check('container.objectType', container.objectType, 'callingAIContainer');
  checkExists('container.summaryData', container.summaryData);
  checkExists('container.memberships', container.memberships);
  checkMatch('container.encryptionKeyUrl', container.encryptionKeyUrl, /^kms:\/\//);
  checkMatch('container.kmsResourceObjectUrl', container.kmsResourceObjectUrl, /^kms:\/\//);
  checkMatch('container.aclUrl', container.aclUrl, /^https?:\/\//);
  checkExists('container.start', container.start);
  checkExists('container.end', container.end);
  checkExists('container.forkSessionId', container.forkSessionId);
  checkExists('container.callSessionId', container.callSessionId);
  checkExists('container.ownerUserId', container.ownerUserId);
  checkExists('container.orgId', container.orgId);

  // --- summaryData ---
  console.log('\n--- summaryData ---');
  const {summaryData} = container;
  checkType('summaryData', summaryData, 'object');
  checkExists('summaryData.extensionId', summaryData.extensionId);
  check('summaryData.objectType', summaryData.objectType, 'extension');
  check('summaryData.extensionType', summaryData.extensionType, 'callingAISummary');

  // --- summaryData.data ---
  console.log('\n--- summaryData.data ---');
  const summaryDataData = summaryData.data;
  checkType('summaryData.data', summaryDataData, 'object');
  checkExists('summaryData.data.id', summaryDataData.id);
  check('summaryData.data.objectType', summaryDataData.objectType, 'callingAISummary');
  checkExists('summaryData.data.status', summaryDataData.status);
  checkMatch('summaryData.data.summaryUrl', summaryDataData.summaryUrl, /^https?:\/\//);
  checkMatch('summaryData.data.transcriptUrl', summaryDataData.transcriptUrl, /^https?:\/\//);
  checkMatch('summaryData.data.aclUrl', summaryDataData.aclUrl, /^https?:\/\//);
  checkMatch(
    'summaryData.data.kmsResourceObjectUrl',
    summaryDataData.kmsResourceObjectUrl,
    /^kms:\/\//
  );
  checkType('summaryData.data.summarizeAfterCall', summaryDataData.summarizeAfterCall, 'boolean');
  checkType('summaryData.data.contentRetention', summaryDataData.contentRetention, 'object');

  // --- memberships ---
  console.log('\n--- memberships ---');
  const {memberships} = container;
  checkType('memberships', memberships, 'object');
  checkType('memberships.items', memberships.items, 'array');
  if (memberships.items.length > 0) {
    console.log(`  PASS: memberships.items has ${memberships.items.length} member(s)`);
    passed += 1;
    const first = memberships.items[0];
    checkExists('memberships.items[0].id', first.id);
    checkType('memberships.items[0].roles', first.roles, 'array');
    check('memberships.items[0].objectType', first.objectType, 'containerMembership');
  } else {
    console.log('  FAIL: memberships.items is empty');
    failed += 1;
  }

  // --- Summary ---
  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
