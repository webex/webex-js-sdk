import {test as setup, Browser, Page} from '@playwright/test';
import {oauthLogin} from './Utils/initUtils';
import {USER_SETS} from './test-data';

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.resolve(__dirname, '.env');
const OAUTH_BATCH_SIZE = 4;
const OAUTH_SET_GROUP_SIZE = 2;
const OAUTH_TOKEN_WAIT_TIMEOUT = 30000;

type EnvUpdateMap = Record<string, string>;

interface OAuthTask {
  envKey: string;
  username: string;
  password?: string;
}

type UserSetKey = keyof typeof USER_SETS;

const readEnvFile = (): string => {
  if (!fs.existsSync(ENV_PATH)) {
    return '';
  }

  return fs.readFileSync(ENV_PATH, 'utf8');
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const upsertEnvVariables = (updates: EnvUpdateMap): void => {
  let envContent = readEnvFile();

  for (const [key, value] of Object.entries(updates)) {
    const keyPattern = new RegExp(`^${escapeRegExp(key)}=.*$\\n?`, 'm');
    envContent = envContent.replace(keyPattern, '');

    if (!envContent.endsWith('\n') && envContent.length > 0) {
      envContent += '\n';
    }
    envContent += `${key}=${value}\n`;
    process.env[key] = value;
  }

  envContent = envContent.replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(ENV_PATH, envContent, 'utf8');
};

const buildOAuthTasksForSet = (setKey: UserSetKey): OAuthTask[] => {
  const domain = process.env.PW_SANDBOX;
  const tasks: OAuthTask[] = [];
  const userSet = USER_SETS[setKey];

  for (const agentKey of Object.keys(userSet.AGENTS)) {
    const username = `${userSet.AGENTS[agentKey].username}@${domain}`;
    tasks.push({
      envKey: `${setKey}_${agentKey}_ACCESS_TOKEN`,
      username,
    });
  }

  return tasks;
};

const buildOAuthTasksForSetGroup = (setKeys: UserSetKey[]): OAuthTask[] => {
  return setKeys.flatMap((setKey) => buildOAuthTasksForSet(setKey));
};

const buildSetGroups = (setKeys: UserSetKey[], groupSize: number): UserSetKey[][] => {
  if (groupSize <= 0) {
    throw new Error('groupSize must be greater than 0');
  }

  const groups: UserSetKey[][] = [];
  for (let index = 0; index < setKeys.length; index += groupSize) {
    groups.push(setKeys.slice(index, index + groupSize));
  }

  return groups;
};

const buildDialNumberTask = (): OAuthTask | null => {
  const dialNumberUsername = process.env.PW_DIAL_NUMBER_LOGIN_USERNAME;
  const dialNumberPassword = process.env.PW_DIAL_NUMBER_LOGIN_PASSWORD;

  if (dialNumberUsername && dialNumberPassword) {
    return {
      envKey: 'DIAL_NUMBER_LOGIN_ACCESS_TOKEN',
      username: dialNumberUsername,
      password: dialNumberPassword,
    };
  }

  return null;
};

const readAccessToken = async (page: Page): Promise<string> => {
  const inputToken = await page
    .locator('#access-token')
    .inputValue()
    .then((value) => value.trim())
    .catch(() => '');
  if (inputToken) {
    return inputToken;
  }

  const sessionToken = await page
    .evaluate(() => sessionStorage.getItem('access-token')?.trim() ?? '')
    .catch(() => '');

  return sessionToken;
};

const fetchOAuthAccessToken = async (
  browser: Browser,
  username: string,
  password?: string
): Promise<string> => {
  const context = await browser.newContext({ignoreHTTPSErrors: true});
  const page = await context.newPage();

  try {
    await oauthLogin(page, username, password);

    const start = Date.now();
    let token = '';
    while (Date.now() - start < OAUTH_TOKEN_WAIT_TIMEOUT) {
      token = await readAccessToken(page);
      if (token) {
        return token;
      }
      await page.waitForTimeout(300);
    }

    throw new Error(
      `OAuth token not available for ${username} within ${OAUTH_TOKEN_WAIT_TIMEOUT}ms`
    );
  } finally {
    await context.close().catch(() => {});
  }
};

const collectTokensInBatches = async (
  browser: Browser,
  tasks: OAuthTask[]
): Promise<EnvUpdateMap> => {
  const tokenUpdates: EnvUpdateMap = {};

  for (let index = 0; index < tasks.length; index += OAUTH_BATCH_SIZE) {
    const batch = tasks.slice(index, index + OAUTH_BATCH_SIZE);
    const batchTokens = await Promise.all(
      batch.map((task) => fetchOAuthAccessToken(browser, task.username, task.password))
    );

    batch.forEach((task, batchIndex) => {
      tokenUpdates[task.envKey] = batchTokens[batchIndex];
    });
  }

  return tokenUpdates;
};

export const UpdateENVWithUserSets = () => {
  // Constants
  const DOMAIN = process.env.PW_SANDBOX;
  const updates: EnvUpdateMap = {};

  // Dynamically set environment variables for all user sets
  Object.keys(USER_SETS).forEach((setKey) => {
    const userSet = USER_SETS[setKey];

    // Set agent usernames and extensions - access agents through userSet.AGENTS
    Object.keys(userSet.AGENTS).forEach((agentKey) => {
      const agent = userSet.AGENTS[agentKey];

      updates[`${setKey}_${agentKey}_USERNAME`] = `${agent.username}@${DOMAIN}`;
      updates[`${setKey}_${agentKey}_EXTENSION_NUMBER`] = agent.extension;
      updates[`${setKey}_${agentKey}_NAME`] = agent.agentName || '';
    });

    updates[`${setKey}_ENTRY_POINT`] = userSet.ENTRY_POINT || '';
    updates[`${setKey}_EMAIL_ENTRY_POINT`] = userSet.EMAIL_ENTRY_POINT || '';
    updates[`${setKey}_QUEUE_NAME`] = userSet.QUEUE_NAME || '';
    updates[`${setKey}_CHAT_URL`] = userSet.CHAT_URL || '';
  });

  return updates;
};

const runOAuthSetGroup = async (browser: Browser, setGroup: UserSetKey[]) => {
  const tasks = buildOAuthTasksForSetGroup(setGroup);

  return collectTokensInBatches(browser, tasks);
};

setup('OAuth', async ({browser}) => {
  const userSetKeys = Object.keys(USER_SETS) as UserSetKey[];
  const oauthSetGroups = buildSetGroups(userSetKeys, OAUTH_SET_GROUP_SIZE);

  // Collect all environment updates
  const userSetUpdates = UpdateENVWithUserSets();
  const groupedTokenUpdates = await Promise.all(
    oauthSetGroups.map((setGroup) => runOAuthSetGroup(browser, setGroup))
  );
  const tokenUpdates = groupedTokenUpdates.reduce<EnvUpdateMap>(
    (acc, groupTokens) => ({...acc, ...groupTokens}),
    {}
  );

  // Fetch dial number token (if configured)
  const dialNumberTask = buildDialNumberTask();
  if (dialNumberTask) {
    const dialNumberToken = await fetchOAuthAccessToken(
      browser,
      dialNumberTask.username,
      dialNumberTask.password
    );
    tokenUpdates[dialNumberTask.envKey] = dialNumberToken;
  }

  const allUpdates = {...userSetUpdates, ...tokenUpdates};

  // Write everything at once
  upsertEnvVariables(allUpdates);
});
