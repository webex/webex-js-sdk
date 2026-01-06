import {Page, expect} from '@playwright/test';
import {TASK_TYPES, AWAIT_TIMEOUT, OPERATION_TIMEOUT} from '../constants';

/**
 * Utility functions for task controls testing.
 * Verifies visibility of task control buttons for different task types.
 *
 * @packageDocumentation
 */

/**
 * Verifies that all call task control buttons are visible and accessible.
 * Checks for hold, recording, transfer, consult, and end buttons.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function callTaskControlCheck(page: Page): Promise<void> {
  // Verify call control container is visible
  await expect(page.getByTestId('call-control-container').nth(0)).toBeVisible({timeout: OPERATION_TIMEOUT});

  // Verify hold/resume toggle button is visible
  await expect(page.getByTestId('call-control:hold-toggle').nth(0)).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Verify recording toggle button is visible
  await expect(page.getByTestId('call-control:recording-toggle').nth(0)).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Verify transfer button is visible
  await expect(page.getByTestId('call-control:transfer').nth(0)).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Verify consult button is visible
  await expect(page.getByTestId('call-control:consult').nth(0)).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Verify end call button is visible
  await expect(page.getByTestId('call-control:end-call').nth(0)).toBeVisible({timeout: AWAIT_TIMEOUT});
}

/**
 * Verifies that chat task control buttons are visible and accessible.
 * Checks for transfer and end buttons only.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function chatTaskControlCheck(page: Page): Promise<void> {
  // Verify chat control container or equivalent is visible
  await expect(page.getByTestId('call-control-container').nth(0)).toBeVisible({timeout: OPERATION_TIMEOUT});

  // Verify transfer button is visible
  await expect(page.getByTestId('call-control:transfer').nth(0)).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Verify end button is visible (for chat tasks)
  await expect(page.getByTestId('call-control:end-call').nth(0)).toBeVisible({timeout: AWAIT_TIMEOUT});
}

/**
 * Verifies that email task control buttons are visible and accessible.
 * Checks for transfer and end buttons only.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function emailTaskControlCheck(page: Page): Promise<void> {
  // Verify email control container or equivalent is visible
  await expect(page.getByTestId('call-control-container').nth(0)).toBeVisible({timeout: OPERATION_TIMEOUT});

  // Verify transfer button is visible
  await expect(page.getByTestId('call-control:transfer').nth(0)).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Verify end button is visible (for email tasks)
  await expect(page.getByTestId('call-control:end-call').nth(0)).toBeVisible({timeout: AWAIT_TIMEOUT});
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
  // Wait for hold toggle button to be visible and clickable
  const holdButton = page.getByTestId('call-control:hold-toggle').nth(0);
  await expect(holdButton).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Click the hold toggle button
  await holdButton.click({timeout: AWAIT_TIMEOUT});
}

/**
 * Toggles the recording state of a call by clicking the recording pause/resume button.
 * This function will pause recording if it's currently active, or resume it if it's paused.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function recordCallToggle(page: Page): Promise<void> {
  // Wait for recording toggle button to be visible and clickable
  const recordButton = page.getByTestId('call-control:recording-toggle').nth(0);
  await expect(recordButton).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Click the recording toggle button
  await recordButton.click({timeout: AWAIT_TIMEOUT});
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
  {shouldBeVisible, verifyContent = shouldBeVisible}: {shouldBeVisible: boolean; verifyContent?: boolean}
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
export async function verifyHoldButtonIcon(page: Page, {expectedIsHeld}: {expectedIsHeld: boolean}): Promise<void> {
  const holdButton = page.getByTestId('call-control:hold-toggle').nth(0);
  await expect(holdButton).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Get the icon element within the hold button
  const iconElement = holdButton.locator('mdc-icon').nth(0);
  await expect(iconElement).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Verify the correct icon based on hold state
  const expectedIcon = expectedIsHeld ? 'play-bold' : 'pause-bold';
  const actualIcon = await iconElement.getAttribute('name');

  if (actualIcon !== expectedIcon) {
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
  const recordButton = page.getByTestId('call-control:recording-toggle').nth(0);
  await expect(recordButton).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Get the icon element within the record button
  const iconElement = recordButton.locator('mdc-icon').nth(0);
  await expect(iconElement).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Verify the correct icon based on recording state
  const expectedIcon = expectedIsRecording ? 'record-paused-bold' : 'record-bold';
  const actualIcon = await iconElement.getAttribute('name');

  if (actualIcon !== expectedIcon) {
    throw new Error(
      `Record button icon mismatch. Expected: '${expectedIcon}' (isRecording: ${expectedIsRecording}), but found: '${actualIcon}'`
    );
  }
}

// Global variable to store captured logs
let capturedLogs: string[] = [];

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
export function verifyHoldLogs({expectedIsHeld}: {expectedIsHeld: boolean}): void {
  const holdResumeLogs = capturedLogs.filter((log) => log.includes('onHoldResume invoked'));
  const statusLogs = capturedLogs.filter((log) =>
    log.includes(expectedIsHeld ? 'WXCC_SDK_TASK_HOLD_SUCCESS' : 'WXCC_SDK_TASK_RESUME_SUCCESS')
  );

  if (holdResumeLogs.length === 0) {
    throw new Error(
      `No 'onHoldResume invoked' logs found. Expected logs for isHeld: ${expectedIsHeld}. Captured logs: ${JSON.stringify(capturedLogs)}`
    );
  }

  if (statusLogs.length === 0) {
    const expectedStatus = expectedIsHeld ? 'WXCC_SDK_TASK_HOLD_SUCCESS' : 'WXCC_SDK_TASK_RESUME_SUCCESS';
    throw new Error(`No '${expectedStatus}' logs found. Captured logs: ${JSON.stringify(capturedLogs)}`);
  }

  const lastHoldLog = holdResumeLogs[holdResumeLogs.length - 1];
  if (!lastHoldLog.includes(`isHeld: ${expectedIsHeld}`)) {
    throw new Error(`Expected 'isHeld: ${expectedIsHeld}' in log but found: ${lastHoldLog}`);
  }
}

/**
 * Verifies that recording pause/resume callback logs are present and contain expected values.
 * @param options - Configuration object
 * @param options.expectedIsRecording - Expected recording state (true for recording, false for paused)
 * @throws Error if verification fails with detailed error message
 */
