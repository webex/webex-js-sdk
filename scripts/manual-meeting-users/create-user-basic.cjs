const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');

process.umask(0o077);
const sdkRoot = path.resolve(process.env.WEBEX_SDK_ROOT || path.join(__dirname, '../..'));
const sdkRequire = createRequire(path.join(sdkRoot, 'package.json'));
const env = sdkRequire('dotenv').config({path: path.join(sdkRoot, '.env'), override: true});
if (env.error) throw env.error;
const {createTestUser} = sdkRequire('@webex/test-users');
// Keep basic credentials separate from the full provisioning script's output.
const outputDir = path.resolve(process.argv[2] || path.join(__dirname, 'basic'));
const userPath = path.join(outputDir, 'user.json');

(async () => {
  if (!process.env.WEBEX_CONVERGED_ORG_ID) throw new Error('WEBEX_CONVERGED_ORG_ID is required');
  // Original SDK defaults: no meeting-site provisioning, even if WEBEX_SITE is set.
  const user = await createTestUser({
    orgId: process.env.WEBEX_CONVERGED_ORG_ID,
    scope: process.env.WEBEX_SCOPE,
  });
  const saved = {
    createdAt: new Date().toISOString(),
    id: user.id,
    email: user.emailAddress || user.email,
    password: user.password,
    orgId: process.env.WEBEX_CONVERGED_ORG_ID,
    clientId: process.env.WEBEX_CLIENT_ID,
    requestedScopes: process.env.WEBEX_SCOPE,
    entitlements: user.entitlements,
    token: user.token,
  };
  fs.mkdirSync(outputDir, {recursive: true, mode: 0o700});
  fs.writeFileSync(userPath, JSON.stringify(saved, null, 2) + '\n', {mode: 0o600});
  const headerPath = path.join(outputDir, 'authorization.header');
  fs.writeFileSync(headerPath, `Authorization: ${user.token.authorization}\n`, {mode: 0o600});
  fs.chmodSync(userPath, 0o600);
  fs.chmodSync(headerPath, 0o600);
  const grantedScopes = user.token.scope || user.token.scopes || '';
  console.log(JSON.stringify({
    created: true,
    id: saved.id,
    credentialsFile: userPath,
    requestedMeetingPreferencesScope: (saved.requestedScopes || '').split(/\s+/).includes('meeting:preferences_read'),
    grantedMeetingPreferencesScope: (Array.isArray(grantedScopes) ? grantedScopes : grantedScopes.split(/\s+/)).includes('meeting:preferences_read'),
    grantedScopes,
    expiresAt: user.token.expires ? new Date(user.token.expires).toISOString() : null,
  }, null, 2));
})().catch((error) => {
  const message = String(error.message || 'User creation failed');
  console.error(JSON.stringify({
    created: false,
    name: error.name,
    statusCode: error.statusCode || error.status,
    summary: message.split('\n')[0].slice(0, 220),
    trackingId: message.match(/WEBEX_TRACKING_ID: ([\w-]+)/)?.[1],
  }, null, 2));
  process.exitCode = 1;
});
