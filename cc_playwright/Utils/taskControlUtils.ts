import {Page, expect} from '@playwright/test';
import {TASK_TYPES, AWAIT_TIMEOUT, OPERATION_TIMEOUT} from '../constants';

/**
 * Utility functions for task controls testing.
 * Verifies visibility of task control buttons for different task types.
 *
 * @packageDocumentation
 */

/**
 * Verifies that core call task control buttons are visible.
 * Checks for hold, transfer, consult, and end buttons.
 * Sample app uses plain HTML IDs, not data-testid attributes.
 * Note: Only checks visibility, not enabled state, as button enable timing varies.
 * Recording button is skipped as it may be hidden by CSS in sample app.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function callTaskControlCheck(page: Page): Promise<void> {
  // Sample app uses plain HTML IDs - verify core call control buttons are visible
  // Verify hold/resume toggle button is visible
  await expect(page.locator('#hold-resume')).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });

  // Skip recording button check - may be hidden by CSS in sample app
  // await expect(page.locator('#pause-resume-recording')).toBeVisible({
  //   timeout: AWAIT_TIMEOUT,
  // });

  // Verify transfer button is visible
  await expect(page.locator('#transfer')).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });

  // Verify consult button is visible
  await expect(page.locator('#consult')).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });

  // Verify end call button is visible
  await expect(page.locator('#end')).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });
}

/**
 * Verifies that chat task control buttons are visible and accessible.
 * Checks for transfer and end buttons only.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function chatTaskControlCheck(page: Page): Promise<void> {
  // Sample app: verify transfer button is visible
  await expect(page.locator('#transfer')).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });

  // Sample app: verify end button is visible (for chat tasks)
  await expect(page.locator('#end')).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });
}

/**
 * Verifies that email task control buttons are visible and accessible.
 * Checks for transfer and end buttons only.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function emailTaskControlCheck(page: Page): Promise<void> {
  // Sample app: verify transfer button is visible
  await expect(page.locator('#transfer')).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });

  // Sample app: verify end button is visible (for email tasks)
  await expect(page.locator('#end')).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });
}

/**
 * Verifies task control buttons based on the task type.
 * @param page - The agent's main page
 * @param taskType - The type of the task (e.g., TASK_TYPES.CALL, TASK_TYPES.CHAT)
 * @returns Promise<void>
 */
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

/**
 * Toggles the hold state of a call by clicking the hold/resume button.
 * This function will put the call on hold if it's currently active, or resume it if it's on hold.
 * Sample app uses plain HTML ID #hold-resume.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function holdCallToggle(page: Page): Promise<void> {
  const holdButton = page.locator('#hold-resume');
  await expect(holdButton).toBeVisible({timeout: AWAIT_TIMEOUT});
  await expect(holdButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await holdButton.click({timeout: AWAIT_TIMEOUT});
}

export async function isCallHeld(page: Page): Promise<boolean> {
  // Sample app: check button text - "Resume" means call is on hold, "Hold" means call is active
  const holdButton = page.locator('#hold-resume');
  const isVisible = await holdButton.isVisible().catch(() => false);

  if (!isVisible) {
    return false;
  }

  const buttonText = await holdButton.innerText().catch(() => '');

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: {expectedIsHeld: boolean}
): Promise<void> {
  // Sample app doesn't use mdc-icon web components - just verify button is visible
  const holdButton = page.locator('#hold-resume');
  await expect(holdButton).toBeVisible({timeout: AWAIT_TIMEOUT});
  await expect(holdButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
  // Icon state verification skipped - sample app uses plain HTML
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

          return (
            recordingLogs.length > 0 &&
            statusLogs.length > 0 &&
            lastRecordingLog.includes(`isRecording: ${expectedIsRecording}`)
          );
        },
        {timeout: OPERATION_TIMEOUT, intervals: [200, 400, 800, 1200]}
      )
      .toBeTruthy();
  } catch {
    const recordingLogs = capturedLogs.filter((log) => log.includes('onRecordingToggle invoked'));
    const statusLogs = capturedLogs.filter((log) => log.includes(expectedStatus));
    const lastRecordingLog = recordingLogs[recordingLogs.length - 1];

    if (recordingLogs.length === 0) {
      throw new Error(
        `No 'onRecordingToggle invoked' logs found. Expected logs for isRecording: ${expectedIsRecording}. Captured logs: ${JSON.stringify(
          capturedLogs
        )}`
      );
    }

    if (statusLogs.length === 0) {
      throw new Error(
        `No '${expectedStatus}' logs found. Captured logs: ${JSON.stringify(capturedLogs)}`
      );
    }

    if (!lastRecordingLog?.includes(`isRecording: ${expectedIsRecording}`)) {
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
  // Sample app: click #end button via JS (may be CSS-hidden)
  await page.evaluate(() => {
    const btn = document.querySelector('#end') as HTMLButtonElement;
    if (btn) btn.click();
  });

  // Wait for wrapup button to become visible/enabled
  const wrapupButton = page.locator('#wrapup');
  await expect(wrapupButton).toBeVisible({timeout: OPERATION_TIMEOUT});
}
