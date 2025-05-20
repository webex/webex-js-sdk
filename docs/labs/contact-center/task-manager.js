/**
 * Task Manager module for Contact Center
 * Handles task-related functionality including incoming tasks, task selection, and task list management
 */

let currentTask = null;

/**
 * Handle incoming task
 * @param {Object} task - The incoming task object
 * @param {Function} onTaskUpdate - Callback function for task updates
 */
export function handleIncomingTask(task, onTaskUpdate) {
  registerTaskListeners(task, onTaskUpdate);
  
  if (task.data?.interaction?.mediaType === 'telephony') {
    handleTelephonyTask(task);
  } else if (['chat', 'social'].includes(task.data?.interaction?.mediaType)) {
    handleDigitalChannelTask(task);
  } else if (task.data?.interaction?.mediaType === 'email') {
    handleEmailTask(task);
  }
}

/**
 * Accept an incoming task
 * @param {Object} task - The task to accept
 * @returns {Promise} Resolves when task is accepted
 */
export async function acceptTask(task) {
  try {
    await task.accept();
    currentTask = task;
    console.log('Task accepted successfully');
  } catch (error) {
    console.error('Failed to accept task:', error);
    throw error;
  }
}

/**
 * Decline an incoming task
 * @param {Object} task - The task to decline
 * @returns {Promise} Resolves when task is declined
 */
export async function declineTask(task) {
  try {
    await task.decline(task.data.interactionId);
    console.log('Task declined successfully');
  } catch (error) {
    console.error('Failed to decline task:', error);
    throw error;
  }
}

/**
 * Handle task selection
 * @param {Object} task - The selected task
 * @param {Function} onTaskUpdate - Callback function for task updates
 */
export function handleTaskSelect(task, onTaskUpdate) {
  currentTask = task;
  console.log('Task selected:', task);

  if (task.data?.wrapUpRequired) {
    enableWrapupControls();
  }

  updateTaskControls(task);
  if (onTaskUpdate) onTaskUpdate(task);
}

/**
 * End the current task
 * @returns {Promise} Resolves when task is ended
 */
export async function endTask() {
  if (!currentTask) {
    console.warn('No active task to end');
    return;
  }

  try {
    await currentTask.end();
    console.log('Task ended successfully');
  } catch (error) {
    console.error('Failed to end task:', error);
    throw error;
  }
}

/**
 * Wrap up the current task
 * @param {Object} params - Wrap up parameters
 * @returns {Promise} Resolves when task is wrapped up
 */
export async function wrapupTask({ wrapUpReason, auxCodeId }) {
  if (!currentTask) {
    console.warn('No active task to wrap up');
    return;
  }

  try {
    await currentTask.wrapup({ wrapUpReason, auxCodeId });
    console.log('Task wrapped up successfully');
  } catch (error) {
    console.error('Failed to wrap up task:', error);
    throw error;
  }
}

/**
 * Register task event listeners
 * @param {Object} task - The task to register listeners for
 * @param {Function} onTaskUpdate - Callback function for task updates
 */
function registerTaskListeners(task, onTaskUpdate) {
  task.on('task:assigned', (assignedTask) => {
    console.log('Task assigned:', assignedTask);
    if (onTaskUpdate) onTaskUpdate(assignedTask);
  });

  task.on('task:media', (track) => {
    handleTaskMedia(track);
  });

  task.on('task:end', (endedTask) => {
    handleTaskEnd(endedTask);
    if (onTaskUpdate) onTaskUpdate(endedTask);
  });

  task.on('task:rejected', (reason) => {
    console.info('Task rejected:', reason);
  });

  // Task state change handlers
  task.on('task:hold', handleTaskHold);
  task.on('task:consultCreated', handleConsultCreated);
  task.on('task:offerConsult', handleConsultOffer);
  task.on('task:consultAccepted', handleConsultAccepted);
  task.on('task:consulting', handleConsulting);
  task.on('task:consultEnd', handleConsultEnd);
}

/**
 * Handle telephony-specific task setup
 * @param {Object} task - The telephony task
 */
function handleTelephonyTask(task) {
  const callerDetails = task.data.interaction?.callAssociatedDetails?.ani;
  console.log('Incoming call from:', callerDetails);
}

/**
 * Handle digital channel (chat/social) task setup
 * @param {Object} task - The digital channel task
 */
function handleDigitalChannelTask(task) {
  const mediaId = task.data.interaction?.callAssociatedDetails?.mediaResourceId;
  console.log('Digital channel task:', mediaId);
}

/**
 * Handle email task setup
 * @param {Object} task - The email task
 */
function handleEmailTask(task) {
  const mediaId = task.data.interaction?.callAssociatedDetails?.mediaResourceId;
  console.log('Email task:', mediaId);
}

/**
 * Handle task media events
 * @param {MediaStreamTrack} track - The media track
 */
function handleTaskMedia(track) {
  const mediaStream = new MediaStream([track]);
  // Handle the media stream (e.g., attach to audio element)
  console.log('Received media track:', track.kind);
}

/**
 * Handle task end events
 * @param {Object} task - The ended task
 */
function handleTaskEnd(task) {
  console.log('Task ended:', task.data.interactionId);
  if (task.data.wrapUpRequired) {
    enableWrapupControls();
  }
}

/**
 * Handle task hold events
 * @param {Object} task - The held task
 */
function handleTaskHold(task) {
  console.log('Task held:', task.data.interactionId);
}

// Consult handlers
function handleConsultCreated(task) {
  console.log('Consult created:', task);
}

function handleConsultOffer(task) {
  console.log('Received consult offer:', task);
}

function handleConsultAccepted(task) {
  console.log('Consult accepted:', task);
}

function handleConsulting(task) {
  console.log('Consulting:', task);
}

function handleConsultEnd(task) {
  console.log('Consult ended:', task);
}

// UI update helpers
function enableWrapupControls() {
  // This would be implemented by the UI layer
  console.log('Wrap-up controls enabled');
}

function updateTaskControls(task) {
  // This would be implemented by the UI layer
  console.log('Task controls updated for:', task.data.interactionId);
}
