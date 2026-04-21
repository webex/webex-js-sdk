#!/usr/bin/env node

/**
 * Manual validation script for the SCIM PATCH site selection API.
 * Tests the same API contract that updatePreferredWebexSite() and getMeetingSiteList() wrap.
 *
 * Usage: WEBEX_TOKEN=<bearer_token> node validate-site-selection.js
 *
 * The token can be obtained from web.webex.com DevTools → Network → any successful request → Authorization header
 */

/* eslint-disable no-console */

const token = (process.env.WEBEX_TOKEN || '').replace(/^Bearer\s+/i, '');

if (!token) {
  console.error('Error: set WEBEX_TOKEN environment variable');
  console.error('Example: WEBEX_TOKEN="Bearer ..." node validate-site-selection.js');
  process.exit(1);
}

const evidence = [];

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;

  console.log(line);
  evidence.push(line);
}

function decodeToken(accessToken) {
  const parts = accessToken.split('.');

  if (parts.length < 2) throw new Error('Invalid JWT');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

  return {
    userId: payload.cis_uuid || payload.uid || payload.sub,
    orgId: payload.org_id || payload.orgId || payload.realm,
  };
}

async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();

    throw Object.assign(new Error(`HTTP ${res.status}: ${body.substring(0, 300)}`), {statusCode: res.status, body});
  }

  return res.json();
}

async function main() {
  log('=== Site Selection Manual Validation ===');
  log('Testing the same API contract that updatePreferredWebexSite() and getMeetingSiteList() use');
  log('');

  // Step 1: Decode token
  log('Step 1: Decoding JWT token...');
  const {userId, orgId} = decodeToken(token);

  log(`  userId: ${userId}`);
  log(`  orgId: ${orgId}`);

  const identityUrl = 'https://identity.webex.com';

  // Step 2: Get user profile via SCIM
  log('');
  log('Step 2: Getting user profile via SCIM GET...');
  const user = await apiRequest(`${identityUrl}/identity/scim/${orgId}/v1/Users/${userId}`);

  log(`  displayName: ${user.displayName}`);
  log(`  trainSiteNames: ${JSON.stringify(user.trainSiteNames)}`);
  log(`  linkedTrainSiteNames: ${JSON.stringify(user.linkedTrainSiteNames)}`);
  log(`  preferredWebExSite: ${user.preferredWebExSite}`);

  // Step 3: Compute site list (mirrors getMeetingSiteList logic)
  log('');
  log('Step 3: Computing meeting site list (getMeetingSiteList logic)...');
  const trainSites = user.trainSiteNames || [];
  const linkedSites = user.linkedTrainSiteNames || [];
  const allSites = [...new Set([...trainSites, ...linkedSites])];

  log(`  trainSiteNames (${trainSites.length}): ${JSON.stringify(trainSites)}`);
  log(`  linkedTrainSiteNames (${linkedSites.length}): ${JSON.stringify(linkedSites)}`);
  log(`  Combined unique sites (${allSites.length}): ${JSON.stringify(allSites)}`);

  if (allSites.length === 0) {
    log('  ⚠️  No sites available — cannot test site switching');
    writeEvidence();

    return;
  }

  const originalSite = user.preferredWebExSite;
  const alternativeSite = allSites.find((s) => s !== originalSite);

  if (!alternativeSite) {
    log('  ⚠️  Only one site available — cannot test switching');
    log(`  Single site: ${allSites[0]}`);
    writeEvidence();

    return;
  }

  // Step 4: SCIM PATCH to change preferred site (mirrors updatePreferredWebexSite logic)
  log('');
  log(`Step 4: SCIM PATCH — changing from "${originalSite}" to "${alternativeSite}"...`);
  const patchBody = {
    schemas: ['urn:scim:schemas:core:1.0', 'urn:scim:schemas:extension:cisco:commonidentity:1.0'],
    userPreferences: {preferredWebExSite: alternativeSite},
  };

  log(`  PATCH URL: ${identityUrl}/identity/scim/${orgId}/v1/Users/${userId}`);
  log(`  Body: ${JSON.stringify(patchBody)}`);

  try {
    const result = await apiRequest(`${identityUrl}/identity/scim/${orgId}/v1/Users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(patchBody),
    });

    log(`  ✅ SCIM PATCH succeeded!`);
    log(`  Response preferredWebExSite: ${result.preferredWebExSite}`);
  } catch (err) {
    log(`  ❌ Error: ${err.message}`);
    log(`  Status: ${err.statusCode || 'N/A'}`);
    writeEvidence();

    return;
  }

  // Step 5: Verify persistence
  log('');
  log('Step 5: Re-fetching user to verify persistence...');
  const updated = await apiRequest(`${identityUrl}/identity/scim/${orgId}/v1/Users/${userId}`);

  log(`  preferredWebExSite: ${updated.preferredWebExSite}`);

  if (updated.preferredWebExSite === alternativeSite) {
    log('  ✅ Site persisted correctly!');
  } else {
    log(`  ❌ Mismatch! Expected "${alternativeSite}", got "${updated.preferredWebExSite}"`);
  }

  // Step 6: Restore original site
  log('');
  log(`Step 6: Restoring original site "${originalSite}"...`);

  try {
    const restoreBody = {
      schemas: ['urn:scim:schemas:core:1.0', 'urn:scim:schemas:extension:cisco:commonidentity:1.0'],
      userPreferences: {preferredWebExSite: originalSite},
    };

    await apiRequest(`${identityUrl}/identity/scim/${orgId}/v1/Users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(restoreBody),
    });
    log('  ✅ Original site restored');
  } catch (err) {
    log(`  ⚠️  Could not restore original: ${err.message}`);
  }

  // Step 7: Final verification
  log('');
  log('Step 7: Final verification...');
  const finalUser = await apiRequest(`${identityUrl}/identity/scim/${orgId}/v1/Users/${userId}`);

  log(`  preferredWebExSite: ${finalUser.preferredWebExSite}`);

  if (finalUser.preferredWebExSite === originalSite) {
    log('  ✅ Original site restored and verified!');
  } else {
    log(`  ⚠️  Final site: "${finalUser.preferredWebExSite}" (expected "${originalSite}")`);
  }

  log('');
  log('=== Validation Complete ===');
  writeEvidence();
}

function writeEvidence() {
  const fs = require('fs');
  const path = require('path');
  const filename = `validation-evidence-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
  const filepath = path.join(__dirname, filename);

  fs.writeFileSync(filepath, evidence.join('\n'));
  log(`Evidence saved to: ${filepath}`);
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  log(err.stack);
  writeEvidence();
  process.exit(1);
});
