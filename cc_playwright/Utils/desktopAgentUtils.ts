/* eslint-disable no-await-in-loop */
import {Browser, Page, expect} from '@playwright/test';
import {LOGIN_MODE, USER_STATES} from '../constants';
import {TestManager} from '../test-manager';
import {pageSetup, waitForState} from './helperUtils';
import {hasStationReadyState, stationLogout, telephonyLogin} from './stationLoginUtils';
import {changeUserState, getCurrentState, verifyCurrentState} from './userStateUtils';

export type DesktopAgentKey = 'agent1' | 'agent2';

type AgentPageKey = 'agent1Page' | 'agent2Page';
type AgentContextKey = 'agent1Context' | 'agent2Context';

type AgentSessionOptions = {
  browser?: Browser;
  captureConsoleMessages?: boolean;
  setupConsoleLogging?: (page: Page) => void;
  targetState?: string;
  retries?: number;
  verifyTargetState?: boolean;
  reloginSettleMs?: number;
  postLoginSettleMs?: number;
  stationReadyTimeoutMs?: number;
};

const pageKey = (agentKey: DesktopAgentKey): AgentPageKey => `${agentKey}Page` as AgentPageKey;
const contextKey = (agentKey: DesktopAgentKey): AgentContextKey =>
  `${agentKey}Context` as AgentContextKey;

export const getDesktopAgentPage = (testManager: TestManager, agentKey: DesktopAgentKey): Page =>
  testManager[pageKey(agentKey)];

const getDesktopAgentContext = (testManager: TestManager, agentKey: DesktopAgentKey) =>
  testManager[contextKey(agentKey)];

const hasBrokenStationUi = async (page: Page): Promise<boolean> =>
  (await page
    .getByText('An error occurred while logging in to the station')
    .isVisible()
    .catch(() => false)) ||
  page
    .getByText('Multiple Agent Login Session Detected!')
    .isVisible()
    .catch(() => false);

async function waitForDesktopAgentReady(
  page: Page,
  targetState: string | undefined,
  options: AgentSessionOptions
): Promise<void> {
  await expect
    .poll(() => hasStationReadyState(page, LOGIN_MODE.DESKTOP).catch(() => false), {
      timeout: options.stationReadyTimeoutMs ?? 60000,
      intervals: [500, 1000, 2000],
    })
    .toBeTruthy();

  if (!targetState) {
    return;
  }

  if ((await getCurrentState(page).catch(() => '')) !== targetState) {
    await changeUserState(page, targetState);
  }

  await (options.verifyTargetState
    ? verifyCurrentState(page, targetState)
    : waitForState(page, targetState).catch(() => {}));
}

export async function recreateDesktopAgentPage(
  testManager: TestManager,
  agentKey: DesktopAgentKey,
  options: AgentSessionOptions = {}
): Promise<Page> {
  const retries = options.retries ?? 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    const browser = options.browser ?? getDesktopAgentContext(testManager, agentKey).browser();
    if (!browser?.isConnected()) {
      throw new Error(`Cannot recreate ${agentKey}: browser is unavailable`);
    }

    await getDesktopAgentPage(testManager, agentKey)
      ?.close()
      .catch(() => {});
    await getDesktopAgentContext(testManager, agentKey)
      .close()
      .catch(() => {});

    const context = await browser.newContext({ignoreHTTPSErrors: true});
    const page = await context.newPage();
    testManager[contextKey(agentKey)] = context;
    testManager[pageKey(agentKey)] = page;

    if (options.captureConsoleMessages) {
      page.on('console', (msg) => testManager.consoleMessages.push(msg.text()));
    }
    options.setupConsoleLogging?.(page);

    try {
      await pageSetup(
        page,
        LOGIN_MODE.DESKTOP,
        process.env[`${testManager.projectName}_${agentKey.toUpperCase()}_ACCESS_TOKEN`] ?? ''
      );
      await waitForDesktopAgentReady(page, options.targetState, options);

      return page;
    } catch (error) {
      lastError = error;
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }
  }

  throw lastError;
}

export async function ensureHealthyDesktopAgent(
  testManager: TestManager,
  agent: DesktopAgentKey | Page,
  targetState = USER_STATES.AVAILABLE,
  options: AgentSessionOptions = {}
): Promise<Page> {
  let agentKey: DesktopAgentKey = 'agent1';
  if (typeof agent === 'string') {
    agentKey = agent;
  } else if (agent === testManager.agent2Page) {
    agentKey = 'agent2';
  }
  let page = getDesktopAgentPage(testManager, agentKey);

  if (!page || page.isClosed()) {
    page = await recreateDesktopAgentPage(testManager, agentKey, {...options, targetState});
  }

  const frontReady = await page
    .bringToFront()
    .then(() => true)
    .catch(() => false);

  if (!frontReady) {
    page = await recreateDesktopAgentPage(testManager, agentKey, {...options, targetState});
    await page.bringToFront();
  }

  let currentState = await getCurrentState(page).catch(() => '');
  const needsRelogin =
    (await hasBrokenStationUi(page)) ||
    !currentState ||
    !(await hasStationReadyState(page, LOGIN_MODE.DESKTOP).catch(() => false));

  if (needsRelogin) {
    const recoveredInPlace = await (async () => {
      await stationLogout(page, false);
      await page.waitForTimeout(options.reloginSettleMs ?? 2000);
      await telephonyLogin(page, LOGIN_MODE.DESKTOP);
      await expect
        .poll(() => hasStationReadyState(page, LOGIN_MODE.DESKTOP).catch(() => false), {
          timeout: options.stationReadyTimeoutMs ?? 40000,
          intervals: [500, 1000, 2000],
        })
        .toBeTruthy();
      await page.waitForTimeout(options.postLoginSettleMs ?? 2000);

      return true;
    })().catch(() => false);

    if (!recoveredInPlace) {
      page = await recreateDesktopAgentPage(testManager, agentKey, {...options, targetState});
    }

    currentState = await getCurrentState(page).catch(() => '');
  }

  if (currentState !== targetState) {
    await changeUserState(page, targetState);
  }

  if (options.verifyTargetState) {
    await verifyCurrentState(page, targetState);
  }

  return page;
}
