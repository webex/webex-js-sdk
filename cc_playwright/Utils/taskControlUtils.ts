import {Page, expect} from '@playwright/test';
import {TASK_TYPES, AWAIT_TIMEOUT, OPERATION_TIMEOUT} from '../constants';
import {
  clickFirstVisibleEnabledControl,
  findFirstVisibleControlIndex,
  findFirstVisibleEnabledControlIndex,
} from './controlUtils';

/**
 * Utility functions for task controls testing.
 * Verifies visibility of task control buttons for different task types.
 *
 * @packageDocumentation
 */

async function getVisibleControlIconName(page: Page, testId: string): Promise<string | null> {
  const controlIndex = await findFirstVisibleControlIndex(page, testId);
  if (controlIndex === -1) {
    return null;
  }

  const iconElement = page.getByTestId(testId).nth(controlIndex).locator('mdc-icon').nth(0);
  const isVisible = await iconElement.isVisible().catch(() => false);
  if (!isVisible) {
    return null;
  }

  return iconElement.getAttribute('name');
}

/**
 * Verifies that all call task control buttons are visible and accessible.
 * Checks for hold, recording, transfer, consult, and end buttons.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function callTaskControlCheck(page: Page): Promise<void> {
  // Verify call control container is visible
  await expect(page.getByTestId('call-control-container').nth(0)).toBeVisible({
    timeout: OPERATION_TIMEOUT,
  });

  // Verify hold/resume toggle button is visible
  await expect(page.getByTestId('call-control:hold-toggle').nth(0)).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });

  // Verify recording toggle button is visible
  await expect(page.getByTestId('call-control:recording-toggle').nth(0)).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });

  // Verify transfer button is visible
  await expect(page.getByTestId('call-control:transfer').nth(0)).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });

  // Verify consult button is visible
  await expect(page.getByTestId('call-control:consult').nth(0)).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });

  // Verify end call button is visible
  await expect(page.getByTestId('call-control:end-call').nth(0)).toBeVisible({
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
  // Verify chat control container or equivalent is visible
  await expect(page.getByTestId('call-control-container').nth(0)).toBeVisible({
    timeout: OPERATION_TIMEOUT,
  });

  // Verify transfer button is visible
  await expect(page.getByTestId('call-control:transfer').nth(0)).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });

  // Verify end button is visible (for chat tasks)
  await expect(page.getByTestId('call-control:end-call').nth(0)).toBeVisible({
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
  // Verify email control container or equivalent is visible
  await expect(page.getByTestId('call-control-container').nth(0)).toBeVisible({
    timeout: OPERATION_TIMEOUT,
  });

  // Verify transfer button is visible
  await expect(page.getByTestId('call-control:transfer').nth(0)).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });

  // Verify end button is visible (for email tasks)
  await expect(page.getByTestId('call-control:end-call').nth(0)).toBeVisible({
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
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function holdCallToggle(page: Page): Promise<void> {
  await expect(page.getByTestId('call-control:hold-toggle').first()).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });
  await clickFirstVisibleEnabledControl(page, 'call-control:hold-toggle');
}

export async function isCallHeld(page: Page): Promise<boolean> {
  const iconName = await getVisibleControlIconName(page, 'call-control:hold-toggle');

  return iconName === 'play-bold';
}

/**
 * Toggles the recording state of a call by clicking the recording pause/resume button.
 * This function will pause recording if it's currently active, or resume it if it's paused.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function recordCallToggle(page: Page): Promise<void> {
  await expect(page.getByTestId('call-control:recording-toggle').first()).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });
  await clickFirstVisibleEnabledControl(page, 'call-control:recording-toggle');
}

/**
 * Verifies the hold timer visibility and content based on expected state.
 * @param page - The agent's main page
 * @param options - Configuration object
 * @param options.shouldBeVisible - Whether the timer should be visible (true) or hidden (false)
 * @param options.verifyContent - Whether to verify timer content (default: true when visible)
 * @returns Promise<void>
 */
