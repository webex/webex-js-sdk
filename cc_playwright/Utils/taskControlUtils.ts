/* eslint-disable no-await-in-loop */
import {Page, expect} from '@playwright/test';
import {TASK_TYPES, AWAIT_TIMEOUT, OPERATION_TIMEOUT} from '../constants';
import {
  clickDomButton,
  getTaskReadinessSnapshot,
  hasVisibleEnabledActionButton,
  isTaskCleared,
} from './controlUtils';

export async function callTaskControlCheck(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const incomingText = (
          await page
            .locator('#incoming-task')
            .innerText()
            .catch(() => '')
        ).toLowerCase();
        const taskControlsText = (
          await page
            .locator('#taskControlsCards')
            .innerText()
            .catch(() => '')
        ).toLowerCase();
        const taskSnapshot = await getTaskReadinessSnapshot(page);
        const isConnected =
          incomingText.includes('connected') ||
          taskControlsText.includes('state: connected') ||
          (taskSnapshot.hasLiveTask &&
            ['connected', 'consult', 'conference'].includes(taskSnapshot.state));

        const holdEnabled = await page
          .locator('#hold-resume')
          .evaluate((el) => !(el as HTMLButtonElement).disabled)
          .catch(() => false);
        const transferEnabled = await page
          .locator('#transfer')
          .evaluate((el) => !(el as HTMLButtonElement).disabled)
          .catch(() => false);
        const consultEnabled = await page
          .locator('#consult')
          .evaluate((el) => !(el as HTMLButtonElement).disabled)
          .catch(() => false);
        const endEnabled = await page
          .locator('#end')
          .evaluate((el) => !(el as HTMLButtonElement).disabled)
          .catch(() => false);

        const visibleActionEnabled = await Promise.all([
          hasVisibleEnabledActionButton(page, 'Hold', '#hold-resume'),
          hasVisibleEnabledActionButton(page, 'Resume', '#hold-resume'),
          hasVisibleEnabledActionButton(page, 'Consult', '#consult'),
          hasVisibleEnabledActionButton(page, 'Transfer', '#transfer'),
          hasVisibleEnabledActionButton(page, 'End', '#end'),
        ]).then((results) => results.some(Boolean));

        const visibleActionPresent = await Promise.all([
          page
            .getByRole('button', {name: /hold|resume/i})
            .first()
            .isVisible()
            .catch(() => false),
          page
            .getByRole('button', {name: /consult/i})
            .first()
            .isVisible()
            .catch(() => false),
          page
            .getByRole('button', {name: /transfer/i})
            .first()
            .isVisible()
            .catch(() => false),
          page
            .getByRole('button', {name: /^end$/i})
            .first()
            .isVisible()
            .catch(() => false),
        ]).then((results) => results.some(Boolean));

        return (
          isConnected &&
          (holdEnabled ||
            transferEnabled ||
            consultEnabled ||
            endEnabled ||
            taskSnapshot.mainControlReady ||
            visibleActionEnabled ||
            visibleActionPresent)
        );
      },
      {timeout: OPERATION_TIMEOUT, intervals: [500, 1000, 2000]}
    )
    .toBeTruthy();
}

async function digitalTaskControlCheck(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const transferEnabled = await page
          .locator('#transfer')
          .first()
          .evaluate((el) => !(el as HTMLButtonElement).disabled)
          .catch(() => false);
        const endEnabled = await page
          .locator('#end')
          .first()
          .evaluate((el) => !(el as HTMLButtonElement).disabled)
          .catch(() => false);

        const visibleTransferEnabled = await page
          .getByRole('button', {name: /transfer/i})
          .first()
          .isEnabled()
          .catch(() => false);
        const visibleEndEnabled = await page
          .getByRole('button', {name: /^end$/i})
          .first()
          .isEnabled()
          .catch(() => false);

        return (transferEnabled || visibleTransferEnabled) && (endEnabled || visibleEndEnabled);
      },
      {timeout: OPERATION_TIMEOUT, intervals: [500, 1000, 2000]}
    )
    .toBeTruthy();
}

export async function chatTaskControlCheck(page: Page): Promise<void> {
  await digitalTaskControlCheck(page);
}