export function verifyRecordingLogs({expectedIsRecording}: {expectedIsRecording: boolean}): void {
  const recordingLogs = capturedLogs.filter((log) => log.includes('onRecordingToggle invoked'));
  const statusLogs = capturedLogs.filter((log) =>
    log.includes(
      expectedIsRecording ? 'WXCC_SDK_TASK_RESUME_RECORDING_SUCCESS' : 'WXCC_SDK_TASK_PAUSE_RECORDING_SUCCESS'
    )
  );

  if (recordingLogs.length === 0) {
    throw new Error(
      `No 'onRecordingToggle invoked' logs found. Expected logs for isRecording: ${expectedIsRecording}. Captured logs: ${JSON.stringify(capturedLogs)}`
    );
  }

  if (statusLogs.length === 0) {
    const expectedStatus = expectedIsRecording
      ? 'WXCC_SDK_TASK_RESUME_RECORDING_SUCCESS'
      : 'WXCC_SDK_TASK_PAUSE_RECORDING_SUCCESS';
    throw new Error(`No '${expectedStatus}' logs found. Captured logs: ${JSON.stringify(capturedLogs)}`);
  }

  const lastRecordingLog = recordingLogs[recordingLogs.length - 1];
  if (!lastRecordingLog.includes(`isRecording: ${expectedIsRecording}`)) {
    throw new Error(`Expected 'isRecording: ${expectedIsRecording}' in log but found: ${lastRecordingLog}`);
  }
}

/**
 * Verifies that onEnd callback logs are present when tasks are ended.
 * @throws Error if verification fails with detailed error message
 */
export function verifyEndLogs(): void {
  const endLogs = capturedLogs.filter((log) => log.includes('onEnd invoked'));

  if (endLogs.length === 0) {
    throw new Error(`No 'onEnd invoked' logs found. Captured logs: ${JSON.stringify(capturedLogs)}`);
  }
}

/**
 * Verifies audio transfer from caller to browser by executing the exact console command.
 * Executes: document.querySelector("#remote-audio").srcObject.getAudioTracks()
 * Verifies that exactly 1 audio MediaStreamTrack is present with GUID label and proper properties
 * @param page - The agent's main page (browser receiving audio)
 * @returns Promise<void>
 * @throws Error if remote audio tracks verification fails
 */
export async function verifyRemoteAudioTracks(page: Page): Promise<void> {
  try {
    // Execute the exact console command for audio tracks
    const consoleResult = await page.evaluate(() => {
      // This is the exact command from your console
      const audioElem = document.querySelector('#remote-audio') as HTMLAudioElement;

      if (!audioElem) {
        return [];
      }

      if (!audioElem.srcObject) {
        return [];
      }

      const mediaStream = audioElem.srcObject as MediaStream;
      const audioTracks = mediaStream.getAudioTracks();

      // Convert MediaStreamTrack objects to serializable format (like console shows)
      const result = audioTracks.map((track, index) => {
        return {
          index,
          kind: track.kind,
          id: track.id,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          onended: track.onended,
          onmute: track.onmute,
          onunmute: track.onunmute,
        };
      });

      return result;
    });

    // Verify we got exactly 1 audio track (no more, no less)
    expect(consoleResult.length).toBe(1);

    // Get the single audio track (since we verified there's exactly 1)
    const audioTrack = consoleResult[0];

    // Verify it's an audio track
    if (audioTrack.kind !== 'audio') {
      throw new Error(
        `❌ Expected audio track but found ${audioTrack.kind} track. Track details: { kind: "${audioTrack.kind}", label: "${audioTrack.label}", id: "${audioTrack.id}" }`
      );
    }

    // Verify essential track properties for audio transfer
    expect(audioTrack.kind).toBe('audio');
    expect(audioTrack.enabled).toBe(true);
    expect(audioTrack.muted).toBe(false);
    expect(audioTrack.readyState).toBe('live');
  } catch (error) {
    throw new Error(`❌ Audio transfer verification failed: ${error.message}`);
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
      // Look for audio elements with both autoplay and loop attributes
      const audioElements = document.querySelectorAll('audio[autoplay][loop]');

      if (audioElements.length === 0) {
        return false;
      }

      // Check if at least one element has the correct attributes
      return Array.from(audioElements).some((audio) => {
        const a = audio as HTMLAudioElement;
        return a.hasAttribute('autoplay') && a.hasAttribute('loop') && a.autoplay === true && a.loop === true;
      });
    });

    if (!holdMusicExists) {
      throw new Error('❌ No hold music audio elements found with autoplay and loop attributes');
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
  const endButton = page.getByTestId('call-control:end-call').nth(0);
  await endButton.waitFor({state: 'visible', timeout: OPERATION_TIMEOUT});

  // Check if button is disabled and wait for it to be enabled
  const isDisabled = await endButton.isDisabled();
  if (isDisabled) {
    await holdCallToggle(page);
    await expect(endButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
  }

  await endButton.click({timeout: AWAIT_TIMEOUT});
}
