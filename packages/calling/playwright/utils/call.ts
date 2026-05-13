import {Page, expect} from '@playwright/test';
import {CALLING_SELECTORS, AWAIT_TIMEOUT} from '../constants';

/**
 * Race a promise against a Node.js-side timeout.
 * Playwright's page.waitForFunction timeout sometimes doesn't fire
 * (possibly due to WebRTC/media operations blocking the browser),
 * so we enforce an independent timeout from the Node.js side.
 */
const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
};

export const getMediaStreams = async (page: Page): Promise<void> => {
  await page.locator(CALLING_SELECTORS.GET_MEDIA_STREAMS_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(CALLING_SELECTORS.MAKE_CALL_BTN)).toBeEnabled({timeout: AWAIT_TIMEOUT});
};

export const makeCall = async (page: Page, destination: string): Promise<void> => {
  await page
    .locator(CALLING_SELECTORS.DESTINATION_INPUT)
    .fill(destination, {timeout: AWAIT_TIMEOUT});
  await page.locator(CALLING_SELECTORS.MAKE_CALL_BTN).click({timeout: AWAIT_TIMEOUT});
};

export const waitForIncomingCall = async (page: Page): Promise<void> => {
  await expect(page.locator(CALLING_SELECTORS.INCOMING_ANSWER_BTN)).toBeEnabled({timeout: 30000});
};

export const answerCall = async (page: Page): Promise<void> => {
  const answer = page.locator(CALLING_SELECTORS.INCOMING_ANSWER_BTN);
  await answer.click({timeout: AWAIT_TIMEOUT});
  await expect(answer).toBeDisabled({
    timeout: AWAIT_TIMEOUT,
  });
};

/**
 * Caller starts a consult transfer; transfer target page answers as soon as the consult leg rings.
 * Brings the target page forward (reduces background-tab throttling) and starts waiting for the
 * incoming Answer control before clicking Transfer, so the post-click window to answer is minimal.
 */
export const consultTransferDialAndAnswerOnTarget = async (
  callerPage: Page,
  transferPage: Page,
  transferNumber: string
): Promise<void> => {
  await transferPage.bringToFront();
  await callerPage.locator(CALLING_SELECTORS.TRANSFER_OPTIONS).selectOption({index: 1});
  await callerPage.locator(CALLING_SELECTORS.TRANSFER_TARGET_INPUT).fill(transferNumber);
  const incomingReady = waitForIncomingCall(transferPage);
  await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});
  await incomingReady;
  await answerCall(transferPage);
};

export const waitForCallEstablished = async (page: Page, timeout = 30000): Promise<void> => {
  await withTimeout(
    page.waitForFunction(
      () => {
        const client = (window as any).callingClient;
        if (!client) return false;
        const calls = client.getActiveCalls();

        return Object.values(calls)
          .flat()
          .some((c: any) => c.isConnected());
      },
      {timeout}
    ),
    timeout,
    'waitForCallEstablished'
  );
};

export const endCall = async (page: Page): Promise<void> => {
  await page.locator(CALLING_SELECTORS.END_CALL_BTN).click({timeout: AWAIT_TIMEOUT});
  await page.waitForFunction(
    () => {
      const client = (window as any).callingClient;
      if (!client) return false;
      const calls = client.getActiveCalls();

      return Object.values(calls)
        .flat()
        .every((c: any) => !c.isConnected());
    },
    {timeout: AWAIT_TIMEOUT}
  );
};

export const endIncomingCall = async (page: Page): Promise<void> => {
  await page.locator(CALLING_SELECTORS.END_BTN).click({timeout: AWAIT_TIMEOUT});
  await page.waitForFunction(
    () => {
      const client = (window as any).callingClient;
      if (!client) return false;
      const calls = client.getActiveCalls();

      return Object.values(calls)
        .flat()
        .every((c: any) => !c.isConnected());
    },
    {timeout: AWAIT_TIMEOUT}
  );
};