export async function verifyHoldTimer(
  page: Page,
  {
    shouldBeVisible,
    verifyContent = shouldBeVisible,
  }: {shouldBeVisible: boolean; verifyContent?: boolean}
): Promise<void> {
  const holdTimerContainer = page.locator('.on-hold-chip-text');

  if (shouldBeVisible) {
    await expect(holdTimerContainer).toBeVisible({timeout: AWAIT_TIMEOUT});

    if (verifyContent) {
      // Verify "On hold" text is present
      await expect(holdTimerContainer).toContainText('On hold', {timeout: AWAIT_TIMEOUT});

      // Verify timer format (should contain time like 00:XX)
      await expect(holdTimerContainer).toContainText(/\d{2}:\d{2}/, {timeout: AWAIT_TIMEOUT});
    }
  } else {
    await expect(holdTimerContainer).toBeHidden({timeout: AWAIT_TIMEOUT});
  }
}

/**
 * Verifies the icon of the hold toggle button based on current hold state.
 * - When call is NOT on hold: expects 'pause-bold' icon (to put call on hold)
 * - When call IS on hold: expects 'play-bold' icon (to resume call)
 * @param page - The agent's main page
 * @param options - Configuration object
 * @param options.expectedIsHeld - Expected hold state (true if call is on hold, false if active)
 * @returns Promise<void>
 * @throws Error if icon verification fails
 */
export async function verifyHoldButtonIcon(
  page: Page,
  {expectedIsHeld}: {expectedIsHeld: boolean}
): Promise<void> {
  // Verify the correct icon based on hold state
  const expectedIcon = expectedIsHeld ? 'play-bold' : 'pause-bold';
  try {
    await expect
      .poll(() => getVisibleControlIconName(page, 'call-control:hold-toggle'), {
        timeout: AWAIT_TIMEOUT,
        intervals: [200, 500, 1000],
      })
      .toBe(expectedIcon);
  } catch {
    const actualIcon = await getVisibleControlIconName(page, 'call-control:hold-toggle');
    throw new Error(
      `Hold button icon mismatch. Expected: '${expectedIcon}' (isHeld: ${expectedIsHeld}), but found: '${actualIcon}'`
    );
  }
}

/**
 * Verifies the icon of the record toggle button based on current recording state.
 * - When recording is ACTIVE: expects 'record-paused-bold' icon (to pause recording)
 * - When recording is PAUSED: expects 'record-bold' icon (to resume recording)
 * @param page - The agent's main page
 * @param options - Configuration object
 * @param options.expectedIsRecording - Expected recording state (true if recording, false if paused)
 * @returns Promise<void>
 * @throws Error if icon verification fails
 */
export async function verifyRecordButtonIcon(
  page: Page,
  {expectedIsRecording}: {expectedIsRecording: boolean}
): Promise<void> {
  // Verify the correct icon based on recording state
  const expectedIcon = expectedIsRecording ? 'record-paused-bold' : 'record-bold';
  try {
    await expect
      .poll(() => getVisibleControlIconName(page, 'call-control:recording-toggle'), {
        timeout: AWAIT_TIMEOUT,
        intervals: [200, 500, 1000],
      })
      .toBe(expectedIcon);
  } catch {
    const actualIcon = await getVisibleControlIconName(page, 'call-control:recording-toggle');
    throw new Error(
      `Record button icon mismatch. Expected: '${expectedIcon}' (isRecording: ${expectedIsRecording}), but found: '${actualIcon}'`
    );
  }
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
            readyState: 'live',
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
 * Ends a task by clicking the end call button and waiting for it to be visible.
 * This function can be used for any task type (call, chat, email) as they all use the same end button.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function endTask(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const wrapupVisible = await page
          .getByTestId('call-control:wrapup-button')
          .first()
          .isVisible()
          .catch(() => false);
        const enabledEndIndex = await findFirstVisibleEnabledControlIndex(
          page,
          'call-control:end-call'
        );

        return wrapupVisible || enabledEndIndex !== -1;
      },
      {timeout: OPERATION_TIMEOUT, intervals: [250, 500, 1000]}
    )
    .toBeTruthy();

  const wrapupVisible = await page
    .getByTestId('call-control:wrapup-button')
    .first()
    .isVisible()
    .catch(() => false);
  if (
    wrapupVisible &&
    (await findFirstVisibleEnabledControlIndex(page, 'call-control:end-call')) === -1
  ) {
    return;
  }

  await clickFirstVisibleEnabledControl(page, 'call-control:end-call');
}