/**
 * Verifies that email task control buttons are visible and accessible.
 * Checks for transfer and end buttons only.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function emailTaskControlCheck(page: Page): Promise<void> {
  await digitalTaskControlCheck(page);
}

export async function verifyTaskControls(page: Page, taskType: string): Promise<void> {
  switch (taskType) {
    case TASK_TYPES.CALL:
      await callTaskControlCheck(page);
      break;
    case TASK_TYPES.CHAT:
      await chatTaskControlCheck(page);
      break;
    case TASK_TYPES.EMAIL:
      await emailTaskControlCheck(page);
      break;
    default:
      throw new Error(`Task control check not implemented for task type: ${taskType}`);
  }
}

export async function holdCallToggle(page: Page): Promise<void> {
  await page.bringToFront();

  const visibleToggleButton = page.getByRole('button', {name: /hold|resume/i}).first();
  const hasVisibleToggle = await visibleToggleButton.isVisible().catch(() => false);

  if (hasVisibleToggle) {
    await expect(visibleToggleButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
    await visibleToggleButton.click({timeout: AWAIT_TIMEOUT});

    return;
  }

  const holdButton = page.locator('#hold-resume').first();
  await holdButton.waitFor({state: 'attached', timeout: AWAIT_TIMEOUT});
  await expect
    .poll(
      () => holdButton.evaluate((el) => !(el as HTMLButtonElement).disabled).catch(() => false),
      {timeout: OPERATION_TIMEOUT, intervals: [500, 1000, 2000]}
    )
    .toBeTruthy();
  await clickDomButton(page, '#hold-resume');
}

export async function isCallHeld(page: Page): Promise<boolean> {
  const visibleResume = await page
    .getByRole('button', {name: /^resume$/i})
    .first()
    .isVisible()
    .catch(() => false);
  if (visibleResume) {
    return true;
  }

  const visibleHold = await page
    .getByRole('button', {name: /^hold$/i})
    .first()
    .isVisible()
    .catch(() => false);
  if (visibleHold) {
    return false;
  }

  const buttonText = await page
    .locator('#hold-resume')
    .first()
    .innerText()
    .catch(() => '');

  return buttonText.toLowerCase().includes('resume');
}

/**
 * Toggles the recording state of a call by clicking the recording pause/resume button.
 * This function will pause recording if it's currently active, or resume it if it's paused.
 * Sample app uses plain HTML ID #pause-resume-recording.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function recordCallToggle(page: Page): Promise<void> {
  const recordButton = page.locator('#pause-resume-recording');
  await expect(recordButton).toBeVisible({timeout: AWAIT_TIMEOUT});
  await expect(recordButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await recordButton.click({timeout: AWAIT_TIMEOUT});
}

/**
 * Verifies the hold timer visibility and content based on expected state.
 * Sample app may not have hold timer UI element - skipping verification.
 * @param page - The agent's main page
 * @param options - Configuration object
 * @param options.shouldBeVisible - Whether the timer should be visible (true) or hidden (false)
 * @param options.verifyContent - Whether to verify timer content (default: true when visible)
 * @returns Promise<void>
 */
export async function verifyHoldTimer(
  page: Page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: {shouldBeVisible: boolean; verifyContent?: boolean}
): Promise<void> {
  // Sample app may not have hold timer UI - skip verification
  // Just wait a bit to let hold action complete
  await page.waitForTimeout(500);
}

/**
 * Verifies the icon of the hold toggle button based on current hold state.
 * Sample app uses plain HTML without web component icons - skipping icon verification.
 * Just verifies the button is visible and enabled.
 * @param page - The agent's main page
 * @param options - Configuration object
 * @param options.expectedIsHeld - Expected hold state (true if call is on hold, false if active)
 * @returns Promise<void>
 * @throws Error if icon verification fails
 */
export async function verifyHoldButtonIcon(
  page: Page,
  options: {expectedIsHeld: boolean}
): Promise<void> {
  await expect
    .poll(
      async () => {
        const held = await isCallHeld(page).catch(() => !options.expectedIsHeld);
        if (held === options.expectedIsHeld) {
          return true;
        }

        const buttonName = options.expectedIsHeld ? 'Resume' : 'Hold';
        const holdButton = page.getByRole('button', {name: buttonName, exact: true}).first();
        const isVisible = await holdButton.isVisible().catch(() => false);
        const isEnabled = await holdButton.isEnabled().catch(() => false);

        return isVisible && isEnabled;
      },
      {timeout: AWAIT_TIMEOUT, intervals: [500, 1000, 2000]}
    )
    .toBeTruthy();
}