export const rejectCall = async (page: Page): Promise<void> => {
  await page.locator(CALLING_SELECTORS.END_BTN).click({timeout: AWAIT_TIMEOUT});
  await page.waitForFunction(
    () => {
      const client = (window as any).callingClient;
      if (!client) return false;
      const calls = client.getActiveCalls();

      return Object.values(calls)
        .flat()
        .every((c: any) => !c.isConnected());
    },
    {timeout: 30000}
  );
};

/** Delay before hold/resume to let Mobius stabilise server-side call state. */
const HOLD_STABILISATION_DELAY = 4000;
/** How long to wait for the SDK held/resumed event from Mobius. */
const HOLD_RESUME_TIMEOUT = 15000;

export const holdCall = async (page: Page): Promise<void> => {
  await expect(page.locator(CALLING_SELECTORS.HOLD_BTN)).toHaveValue('Hold', {
    timeout: AWAIT_TIMEOUT,
  });
  await page.waitForTimeout(HOLD_STABILISATION_DELAY);
  await page.locator(CALLING_SELECTORS.HOLD_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(CALLING_SELECTORS.HOLD_BTN)).toHaveValue('Resume', {
    timeout: HOLD_RESUME_TIMEOUT,
  });
};

export const resumeCall = async (page: Page): Promise<void> => {
  const holdButton = page.locator(CALLING_SELECTORS.HOLD_BTN);

  await expect
    .poll(async () => holdButton.inputValue(), {
      timeout: AWAIT_TIMEOUT,
      message: 'Expected hold button to reach a resumable or already-resumed state',
    })
    .toMatch(/^(Resume|Hold)$/);

  if ((await holdButton.inputValue()) === 'Hold') {
    return;
  }

  await page.waitForTimeout(HOLD_STABILISATION_DELAY);
  await holdButton.click({timeout: AWAIT_TIMEOUT});
  await expect(holdButton).toHaveValue('Hold', {
    timeout: HOLD_RESUME_TIMEOUT,
  });
};

export const sendDTMF = async (page: Page, digit: string): Promise<void> => {
  await page.locator(CALLING_SELECTORS.DTMF_INPUT).fill(digit, {timeout: AWAIT_TIMEOUT});
  await page.locator(CALLING_SELECTORS.SEND_DIGIT_BTN).click({timeout: AWAIT_TIMEOUT});
};

export const waitForCallDisconnect = async (page: Page, timeout = 30000): Promise<void> => {
  await page.waitForFunction(
    () => {
      const client = (window as any).callingClient;
      if (!client) return false;
      const calls = client.getActiveCalls();

      return Object.values(calls)
        .flat()
        .every((c: any) => !c.isConnected());
    },
    {timeout}
  );
  await expect(page.locator(CALLING_SELECTORS.MAKE_CALL_BTN)).toBeEnabled({
    timeout: AWAIT_TIMEOUT,
  });
};

/** Timeout for the entire tryEstablishCall sequence per attempt. */
const ATTEMPT_TIMEOUT = 60000;

/**
 * Attempt a single call: make → incoming → answer → established.
 * The whole sequence is capped at ATTEMPT_TIMEOUT to enable fast retry.
 */
const tryEstablishCall = async (
  callerPage: Page,
  calleePage: Page,
  calleeNumber: string
): Promise<void> => {
  await withTimeout(
    (async () => {
      await makeCall(callerPage, calleeNumber);
      await waitForIncomingCall(calleePage);
      await answerCall(calleePage);
      await Promise.all([
        waitForCallEstablished(callerPage, ATTEMPT_TIMEOUT),
        waitForCallEstablished(calleePage, ATTEMPT_TIMEOUT),
      ]);
    })(),
    ATTEMPT_TIMEOUT,
    'tryEstablishCall'
  );
};

/**
 * Establish a call between caller and callee, retrying up to 2 times on failure.
 * Both pages must already be set up with SDK init, registration, and media.
 *
 * ROAP media negotiation can intermittently fail between successive calls
 * on the same browser context. Retries with cleanup and media refresh handle this.
 */
