const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');

process.umask(0o077);
// Override WEBEX_SDK_ROOT if the SDK checkout is elsewhere.
const sdkRoot = path.resolve(process.env.WEBEX_SDK_ROOT || path.join(__dirname, '../..'));
const sdkRequire = createRequire(path.join(sdkRoot, 'package.json'));
const env = sdkRequire('dotenv').config({path: path.join(sdkRoot, '.env'), override: true});
if (env.error) throw env.error;
const {createTestUser, setPreferredSite, loginTestUser} = sdkRequire('@webex/test-users');
const outputDir = path.resolve(process.argv[2] || __dirname);
const userPath = path.join(outputDir, 'user.json');
let saved;
let phase = 'configuration';

function saveUser() {
  fs.mkdirSync(outputDir, {recursive: true, mode: 0o700});
  fs.writeFileSync(userPath, JSON.stringify(saved, null, 2) + '\n', {mode: 0o600});
  const headerPath = path.join(outputDir, 'authorization.header');
  fs.writeFileSync(headerPath, `Authorization: ${saved.token.authorization}\n`, {mode: 0o600});
  fs.chmodSync(userPath, 0o600);
  fs.chmodSync(headerPath, 0o600);
}

(async () => {
  // Configure these in the SDK .env; site and admin must belong to this org.
  const required = ['WEBEX_CLIENT_ID', 'WEBEX_CLIENT_SECRET', 'WEBEX_CONVERGED_ORG_ID',
    'WEBEX_SCOPE', 'IDBROKER_BASE_URL', 'WEBEX_TEST_USERS_CI_GATEWAY_SERVICE_URL',
    'IDENTITY_BASE_URL', 'WEBEX_SITE'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Missing configuration: ${missing.join(', ')}`);

  const orgId = process.env.WEBEX_CONVERGED_ORG_ID;
  const site = process.env.WEBEX_SITE.trim();
  if (!/^[a-z0-9.-]+\.webex\.com$/i.test(site)) {
    throw new Error('WEBEX_SITE must be a hostname such as example.webex.com (without https:// or a path)');
  }
  const creatorId = process.env.WEBEX_TEST_USERS_CLIENT_ID;
  const creatorSecret = process.env.WEBEX_TEST_USERS_CLIENT_SECRET;
  if (!!creatorId !== !!creatorSecret) {
    throw new Error('Set both WEBEX_TEST_USERS_CLIENT_ID and WEBEX_TEST_USERS_CLIENT_SECRET, or neither');
  }

  let orgAdminAuthorization = process.env.WEBEX_TEST_USERS_ORG_ADMIN_AUTHORIZATION;
  if (!orgAdminAuthorization) {
    const email = process.env.WEBEX_TEST_USERS_ORG_ADMIN_USER;
    const password = process.env.WEBEX_TEST_USERS_ORG_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error('Set WEBEX_TEST_USERS_ORG_ADMIN_AUTHORIZATION (Bearer token), or both WEBEX_TEST_USERS_ORG_ADMIN_USER and WEBEX_TEST_USERS_ORG_ADMIN_PASSWORD');
    }
    phase = 'admin-login';
    const adminToken = await loginTestUser({email, password, orgId, scopes: 'webexsquare:admin'});
    orgAdminAuthorization = adminToken.authorization;
  }
  if (!/^Bearer\s+\S+$/i.test(orgAdminAuthorization || '')) {
    throw new Error('Org admin authorization must be a Bearer token');
  }

  phase = 'create-and-sync';
  const user = await createTestUser({
    orgId,
    scope: process.env.WEBEX_SCOPE,
    clientId: creatorId || process.env.WEBEX_CLIENT_ID,
    clientSecret: creatorSecret || process.env.WEBEX_CLIENT_SECRET,
    entitlements: ['spark', 'squaredCallInitiation', 'squaredRoomModeration',
      'squaredInviter', 'basicMessage', 'basicMeeting', 'webExSquared'],
    forceCreate: true,
    ensureExistsInWebexSites: true,
    syncInWebexSites: [site],
    orgAdminAuthorization,
  });
  saved = {
    createdAt: new Date().toISOString(),
    id: user.id,
    email: user.emailAddress || user.email,
    password: user.password,
    orgId: process.env.WEBEX_CONVERGED_ORG_ID,
    clientId: process.env.WEBEX_CLIENT_ID,
    requestedScopes: process.env.WEBEX_SCOPE,
    entitlements: user.entitlements,
    provisioning: {webexSite: site, status: 'create-and-sync-returned'},
    token: user.token,
  };
  // Preserve the new user's credentials if a later provisioning step fails.
  saveUser();
  phase = 'set-preferred-site';
  await setPreferredSite({authorization: user.token.authorization, orgId,
    userId: user.id, preferredSite: site, identityServiceUrl: process.env.IDENTITY_BASE_URL});
  saved.provisioning.status = 'preferred-site-set';
  saveUser();

  // CIG obtains its initial token BEFORE syncing the user to the meeting site.
  phase = 'user-login-after-provisioning';
  saved.token = await loginTestUser({email: saved.email, password: saved.password,
    orgId, scopes: process.env.WEBEX_SCOPE});
  saved.provisioning.status = 'complete';
  saveUser();
  const grantedScopes = saved.token.scope || saved.token.scopes || '';
  console.log(JSON.stringify({
    created: true,
    id: saved.id,
    credentialsFile: userPath,
    requestedMeetingPreferencesScope: (saved.requestedScopes || '').split(/\s+/).includes('meeting:preferences_read'),
    provisioning: saved.provisioning,
    grantedMeetingPreferencesScope: (Array.isArray(grantedScopes) ? grantedScopes : grantedScopes.split(/\s+/)).includes('meeting:preferences_read'),
    grantedScopes,
    expiresAt: saved.token.expires ? new Date(saved.token.expires).toISOString() : null,
  }, null, 2));
})().catch((error) => {
  const message = String(error.message || 'User creation failed');
  console.error(JSON.stringify({
    created: !!saved,
    phase,
    credentialsFile: saved ? userPath : undefined,
    name: error.name,
    statusCode: error.statusCode || error.status,
    summary: message.split('\n')[0].slice(0, 220),
    trackingId: message.match(/WEBEX_TRACKING_ID: ([\w-]+)/)?.[1],
  }, null, 2));
  process.exitCode = 1;
});
