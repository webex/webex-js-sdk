/* eslint-env browser */
/* global Webex */
/* eslint-disable no-console */
/* eslint-disable require-jsdoc */

let webex;
let currentUser;
let currentSites = [];
let currentPreferredSite;
let lastPatchResponse;
const evidenceEntries = [];

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}`;

  console.log(entry);
  evidenceEntries.push(entry);
  const el = document.getElementById('evidence-log');

  el.textContent = evidenceEntries.join('\n');
  el.scrollTop = el.scrollHeight;
}

function showResult(elementId, message, type = 'info') {
  const el = document.getElementById(elementId);

  el.className = `result ${type}`;
  el.textContent = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
}

async function initSDK() {
  const tokenInput = document.getElementById('token').value.trim();
  const token = tokenInput.replace(/^Bearer\s+/i, '');

  if (!token) {
    showResult('init-status', 'Error: paste a token first', 'error');

    return;
  }

  log('Initializing SDK with bearer token...');
  document.getElementById('btn-init').disabled = true;

  try {
    webex = window.webex = Webex.init({
      credentials: {
        access_token: token,
      },
    });

    log('SDK initialized. Waiting for ready event...');

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('SDK ready timeout')), 20000);

      webex.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    log('SDK ready. Registering device...');
    await webex.internal.device.register();
    log(`Device registered. userId: ${webex.internal.device.userId}`);

    const orgId = webex.credentials.getOrgId();

    log(`OrgId extracted from token: ${orgId}`);

    showResult('init-status', `✅ SDK initialized and device registered\nuserId: ${webex.internal.device.userId}\norgId: ${orgId}`, 'success');

    document.getElementById('btn-get-user').disabled = false;
    log('Ready to get user profile.');
  } catch (err) {
    log(`ERROR initializing SDK: ${err.message}`);
    showResult('init-status', `Error: ${err.message}`, 'error');
    document.getElementById('btn-init').disabled = false;
  }
}

async function getUserAndSites() {
  log('Fetching user profile via webex.internal.user.get()...');
  document.getElementById('btn-get-user').disabled = true;

  try {
    currentUser = await webex.internal.user.get();
    log(`User profile received. displayName: ${currentUser.displayName}`);
    log(`trainSiteNames: ${JSON.stringify(currentUser.trainSiteNames)}`);
    log(`linkedTrainSiteNames: ${JSON.stringify(currentUser.linkedTrainSiteNames)}`);
    log(`preferredWebExSite: ${currentUser.preferredWebExSite}`);

    showResult('user-result', {
      displayName: currentUser.displayName,
      trainSiteNames: currentUser.trainSiteNames,
      linkedTrainSiteNames: currentUser.linkedTrainSiteNames,
      preferredWebExSite: currentUser.preferredWebExSite,
    }, 'success');

    // Test getMeetingSiteList
    log('Calling webex.internal.user.getMeetingSiteList(user)...');
    currentSites = webex.internal.user.getMeetingSiteList(currentUser);
    log(`getMeetingSiteList result: ${JSON.stringify(currentSites)}`);
    currentPreferredSite = currentUser.preferredWebExSite;

    showResult('sites-result', `Sites (${currentSites.length}):\n${currentSites.map((s) => `  ${s === currentPreferredSite ? '● ' : '○ '}${s}`).join('\n')}`, 'success');

    renderSiteRadios();
    document.getElementById('btn-update-site').disabled = false;
    document.getElementById('btn-verify').disabled = false;
  } catch (err) {
    log(`ERROR fetching user: ${err.message}`);
    showResult('user-result', `Error: ${err.message}`, 'error');
    document.getElementById('btn-get-user').disabled = false;
  }
}

function renderSiteRadios() {
  const container = document.getElementById('site-radios');

  container.innerHTML = '';

  currentSites.forEach((site) => {
    const div = document.createElement('div');

    div.className = 'site-radio';
    const radio = document.createElement('input');

    radio.type = 'radio';
    radio.name = 'site';
    radio.value = site;
    radio.id = `site-${site}`;
    radio.checked = site === currentPreferredSite;

    const label = document.createElement('label');

    label.htmlFor = `site-${site}`;
    label.textContent = ` ${site}${site === currentPreferredSite ? ' (current)' : ''}`;

    div.appendChild(radio);
    div.appendChild(label);
    container.appendChild(div);
  });
}

async function updateSite() {
  const selected = document.querySelector('input[name="site"]:checked');

  if (!selected) {
    showResult('update-result', 'Select a site first', 'error');

    return;
  }

  const newSiteUrl = selected.value;

  if (newSiteUrl === currentPreferredSite) {
    log(`No-op: selected site "${newSiteUrl}" is already the preferred site.`);
    showResult('update-result', `No-op: "${newSiteUrl}" is already selected.`, 'info');

    return;
  }

  log(`Calling updatePreferredWebexSite({ newSiteUrl: "${newSiteUrl}", oldSiteUrl: "${currentPreferredSite}" })...`);
  document.getElementById('btn-update-site').disabled = true;

  try {
    const result = await webex.internal.user.updatePreferredWebexSite({
      newSiteUrl,
      oldSiteUrl: currentPreferredSite,
    });

    log(`✅ SCIM PATCH succeeded! Response preferredWebExSite: ${result.preferredWebExSite || '(check response)'}`);
    log(`Full response keys: ${Object.keys(result).join(', ')}`);
    log(`PATCH response userPreferences: ${JSON.stringify(result.userPreferences)}`);
    currentPreferredSite = newSiteUrl;
    lastPatchResponse = result;
    renderSiteRadios();

    showResult('update-result', `✅ Site updated to "${newSiteUrl}"\n\nResponse (truncated):\n${JSON.stringify(result, null, 2).substring(0, 500)}`, 'success');
  } catch (err) {
    log(`ERROR updating site: ${err.message} (status: ${err.statusCode || 'N/A'})`);
    showResult('update-result', `Error: ${err.message}\nStatus: ${err.statusCode || 'N/A'}`, 'error');
  }

  document.getElementById('btn-update-site').disabled = false;
}

async function verifyPersistence() {
  log('Re-fetching user from SCIM endpoint to verify persistence...');

  try {
    // user.get() uses conversation service which doesn't return preferredWebExSite.
    // We need to read directly from the SCIM/identity endpoint to verify.
    const orgId = webex.credentials.getOrgId();
    const userId = webex.internal.device.userId;

    const res = await webex.request({
      uri: `${webex.config.credentials.identity.url || 'https://identity.webex.com'}/identity/scim/${orgId}/v2/Users/${userId}?attributes=userPreferences,trainSiteNames,preferredWebExSite`,
      method: 'GET',
    });

    const user = res.body;
    let foundPreferredSite;

    log(`SCIM GET response keys: ${Object.keys(user).join(', ')}`);

    // Check extension namespace — userPreferences may be nested here
    const extensionKey = 'urn:scim:schemas:extension:cisco:webexidentity:2.0:User';
    const extension = user[extensionKey];

    if (extension) {
      log(`Extension keys: ${Object.keys(extension).join(', ')}`);
      log(`Extension userPreferences: ${JSON.stringify(extension.userPreferences)}`);
    }

    // Try multiple locations for userPreferences
    const prefs = user.userPreferences || (extension && extension.userPreferences);

    log(`Resolved userPreferences: ${JSON.stringify(prefs)}`);
    log(`SCIM preferredWebExSite direct: ${user.preferredWebExSite}`);

    // Parse preferredWebExSite from userPreferences array
    if (Array.isArray(prefs)) {
      for (const pref of prefs) {
        const val = typeof pref === 'string' ? pref : (pref.value || '');

        log(`  Checking pref: ${JSON.stringify(pref)} → val="${val}"`);
        if (val && val.includes('preferredWebExSite')) {
          const match = val.match(/preferredWebExSite[":]*\s*[":]*([^"}\s,]+)/);

          if (match) foundPreferredSite = match[1];
          log(`  → match: ${JSON.stringify(match)}`);
        }
      }
    }

    // Also check top-level field
    if (!foundPreferredSite && user.preferredWebExSite) {
      foundPreferredSite = user.preferredWebExSite;
    }

    // Fallback: verify from the PATCH response if GET doesn't include userPreferences
    if (!foundPreferredSite && lastPatchResponse && Array.isArray(lastPatchResponse.userPreferences)) {
      log('GET did not include userPreferences, using PATCH response as verification...');
      for (const pref of lastPatchResponse.userPreferences) {
        const val = typeof pref === 'string' ? pref : (pref.value || '');

        if (val && val.includes('preferredWebExSite')) {
          const match = val.match(/preferredWebExSite[":]*\s*[":]*([^"}\s,]+)/);

          if (match) {
            foundPreferredSite = match[1];
            log(`  → PATCH response match: ${match[1]}`);
          }
        }
      }
    }

    log(`Verified preferredWebExSite from SCIM: ${foundPreferredSite}`);
    const matches = foundPreferredSite === currentPreferredSite;

    log(matches ? '✅ Site persisted correctly!' : `❌ Mismatch! Expected "${currentPreferredSite}", got "${foundPreferredSite}"`);

    showResult('verify-result', matches
      ? `✅ Verified: preferredWebExSite = "${foundPreferredSite}" (matches)`
      : `❌ Mismatch: expected "${currentPreferredSite}", got "${foundPreferredSite}"`,
    matches ? 'success' : 'error');
  } catch (err) {
    log(`ERROR verifying: ${err.message}`);
    showResult('verify-result', `Error: ${err.message}`, 'error');
  }
}