export const establishCall = async (
  callerPage: Page,
  calleePage: Page,
  calleeNumber: string
): Promise<void> => {
  const retryDelays = [3000, 8000]; // increasing delay between retries
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await tryEstablishCall(callerPage, calleePage, calleeNumber);

      return;
    } catch (e) {
      lastError = e as Error;
      if (attempt < retryDelays.length) {
        if (callerPage.isClosed() || calleePage.isClosed()) throw lastError;
        // eslint-disable-next-line no-console
        console.log(
          `[establishCall] attempt ${attempt + 1} failed (${lastError.message}), retrying in ${
            retryDelays[attempt]
          }ms...`
        );
        // eslint-disable-next-line no-await-in-loop
        await Promise.all([cleanupActiveCalls(callerPage), cleanupActiveCalls(calleePage)]);
        // Refresh media streams to reset WebRTC state before retrying
        // eslint-disable-next-line no-await-in-loop
        await Promise.all([getMediaStreams(callerPage), getMediaStreams(calleePage)]);
        // eslint-disable-next-line no-await-in-loop
        await callerPage.waitForTimeout(retryDelays[attempt]);
      }
    }
  }
  throw lastError;
};

/**
 * Wait for the consult transfer target to answer and the Commit button to appear.
 * The sample app changes #transfer text to "Commit" and enables #end-second on established.
 */
export const waitForTransferCommitReady = async (page: Page): Promise<void> => {
  await expect(page.locator(CALLING_SELECTORS.END_SECOND_CALL_BTN)).toBeEnabled({
    timeout: 30000,
  });
  await expect(page.locator(CALLING_SELECTORS.TRANSFER_BTN)).toContainText('Commit', {
    timeout: AWAIT_TIMEOUT,
  });
};

/**
 * Complete (commit) a consult transfer by clicking the Commit button.
 * Call waitForTransferCommitReady first to ensure the button is ready.
 */
export const completeConsultTransfer = async (page: Page): Promise<void> => {
  await page.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});
};

/**
 * Clean up any active calls on a page. Best-effort — won't fail the next test.
 */
export const cleanupActiveCalls = async (page: Page): Promise<void> => {
  if (page.isClosed()) return;

  try {
    const getActiveCallCount = () =>
      page.evaluate(() => {
        const client = (window as any).callingClient;
        if (!client) return 0;
        const calls = client.getActiveCalls();

        return Object.values(calls).flat().length;
      });

    const hasActiveCalls = (await getActiveCallCount()) > 0;

    if (!hasActiveCalls) return;

    const clickIfEnabled = async (selector: string) => {
      const button = page.locator(selector);
      const isVisible = await button.isVisible().catch(() => false);
      const isEnabled = isVisible ? await button.isEnabled().catch(() => false) : false;

      if (isEnabled) {
        await button.click({timeout: 5000}).catch(() => {});
      }
    };

    // Retry loop intentionally serial — each attempt depends on the previous one's side effects.
    /* eslint-disable no-await-in-loop */
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await clickIfEnabled(CALLING_SELECTORS.END_SECOND_CALL_BTN);
      await clickIfEnabled(CALLING_SELECTORS.END_CALL_BTN);
      await clickIfEnabled(CALLING_SELECTORS.END_BTN);

      await page
        .evaluate(() => {
          const client = (window as any).callingClient;
          if (!client) return;
          const calls = Object.values(client.getActiveCalls()).flat() as any[];

          calls.forEach((call) => {
            try {
              call.end?.();
            } catch {
              // Best effort
            }
          });
        })
        .catch(() => {});

      const cleared = await page
        .waitForFunction(
          () => {
            const client = (window as any).callingClient;
            if (!client) return true;
            const calls = client.getActiveCalls();

            return Object.values(calls).flat().length === 0;
          },
          {timeout: 5000}
        )
        .then(() => true)
        .catch(() => false);

      if (cleared) {
        break;
      }

      await page.waitForTimeout(1000).catch(() => {});
    }
    /* eslint-enable no-await-in-loop */

    await page
      .waitForFunction(
        () => {
          const client = (window as any).callingClient;
          if (!client) return true;
          const calls = client.getActiveCalls();

          return Object.values(calls).flat().length === 0;
        },
        {timeout: 15000}
      )
      .catch(() => {});

    if ((await getActiveCallCount()) === 0) {
      await expect(page.locator(CALLING_SELECTORS.MAKE_CALL_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });
    }
  } catch {
    // Best effort
  }
};
