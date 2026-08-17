import {Browser, expect, Page} from '@playwright/test';
import {TestManager} from '../test-manager';
import {
  isCallingClientRegistered,
  loginExtension,
  waitForCallingClientRegistered,
} from './incomingTaskUtils';

type CallingSamplePageKind = 'caller' | 'dialNumber';

type CallerPageOptions = {
  browser?: Browser;
  samplePage?: CallingSamplePageKind;
  includeDialNumberToken?: boolean;
  preferAgent2TokenBeforeGlobalCaller?: boolean;
  resetRegistration?: boolean;
  setupConsoleLogging?: (page: Page) => void;
  endCallSettleMs?: number;
  recreateOnReset?: boolean;
  waitForRegisteredAfterLoginMs?: number;
  waitForCreateCallEnabledAfterLoginMs?: number;
  strictRegisterClick?: boolean;
  registerTimeoutMs?: number;
  waitForRegisteredAfterRegisterMs?: number;
  waitAfterRegisterMs?: number;
  createReadyCheck?: 'enabled' | 'visible-form';
  recreateIfCreateCallNotReady?: boolean;
  createCallReadyAfterRecreateMs?: number;
};

const pageKey = (kind: CallingSamplePageKind) =>
  kind === 'dialNumber' ? 'dialNumberPage' : 'callerPage';

const contextKey = (kind: CallingSamplePageKind) =>
  kind === 'dialNumber' ? 'dialNumberContext' : 'callerExtensionContext';

const isChromeErrorPage = (page: Page): boolean => page.url().startsWith('chrome-error://');

function getCallerAccessToken(
  testManager: TestManager,
  options: Pick<
    CallerPageOptions,
    'includeDialNumberToken' | 'preferAgent2TokenBeforeGlobalCaller' | 'samplePage'
  > = {}
): string {
  if (options.samplePage === 'dialNumber') {
    return process.env.DIAL_NUMBER_LOGIN_ACCESS_TOKEN ?? '';
  }

  const projectCallerToken = process.env[`${testManager.projectName}_CALLER_ACCESS_TOKEN`];
  const globalCallerToken = process.env.CALLER_ACCESS_TOKEN;
  const agent2Token = process.env[`${testManager.projectName}_AGENT2_ACCESS_TOKEN`];
  const dialNumberToken = options.includeDialNumberToken
    ? process.env.DIAL_NUMBER_LOGIN_ACCESS_TOKEN
    : undefined;

  return options.preferAgent2TokenBeforeGlobalCaller
    ? projectCallerToken ?? agent2Token ?? globalCallerToken ?? dialNumberToken ?? ''
    : projectCallerToken ?? globalCallerToken ?? agent2Token ?? dialNumberToken ?? '';
}

export async function recreateCallerPage(
  testManager: TestManager,
  options: CallerPageOptions = {}
): Promise<Page> {
  const samplePage = options.samplePage ?? 'caller';
  const currentContext = testManager[contextKey(samplePage)];
  const browser = options.browser ?? currentContext.browser();
  if (!browser?.isConnected()) {
    throw new Error(`Cannot recreate ${samplePage} session: browser is unavailable`);
  }

  const currentPage = testManager[pageKey(samplePage)];
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.close().catch(() => {});
  }

  await currentContext.close().catch(() => {});

  const replacementContext = await browser.newContext({ignoreHTTPSErrors: true});
  const replacementPage = await replacementContext.newPage();
  testManager[contextKey(samplePage)] = replacementContext;
  testManager[pageKey(samplePage)] = replacementPage;
  options.setupConsoleLogging?.(replacementPage);

  await loginExtension(replacementPage, getCallerAccessToken(testManager, options));

  if (options.waitForRegisteredAfterLoginMs) {
    await replacementPage.locator('#destination').waitFor({state: 'visible', timeout: 20000});
    await waitForCallingClientRegistered(replacementPage, options.waitForRegisteredAfterLoginMs);
  }

  if (options.waitForCreateCallEnabledAfterLoginMs) {
    await expect(replacementPage.locator('#create-call-action')).toBeEnabled({
      timeout: options.waitForCreateCallEnabledAfterLoginMs,
    });
  }

  return replacementPage;
}

