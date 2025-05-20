/**
 * Call Controls module for Contact Center
 * Handles call control operations like hold/resume, mute/unmute, and transfers
 */

let isHold = false;
let isMuted = false;
let isRecordingPaused = false;

/**
 * Toggle hold state for the current task
 * @param {Object} task - The current task
 * @returns {Promise} Resolves when hold/resume operation completes
 */
export async function toggleHold(task) {
  try {
    if (!isHold) {
      await task.hold();
      isHold = true;
      console.log('Call held successfully');
    } else {
      await task.resume();
      isHold = false;
      console.log('Call resumed successfully');
    }
  } catch (error) {
    console.error('Hold/Resume operation failed:', error);
    throw error;
  }
}

/**
 * Toggle mute state for the current task
 * @param {Object} task - The current task
 */
export function toggleMute(task) {
  try {
    task.toggleMute();
    isMuted = !isMuted;
    console.log(isMuted ? 'Call muted' : 'Call unmuted');
  } catch (error) {
    console.error('Mute/Unmute operation failed:', error);
    throw error;
  }
}

/**
 * Toggle recording pause state
 * @param {Object} task - The current task
 * @param {boolean} autoResumed - Whether the recording was auto-resumed
 * @returns {Promise} Resolves when pause/resume operation completes
 */
export async function toggleRecordingPause(task, autoResumed = false) {
  try {
    if (!isRecordingPaused) {
      await task.pauseRecording();
      isRecordingPaused = true;
      console.log('Recording paused successfully');
    } else {
      const params = autoResumed ? { autoResumed: true } : undefined;
      await task.resumeRecording(params);
      isRecordingPaused = false;
      console.log('Recording resumed successfully');
    }
  } catch (error) {
    console.error('Recording pause/resume operation failed:', error);
    throw error;
  }
}

/**
 * Initiate a blind transfer
 * @param {Object} task - The current task
 * @param {Object} params - Transfer parameters
 * @returns {Promise} Resolves when transfer is initiated
 */
export async function initiateTransfer(task, { to, destinationType }) {
  try {
    await task.transfer({ to, destinationType });
    console.log('Transfer initiated successfully');
  } catch (error) {
    console.error('Transfer initiation failed:', error);
    throw error;
  }
}

/**
 * Initiate a consultation
 * @param {Object} task - The current task
 * @param {Object} params - Consultation parameters
 * @returns {Promise} Resolves when consultation is initiated
 */
export async function initiateConsult(task, { to, destinationType }) {
  try {
    await task.consult({ to, destinationType });
    console.log('Consultation initiated successfully');
  } catch (error) {
    console.error('Consultation initiation failed:', error);
    throw error;
  }
}

/**
 * Complete a consultation transfer
 * @param {Object} task - The current task
 * @param {Object} params - Consult transfer parameters
 * @returns {Promise} Resolves when consult transfer is complete
 */
export async function consultTransfer(task, { to, destinationType }) {
  try {
    await task.consultTransfer({ to, destinationType });
    console.log('Consultation transfer completed successfully');
  } catch (error) {
    console.error('Consultation transfer failed:', error);
    throw error;
  }
}

/**
 * End an ongoing consultation
 * @param {Object} task - The current task
 * @param {Object} params - End consultation parameters
 * @returns {Promise} Resolves when consultation is ended
 */
export async function endConsult(task, { taskId, queueId = null }) {
  try {
    const consultEndPayload = queueId ? 
      { isConsult: true, taskId, queueId } : 
      { isConsult: true, taskId };

    await task.endConsult(consultEndPayload);
    console.log('Consultation ended successfully');
  } catch (error) {
    console.error('Failed to end consultation:', error);
    throw error;
  }
}

/**
 * Start an outdial call
 * @param {Object} webex - The Webex instance
 * @param {string} destination - The destination number
 * @param {string} entryPointId - The entry point ID
 * @returns {Promise} Resolves when outdial is initiated
 */
export async function startOutdial(webex, destination, entryPointId) {
  if (!destination?.trim()) {
    throw new Error('Destination number is required');
  }

  if (!entryPointId) {
    throw new Error('Entry point ID is not configured');
  }

  try {
    await webex.cc.startOutdial(destination);
    console.log('Outdial call initiated successfully');
  } catch (error) {
    console.error('Failed to initiate outdial call:', error);
    throw error;
  }
}

/**
 * Get the list of available queues for telephony channel
 * @param {Object} webex - The Webex instance
 * @returns {Promise<Array>} Resolves with list of queues
 */
export async function getQueueListForTelephonyChannel(webex) {
  try {
    let queueList = await webex.cc.getQueues();
    return queueList.filter(queue => queue.channelType === 'TELEPHONY');
  } catch (error) {
    console.error('Failed to fetch queue list:', error);
    throw error;
  }
}

// State getters
export const getHoldState = () => isHold;
export const getMuteState = () => isMuted;
export const getRecordingPauseState = () => isRecordingPaused;
