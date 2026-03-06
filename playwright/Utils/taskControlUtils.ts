/* eslint-disable import/no-extraneous-dependencies */
import {Page, expect} from '@playwright/test';
import {AWAIT_TIMEOUT} from '../constants';

// Array to store captured console logs for verification
let capturedLogs: string[] = [];

/**
 * Sets up console logging to capture task control related callback logs.
 */
export function setupConsoleLogging(page: Page): () => void {
  capturedLogs = [];

  const consoleHandler = (msg) => {
    const logText = msg.text();
    if (
      logText.includes('onHold invoked') ||
      logText.includes('onRecording invoked') ||
      logText.includes('onEnd invoked') ||
      logText.includes('WXCC_SDK')
    ) {
      capturedLogs.push(logText);
    }
  };

  page.on('console', consoleHandler);

  return () => page.off('console', consoleHandler);
}

/**
 * Clears the captured logs array.
 */
export function clearCapturedLogs(): void {
  capturedLogs = [];
}

/**
 * Toggles hold/resume for a call.
 */
export async function holdCallToggle(page: Page): Promise<void> {
  await page.locator('#hold-resume').click({timeout: AWAIT_TIMEOUT});
}

/**
 * Toggles recording pause/resume for a call.
 */
export async function recordCallToggle(page: Page): Promise<void> {
  await page.locator('#record').click({timeout: AWAIT_TIMEOUT});
}

/**
 * Ends a task.
 */
export async function endTask(page: Page): Promise<void> {
  await page.locator('#end').click({timeout: AWAIT_TIMEOUT});
}

/**
 * Verifies that task controls are visible for the given task type.
 */
export async function verifyTaskControls(page: Page, taskType: string): Promise<void> {
  // Verify common controls
  await expect(page.locator('#hold-resume')).toBeVisible({timeout: AWAIT_TIMEOUT});
  await expect(page.locator('#end')).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Verify task-type specific controls
  if (taskType === 'call' || taskType === 'CALL') {
    await expect(page.locator('#record')).toBeVisible({timeout: AWAIT_TIMEOUT});
  }
}

/**
 * Verifies hold callback logs.
 */
export function verifyHoldLogs(options: {expectedIsHeld: boolean}): void {
  const holdLogs = capturedLogs.filter((log) => log.includes('onHold invoked'));

  if (holdLogs.length === 0) {
    throw new Error(
      `No 'onHold invoked' logs found. Captured logs: ${JSON.stringify(capturedLogs)}`
    );
  }

  const lastHoldLog = holdLogs[holdLogs.length - 1];
  const isHeld = lastHoldLog.includes('true') || lastHoldLog.includes('held: true');

  if (isHeld !== options.expectedIsHeld) {
    throw new Error(
      `Expected hold state to be ${options.expectedIsHeld} but got ${isHeld}. Log: ${lastHoldLog}`
    );
  }
}

/**
 * Verifies recording callback logs.
 */
export function verifyRecordingLogs(options: {expectedIsRecording: boolean}): void {
  const recordingLogs = capturedLogs.filter((log) => log.includes('onRecording invoked'));

  if (recordingLogs.length === 0) {
    throw new Error(
      `No 'onRecording invoked' logs found. Captured logs: ${JSON.stringify(capturedLogs)}`
    );
  }

  const lastRecordingLog = recordingLogs[recordingLogs.length - 1];
  const isRecording =
    lastRecordingLog.includes('true') || lastRecordingLog.includes('recording: true');

  if (isRecording !== options.expectedIsRecording) {
    throw new Error(
      `Expected recording state to be ${options.expectedIsRecording} but got ${isRecording}. Log: ${lastRecordingLog}`
    );
  }
}

/**
 * Verifies end callback logs.
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
 * Verifies hold timer visibility.
 */
export async function verifyHoldTimer(
  page: Page,
  options: {shouldBeVisible: boolean}
): Promise<void> {
  const holdTimer = page.locator('#hold-timer, [data-testid="hold-timer"]');

  if (options.shouldBeVisible) {
    await expect(holdTimer).toBeVisible({timeout: AWAIT_TIMEOUT});
  } else {
    await expect(holdTimer).not.toBeVisible({timeout: AWAIT_TIMEOUT});
  }
}

/**
 * Verifies remote audio tracks are present.
 */
export async function verifyRemoteAudioTracks(page: Page): Promise<void> {
  const audioElements = await page.locator('audio').count();

  if (audioElements === 0) {
    throw new Error('No audio elements found on the page');
  }

  // Verify that at least one audio element has a srcObject (remote stream)
  const hasRemoteStream = await page.evaluate(() => {
    const audios = Array.from(document.querySelectorAll('audio'));

    return audios.some((audio) => (audio as HTMLAudioElement).srcObject !== null);
  });

  if (!hasRemoteStream) {
    throw new Error('No audio elements with remote stream found');
  }
}

/**
 * Verifies hold music element is present (typically on caller's page).
 */
export async function verifyHoldMusicElement(page: Page): Promise<void> {
  const holdMusicElement = page.locator('audio[data-hold-music="true"], #hold-music');

  await expect(holdMusicElement).toBeVisible({timeout: AWAIT_TIMEOUT});
}

/**
 * Verifies hold button icon state.
 */
export async function verifyHoldButtonIcon(
  page: Page,
  options: {expectedIsHeld: boolean}
): Promise<void> {
  const holdButton = page.locator('#hold-resume');

  if (options.expectedIsHeld) {
    // When on hold, button should show play/resume icon
    const hasResumeIcon =
      (await holdButton.locator('[data-icon="play"], .icon-play').count()) > 0 ||
      (await holdButton.getAttribute('aria-label'))?.includes('Resume');

    if (!hasResumeIcon) {
      throw new Error('Expected hold button to show resume/play icon when call is on hold');
    }
  } else {
    // When active, button should show pause/hold icon
    const hasHoldIcon =
      (await holdButton.locator('[data-icon="pause"], .icon-pause').count()) > 0 ||
      (await holdButton.getAttribute('aria-label'))?.includes('Hold');

    if (!hasHoldIcon) {
      throw new Error('Expected hold button to show hold/pause icon when call is active');
    }
  }
}

/**
 * Verifies record button icon state.
 */
export async function verifyRecordButtonIcon(
  page: Page,
  options: {expectedIsRecording: boolean}
): Promise<void> {
  const recordButton = page.locator('#record');

  if (options.expectedIsRecording) {
    // When recording, button should show pause icon
    const hasPauseIcon =
      (await recordButton.locator('[data-icon="pause"], .icon-pause').count()) > 0 ||
      (await recordButton.getAttribute('aria-label'))?.includes('Pause');

    if (!hasPauseIcon) {
      throw new Error('Expected record button to show pause icon when recording is active');
    }
  } else {
    // When paused, button should show record/resume icon
    const hasRecordIcon =
      (await recordButton.locator('[data-icon="record"], .icon-record').count()) > 0 ||
      (await recordButton.getAttribute('aria-label'))?.includes('Record');

    if (!hasRecordIcon) {
      throw new Error('Expected record button to show record icon when recording is paused');
    }
  }
}