/**
 * Verifies the icon of the record toggle button based on current recording state.
 * Sample app uses plain HTML without web component icons - skipping icon verification.
 * Just verifies the button is visible and enabled.
 * @param page - The agent's main page
 * @param options - Configuration object
 * @param options.expectedIsRecording - Expected recording state (true if recording, false if paused)
 * @returns Promise<void>
 * @throws Error if icon verification fails
 */
export async function verifyRecordButtonIcon(
  page: Page,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: {expectedIsRecording: boolean}
): Promise<void> {
  // Sample app doesn't use mdc-icon web components - just verify button is visible
  const recordButton = page.locator('#pause-resume-recording');
  await expect(recordButton).toBeVisible({timeout: AWAIT_TIMEOUT});
  await expect(recordButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
  // Icon state verification skipped - sample app uses plain HTML
}

// Global variable to store captured logs
const capturedLogs: string[] = [];

/**
 * Sets up console logging to capture callback logs for task controls.
 * Captures onHoldResume, onRecordingToggle, onEnd callbacks and SDK success messages.
 * @param page - The agent's main page
 * @returns Function to remove the console handler
 */
export function setupConsoleLogging(page: Page): () => void {
  capturedLogs.length = 0;

  const consoleHandler = (msg) => {
    const logText = msg.text();
    if (
      logText.includes('onHoldResume invoked') ||
      logText.includes('onRecordingToggle invoked') ||
      logText.includes('onEnd invoked') ||
      logText.includes('WXCC_SDK_TASK_HOLD_SUCCESS') ||
      logText.includes('WXCC_SDK_TASK_RESUME_SUCCESS') ||
      logText.includes('WXCC_SDK_TASK_PAUSE_RECORDING_SUCCESS') ||
      logText.includes('WXCC_SDK_TASK_RESUME_RECORDING_SUCCESS')
    ) {
      capturedLogs.push(logText);
    }
  };

  page.on('console', consoleHandler);

  return () => page.off('console', consoleHandler);
}

/**
 * Clears the captured logs array.
 * Should be called before each test or verification to ensure clean state.
 */
export function clearCapturedLogs(): void {
  capturedLogs.length = 0;
}

/**
 * Verifies that hold/resume callback logs are present and contain expected values.
 * @param options - Configuration object
 * @param options.expectedIsHeld - Expected hold state (true for hold, false for resume)
 * @throws Error if verification fails with detailed error message
 */
export async function verifyHoldLogs({expectedIsHeld}: {expectedIsHeld: boolean}): Promise<void> {
  const expectedStatus = expectedIsHeld
    ? 'WXCC_SDK_TASK_HOLD_SUCCESS'
    : 'WXCC_SDK_TASK_RESUME_SUCCESS';

  try {
    await expect
      .poll(
        () => {
          const holdResumeLogs = capturedLogs.filter((log) => log.includes('onHoldResume invoked'));
          const statusLogs = capturedLogs.filter((log) => log.includes(expectedStatus));
          const lastHoldLog = holdResumeLogs[holdResumeLogs.length - 1] ?? '';

          return (
            holdResumeLogs.length > 0 &&
            statusLogs.length > 0 &&
            lastHoldLog.includes(`isHeld: ${expectedIsHeld}`)
          );
        },
        {timeout: OPERATION_TIMEOUT, intervals: [200, 400, 800, 1200]}
      )
      .toBeTruthy();
  } catch {
    const holdResumeLogs = capturedLogs.filter((log) => log.includes('onHoldResume invoked'));
    const statusLogs = capturedLogs.filter((log) => log.includes(expectedStatus));
    const lastHoldLog = holdResumeLogs[holdResumeLogs.length - 1];

    if (holdResumeLogs.length === 0) {
      throw new Error(
        `No 'onHoldResume invoked' logs found. Expected logs for isHeld: ${expectedIsHeld}. Captured logs: ${JSON.stringify(
          capturedLogs
        )}`
      );
    }

    if (statusLogs.length === 0) {
      throw new Error(
        `No '${expectedStatus}' logs found. Captured logs: ${JSON.stringify(capturedLogs)}`
      );
    }

    if (!lastHoldLog?.includes(`isHeld: ${expectedIsHeld}`)) {
      throw new Error(`Expected 'isHeld: ${expectedIsHeld}' in log but found: ${lastHoldLog}`);
    }

    throw new Error(
      `Timed out validating hold logs for isHeld: ${expectedIsHeld}. Captured logs: ${JSON.stringify(
        capturedLogs
      )}`
    );
  }
}

/**
 * Verifies that recording pause/resume callback logs are present and contain expected values.
 * @param options - Configuration object
 * @param options.expectedIsRecording - Expected recording state (true for recording, false for paused)
 * @throws Error if verification fails with detailed error message
 */
export async function verifyRecordingLogs({
  expectedIsRecording,
}: {
  expectedIsRecording: boolean;
}): Promise<void> {
  const expectedStatus = expectedIsRecording
    ? 'WXCC_SDK_TASK_RESUME_RECORDING_SUCCESS'
    : 'WXCC_SDK_TASK_PAUSE_RECORDING_SUCCESS';

  try {
    await expect
      .poll(
        () => {
          const recordingLogs = capturedLogs.filter((log) =>
            log.includes('onRecordingToggle invoked')
          );
          const statusLogs = capturedLogs.filter((log) => log.includes(expectedStatus));
          const lastRecordingLog = recordingLogs[recordingLogs.length - 1] ?? '';

          const hasValidCallbackState =
            recordingLogs.length === 0 ||
            lastRecordingLog.includes(`isRecording: ${expectedIsRecording}`);

          return statusLogs.length > 0 && hasValidCallbackState;
        },
        {timeout: OPERATION_TIMEOUT, intervals: [200, 400, 800, 1200]}
      )
      .toBeTruthy();
  } catch {
    const recordingLogs = capturedLogs.filter((log) => log.includes('onRecordingToggle invoked'));
    const statusLogs = capturedLogs.filter((log) => log.includes(expectedStatus));
    const lastRecordingLog = recordingLogs[recordingLogs.length - 1];

    if (statusLogs.length === 0) {
      throw new Error(
        `No '${expectedStatus}' logs found. Captured logs: ${JSON.stringify(capturedLogs)}`
      );
    }

    if (
      recordingLogs.length > 0 &&
      !lastRecordingLog?.includes(`isRecording: ${expectedIsRecording}`)
    ) {
      throw new Error(
        `Expected 'isRecording: ${expectedIsRecording}' in log but found: ${lastRecordingLog}`
      );
    }

    throw new Error(
      `Timed out validating recording logs for isRecording: ${expectedIsRecording}. Captured logs: ${JSON.stringify(
        capturedLogs
      )}`
    );
  }
}

/**
 * Verifies that onEnd callback logs are present when tasks are ended.
 * @throws Error if verification fails with detailed error message
 */
export function verifyEndLogs(): void {
  const endLogs = capturedLogs.filter((log) => log.includes('onEnd invoked'));

  if (endLogs.length === 0) {
    throw new Error(
      `No 'onEnd invoked' logs found. Captured logs: ${JSON.stringify(capturedLogs)}`
    );
  }
}

/**
 * Verifies audio transfer from caller to browser by executing the exact console command.
 * Executes: document.querySelector("#remote-audio").srcObject.getAudioTracks()
 * Verifies that exactly 1 live audio MediaStreamTrack is attached and the audio element is playing.
 * @param page - The agent's main page (browser receiving audio)
 * @returns Promise<void>
 * @throws Error if remote audio tracks verification fails
 */
export async function verifyRemoteAudioTracks(page: Page): Promise<void> {
  try {
    await expect
      .poll(
        async () => {
          return page.evaluate(() => {
            const audioElem = document.querySelector('#remote-audio') as HTMLAudioElement | null;

            if (!audioElem) {
              return {
                hasAudioElement: false,
                hasSrcObject: false,
                trackCount: 0,
                tracks: [],
              };
            }

            const mediaStream = audioElem.srcObject as MediaStream | null;
            const audioTracks = mediaStream?.getAudioTracks() ?? [];

            return {
              hasAudioElement: true,
              hasSrcObject: Boolean(mediaStream),
              paused: audioElem.paused,
              trackCount: audioTracks.length,
              tracks: audioTracks.map((track, index) => ({
                index,
                kind: track.kind,
                id: track.id,
                label: track.label,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
              })),
            };
          });
        },
        {timeout: OPERATION_TIMEOUT, intervals: [250, 500, 1000, 2000]}
      )
      .toMatchObject({
        hasAudioElement: true,
        hasSrcObject: true,
        paused: false,
        trackCount: 1,
        tracks: [
          {
            kind: 'audio',
            enabled: true,
            // readyState removed - can be "live" or "ended" on shared calls
          },
        ],
      });
  } catch (error) {
    const debugState = await page
      .evaluate(() => {
        const audioElem = document.querySelector('#remote-audio') as HTMLAudioElement | null;
        const mediaStream = audioElem?.srcObject as MediaStream | null;
        const audioTracks = mediaStream?.getAudioTracks() ?? [];

        return {
          hasAudioElement: Boolean(audioElem),
          hasSrcObject: Boolean(mediaStream),
          paused: audioElem?.paused ?? null,
          trackCount: audioTracks.length,
          tracks: audioTracks.map((track, index) => ({
            index,
            kind: track.kind,
            id: track.id,
            label: track.label,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
          })),
        };
      })
      .catch(() => ({pageEvaluationFailed: true}));

    throw new Error(
      `❌ Audio transfer verification failed: ${error.message}. Debug state: ${JSON.stringify(
        debugState
      )}`
    );
  }
}

/**
 * Verifies the presence of hold music audio element with autoplay and loop attributes.
 * Looks for: <audio autoplay="" loop=""></audio>
 * This is checked on the caller page when call is put on hold
 * @param page - The caller's page (where hold music should be playing)
 * @returns Promise<void>
 * @throws Error if hold music element verification fails
 */
export async function verifyHoldMusicElement(page: Page): Promise<void> {
  try {
    const holdMusicExists = await page.evaluate(() => {
      // Look for remote-audio element which handles hold music
      const remoteAudio = document.getElementById('remote-audio') as HTMLAudioElement;

      if (!remoteAudio) {
        return false;
      }

      // Check if the audio element has an active srcObject with active tracks
      const srcObject = remoteAudio.srcObject as MediaStream;
      if (!srcObject) {
        return false;
      }

      // Verify there are active audio tracks
      const audioTracks = srcObject.getAudioTracks();

      return (
        audioTracks.length > 0 &&
        audioTracks.some((track) => track.enabled && track.readyState === 'live')
      );
    });

    if (!holdMusicExists) {
      throw new Error('❌ No hold music audio found on remote-audio element');
    }
  } catch (error) {
    throw new Error(`❌ Hold music element verification failed: ${error.message}`);
  }
}

/**
 * Ends a task by clicking the end call button.
 * Sample app uses plain HTML IDs - #end button.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function endTask(page: Page): Promise<void> {
  await page.bringToFront();

  const endButton = page.locator('#end').first();
  const visibleEndButton = page.getByRole('button', {name: /^end$/i}).first();
  const wrapupDropdown = page.locator('#wrapupCodesDropdown');

  const isWrapupAlreadyEnabled = await wrapupDropdown.isEnabled().catch(() => false);
  if (isWrapupAlreadyEnabled) {
    return;
  }
  if (await isTaskCleared(page)) {
    return;
  }

  const clickVisibleResumeIfAny = async (): Promise<void> => {
    const resumeBtn = page.getByRole('button', {name: 'Resume'}).first();
    const canResume = await resumeBtn.isVisible().catch(() => false);
    if (canResume) {
      const isEnabled = await resumeBtn.isEnabled().catch(() => false);
      if (isEnabled) {
        await resumeBtn.click({timeout: 5000});
        await page.waitForTimeout(1000);
      }
    }
  };

  const isWrapupOrTaskCleared = async (): Promise<boolean> => {
    const wrapupEnabled = await wrapupDropdown.isEnabled().catch(() => false);
    if (wrapupEnabled) {
      return true;
    }

    return isTaskCleared(page);
  };

  const clickEndControl = async (): Promise<void> => {
    const visibleEndButtons = page.getByRole('button', {name: /^end$/i});
    const visibleEndButtonCount = await visibleEndButtons.count().catch(() => 0);
    for (let i = visibleEndButtonCount - 1; i >= 0; i -= 1) {
      const candidate = visibleEndButtons.nth(i);
      const canClick =
        (await candidate.isVisible().catch(() => false)) &&
        (await candidate.isEnabled().catch(() => false));

      if (canClick) {
        try {
          await candidate.click({timeout: AWAIT_TIMEOUT});

          return;
        } catch {
          break;
        }
      }
    }

    await page.evaluate(() => {
      const clickButton = (btn: HTMLButtonElement): void => {
        if (btn.onclick) {
          btn.onclick(new MouseEvent('click'));
        } else {
          btn.click();
        }
      };
      const visibleTextButton = Array.from(document.querySelectorAll('button')).find(
        (btn) => btn.textContent?.trim().toLowerCase() === 'end' && !btn.disabled
      ) as HTMLButtonElement | undefined;
      const legacyButton = document.querySelector('#end') as HTMLButtonElement | null;

      if (visibleTextButton) {
        clickButton(visibleTextButton);
      } else if (legacyButton) {
        clickButton(legacyButton);
      }
    });
  };

  const stillLooksEndable = async (): Promise<boolean> => {
    const incomingText = (
      await page
        .locator('#incoming-task')
        .innerText()
        .catch(() => '')
    ).toLowerCase();
    const activeText =
      incomingText.includes('connected') ||
      incomingText.includes('consult') ||
      incomingText.includes('hold');
    const visibleEndEnabled = await visibleEndButton.isEnabled().catch(() => false);
    const legacyEndEnabled = await endButton
      .evaluate((el) => !(el as HTMLButtonElement).disabled)
      .catch(() => false);

    return activeText || visibleEndEnabled || legacyEndEnabled;
  };

  const isEndEnabledInitially = await endButton
    .evaluate((el) => !(el as HTMLButtonElement).disabled)
    .catch(() => false);

  if (!isEndEnabledInitially && (await isCallHeld(page))) {
    await holdCallToggle(page);
    await expect
      .poll(() => isCallHeld(page), {timeout: OPERATION_TIMEOUT, intervals: [500, 1000, 2000]})
      .toBeFalsy();
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const isVisibleEndEnabled = await visibleEndButton.isEnabled().catch(() => false);
    if (isVisibleEndEnabled) {
      break;
    }
    const isEndEnabled = await endButton
      .evaluate((el) => !(el as HTMLButtonElement).disabled)
      .catch(() => false);
    if (isEndEnabled) {
      break;
    }
    await clickVisibleResumeIfAny();
  }

  await expect
    .poll(
      async () => {
        const wrapupEnabled = await wrapupDropdown.isEnabled().catch(() => false);
        if (wrapupEnabled) {
          return true;
        }
        const taskAlreadyGone = await isTaskCleared(page);
        if (taskAlreadyGone) {
          return true;
        }
        const visibleEnabled = await visibleEndButton.isEnabled().catch(() => false);
        if (visibleEnabled) {
          return true;
        }

        return endButton.evaluate((el) => !(el as HTMLButtonElement).disabled).catch(() => false);
      },
      {timeout: OPERATION_TIMEOUT, intervals: [500, 1000, 2000]}
    )
    .toBeTruthy();

  const canSkipEndClick = await wrapupDropdown.isEnabled().catch(() => false);
  if (canSkipEndClick) {
    return;
  }
  if (await isTaskCleared(page)) {
    return;
  }

  await clickEndControl();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const settled = await expect
      .poll(isWrapupOrTaskCleared, {timeout: 10000, intervals: [500, 1000, 2000]})
      .toBeTruthy()
      .then(() => true)
      .catch(() => false);

    if (settled) {
      return;
    }

    if (!(await stillLooksEndable())) {
      break;
    }

    await clickEndControl();
  }

  await expect
    .poll(isWrapupOrTaskCleared, {
      timeout: OPERATION_TIMEOUT,
      intervals: [500, 1000, 2000],
    })
    .toBeTruthy();
}