export async function ensureHealthyCallerPage(
  testManager: TestManager,
  options: CallerPageOptions = {}
): Promise<Page> {
  const samplePage = options.samplePage ?? 'caller';
  let page = testManager[pageKey(samplePage)];

  if (!page || page.isClosed() || isChromeErrorPage(page)) {
    page = await recreateCallerPage(testManager, options);
  }

  await page.bringToFront();
  const sampleLoaded = await page
    .locator('#destination')
    .waitFor({state: 'visible', timeout: 30000})
    .then(() => !isChromeErrorPage(page))
    .catch(() => false);

  if (!sampleLoaded) {
    page = await recreateCallerPage(testManager, options);
    await page.locator('#destination').waitFor({state: 'visible', timeout: 30000});
  }

  const endCallButton = page.locator('#end-call').first();
  const hasActiveCall = await endCallButton.isEnabled().catch(() => false);
  if (hasActiveCall) {
    await endCallButton.click().catch(() => {});
    await expect
      .poll(() => endCallButton.isEnabled().catch(() => false), {
        timeout: 15000,
        intervals: [500, 1000, 2000],
      })
      .toBeFalsy()
      .catch(() => {});

    if (options.endCallSettleMs) {
      await page.waitForTimeout(options.endCallSettleMs);
    }
  }

  if (options.resetRegistration && options.recreateOnReset) {
    page = await recreateCallerPage(testManager, options);
  }

  const registerButton = page.locator('#registration-register').first();
  const unregisterButton = page.locator('#registration-unregister').first();
  const isRegistered = await isCallingClientRegistered(page);

  if (options.resetRegistration && isRegistered) {
    const canUnregister = await unregisterButton.isEnabled().catch(() => false);
    if (canUnregister) {
      await unregisterButton.click().catch(() => {});
      await page.waitForTimeout(3000);
    }
  }

  const needsRegister = options.resetRegistration || !(await isCallingClientRegistered(page));
  if (needsRegister) {
    if (options.strictRegisterClick) {
      await expect(registerButton).toBeEnabled({timeout: options.registerTimeoutMs ?? 20000});
      await registerButton.click();
    } else {
      const canRegister = await registerButton.isEnabled().catch(() => false);
      if (canRegister) {
        await registerButton.click().catch(() => {});
      }
    }

    const registered = options.strictRegisterClick
      ? await waitForCallingClientRegistered(page, options.registerTimeoutMs ?? 20000)
          .then(() => true)
          .catch(() => false)
      : await expect
          .poll(() => isCallingClientRegistered(page), {
            timeout: options.registerTimeoutMs ?? 15000,
            intervals: [500, 1000, 2000],
          })
          .toBeTruthy()
          .then(() => true)
          .catch(() => false);

    if (!registered) {
      page = await recreateCallerPage(testManager, options);
    } else if (options.waitForRegisteredAfterRegisterMs) {
      await waitForCallingClientRegistered(page, options.waitForRegisteredAfterRegisterMs);
    }

    if (options.waitAfterRegisterMs) {
      await page.waitForTimeout(options.waitAfterRegisterMs);
    }
  }

  const createCallButton = page.locator('#create-call-action');
  if (options.createReadyCheck === 'visible-form') {
    const createCallReady = await expect
      .poll(
        async () => {
          const createCallVisible = await createCallButton.isVisible().catch(() => false);
          const destinationVisible = await page
            .locator('#destination')
            .isVisible()
            .catch(() => false);

          return createCallVisible && destinationVisible;
        },
        {timeout: 15000, intervals: [500, 1000, 2000]}
      )
      .toBeTruthy()
      .then(() => true)
      .catch(() => false);

    if (!createCallReady) {
      page = await recreateCallerPage(testManager, options);
    }
  } else {
    const expectCreateCallReady = () =>
      expect.poll(() => createCallButton.isEnabled().catch(() => false), {
        timeout: 15000,
        intervals: [500, 1000, 2000],
      });

    if (options.recreateIfCreateCallNotReady) {
      const createCallReady = await expectCreateCallReady()
        .toBeTruthy()
        .then(() => true)
        .catch(() => false);

      if (!createCallReady) {
        page = await recreateCallerPage(testManager, options);
        await expect(page.locator('#create-call-action')).toBeEnabled({
          timeout: options.createCallReadyAfterRecreateMs ?? 20000,
        });
      }
    } else {
      await expectCreateCallReady().toBeTruthy();
    }
  }

  await page.locator('#destination').fill('');

  return page;
}
