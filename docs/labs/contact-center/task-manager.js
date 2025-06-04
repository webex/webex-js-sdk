/**
 * Task management functionality for Webex Contact Center SDK
 * This lab demonstrates how to:
 * 1. Handle incoming tasks and task events
 * 2. Manage basic task operations (accept, decline, end)
 * 3. Handle task state changes like wrapup
 * 4. Utilize task media controls for voice calls
 */

import {
    setupConsultEventListeners,
    initializeConsultUI,
    initiateConsult,
    resetConsultControls,
    CONSULT_EVENTS
} from './task-consult.js';

//--------------------------------------------------
// CONSTANTS & STATE
//--------------------------------------------------

// Task events that we'll be listening to from the SDK
export const TASK_EVENTS = {
  TASK_INCOMING: 'task:incoming',
  TASK_ASSIGNED: 'task:assigned',
  TASK_MEDIA: 'task:media',
  TASK_UNASSIGNED: 'task:unassigned',
  TASK_HOLD: 'task:hold',
  TASK_PAUSE: 'task:pause',
  TASK_RESUME: 'task:resume',
  TASK_END: 'task:end',
  TASK_WRAPUP: 'task:wrapup',
  TASK_WRAPPEDUP: 'task:wrappedup',
  TASK_RECORDING_PAUSED: 'task:recordingPaused',
  TASK_RECORDING_PAUSE_FAILED: 'task:recordingPauseFailed',
  TASK_RECORDING_RESUMED: 'task:recordingResumed',
  TASK_RECORDING_RESUME_FAILED: 'task:recordingResumeFailed',
  TASK_REJECT: 'task:rejected',
  TASK_HYDRATE: 'task:hydrate',
  TASK_OFFER_CONTACT: 'task:offerContact',
  ...CONSULT_EVENTS // Include consult events
};

// State variables
let currentTask = null;     // Current active task
let taskList = [];          // List of all tasks
let isHold = false;         // Is call on hold
let isMuted = false;        // Is call muted
let wrapupCodes = [];       // Available wrapup codes
let isRecordingPaused = false;  // Is recording paused

//--------------------------------------------------
// INITIALIZATION
//--------------------------------------------------

/**
 * Initialize the task UI components and event handlers for a basic agent desktop
 * 
 * @param {Object} config - Configuration with callback functions
 */
export function initializeTaskUI(config = {}) {
    // Reset state
    resetState();
    
    // Get UI elements
    const elements = getUIElements();
    
    // Disable all controls initially
    disableAllControls(elements);
    
    // Set initial button text
    setInitialButtonText(elements);
    
    // Initialize consult UI
    initializeConsultUI();
    
    // Setup event handlers
    setupEventHandlers(config);
    
    console.log('✅ Task UI initialized');
}

/**
 * Reset all state variables to initial values
 */
function resetState() {
    taskList = [];
    currentTask = null;
    isHold = false;
    isMuted = false;
    isRecordingPaused = false;
}

/**
 * Get all UI elements used by task manager
 * @returns {Object} Map of element IDs to DOM elements
 */
function getUIElements() {
    return {
        accept: document.getElementById('btn-accept'),
        decline: document.getElementById('btn-decline'),
        hold: document.getElementById('btn-hold'),
        mute: document.getElementById('btn-mute'),
        end: document.getElementById('btn-end'),
        wrapup: document.getElementById('btn-wrapup'),
        wrapupCodes: document.getElementById('wrapup-codes'),
        transfer: document.getElementById('btn-transfer'),
        pauseResumeRecording: document.getElementById('pause-resume-recording'),
        taskList: document.getElementById('taskList'),
        remoteAudio: document.getElementById('remote-audio'),
        taskIndicator: document.getElementById('active-task-indicator')
    };
}

/**
 * Disable all UI controls initially
 * @param {Object} elements - UI elements map
 */
function disableAllControls(elements) {
    Object.values(elements).forEach(el => {
        if (el && (el.tagName === 'BUTTON' || el.tagName === 'SELECT')) {
            el.disabled = true;
        }
    });
}

/**
 * Set initial text for all buttons
 * @param {Object} elements - UI elements map
 */
function setInitialButtonText(elements) {
    if (elements.hold) elements.hold.textContent = 'Hold Call';
    if (elements.mute) elements.mute.textContent = 'Mute Call';
    if (elements.pauseResumeRecording) elements.pauseResumeRecording.textContent = 'Pause Recording';
}

/**
 * Setup event handlers for buttons and controls
 * @param {Object} config - Configuration with callbacks
 */
function setupEventHandlers(config) {
    const elements = getUIElements();
    
    // Core task control handlers
    if (config.onAccept && elements.accept) {
        elements.accept.addEventListener('click', () => config.onAccept(currentTask));
    }
    
    if (config.onDecline && elements.decline) {
        elements.decline.addEventListener('click', () => config.onDecline(currentTask));
    }
    
    if (config.onHold && elements.hold) {
        elements.hold.addEventListener('click', () => config.onHold(currentTask));
    }
    
    if (config.onMute && elements.mute) {
        elements.mute.addEventListener('click', () => config.onMute(currentTask));
    }
    
    // End call handler
    if (elements.end) {
        elements.end.addEventListener('click', () => endTask(currentTask));
    }
    
    // Wrapup handler with proper context binding
    setupWrapupHandler(elements.wrapup);
    
    // Recording controls
    setupRecordingControls(elements);
}

/**
 * Setup the wrapup button with proper handler
 * @param {HTMLElement} wrapupBtn - The wrapup button
 */
function setupWrapupHandler(wrapupBtn) {
    if (!wrapupBtn) {
        console.error('❌ Wrapup button not found');
        return;
    }
    
    // Create handler that captures currentTask
    const wrapupHandler = async (event) => {
        event.preventDefault();
        console.log('Submitting wrapup for task:', currentTask?.data?.interactionId);
        if (currentTask) {
            await submitWrapup(currentTask);
        }
    };
    
    // Clean up old handler if exists
    const oldHandler = wrapupBtn._wrapupHandler;
    if (oldHandler) {
        wrapupBtn.removeEventListener('click', oldHandler);
    }
    
    // Store and add new handler
    wrapupBtn._wrapupHandler = wrapupHandler;
    wrapupBtn.addEventListener('click', wrapupHandler);
    
    console.log('✅ Wrapup handler configured');
}

/**
 * Setup recording controls and handlers
 * @param {Object} elements - UI elements map
 */
function setupRecordingControls(elements) {
    if (elements.pauseResumeRecording) {
        elements.pauseResumeRecording.addEventListener('click', () => {
            toggleRecordingPause(currentTask);
        });
    }
    
}

//--------------------------------------------------
// EVENT LISTENERS SETUP
//--------------------------------------------------

/**
 * Setup task event listeners from the Webex CC SDK
 * @param {Object} webex - Webex SDK instance with Contact Center capabilities
 */
export function setupTaskEventListeners(webex) {
    // Global Contact Center events
    webex.cc.on(TASK_EVENTS.TASK_INCOMING, handleIncomingTask);
    webex.cc.on(TASK_EVENTS.TASK_HYDRATE, handleTaskHydrate);
    webex.cc.on(TASK_EVENTS.TASK_OFFER_CONTACT, handleTaskOfferContact);
    webex.cc.on(TASK_EVENTS.TASK_WRAPUP, handleWrapup);

    // Register task-specific events when a task is received
    webex.cc.on(TASK_EVENTS.TASK_INCOMING, setupTaskSpecificListeners);

    console.log('✅ Task event listeners registered');
}

/**
 * Setup task-specific event listeners
 * @param {Object} task - Task to listen to events from
 */
function setupTaskSpecificListeners(task) {
    // Task lifecycle events
    task.on(TASK_EVENTS.TASK_ASSIGNED, handleTaskAssigned);
    task.on(TASK_EVENTS.TASK_MEDIA, handleMediaTrack);
    task.on(TASK_EVENTS.TASK_UNASSIGNED, handleTaskUnassigned);
    task.on(TASK_EVENTS.TASK_HOLD, handleTaskHold);
    task.on(TASK_EVENTS.TASK_RESUME, handleTaskResume);
    task.on(TASK_EVENTS.TASK_END, handleTaskEnd);
    task.on(TASK_EVENTS.TASK_WRAPUP, handleWrapup);
    task.on(TASK_EVENTS.TASK_WRAPPEDUP, handleTaskWrappedUp);
    task.on(TASK_EVENTS.TASK_REJECT, handleTaskRejected);

    // Recording events
    task.on(TASK_EVENTS.TASK_RECORDING_PAUSED, handleRecordingPaused);
    task.on(TASK_EVENTS.TASK_RECORDING_PAUSE_FAILED, handleRecordingPauseFailed);
    task.on(TASK_EVENTS.TASK_RECORDING_RESUMED, handleRecordingResumed);
    task.on(TASK_EVENTS.TASK_RECORDING_RESUME_FAILED, handleRecordingResumeFailed);
}

//--------------------------------------------------
// TASK EVENT HANDLERS
//--------------------------------------------------

/**
 * Handle new incoming task
 * @param {Object} task - The new task
 */
function handleIncomingTask(task) {
    console.log('🔔 Incoming task:', task.data.interactionId);
    currentTask = task;
    
    // Update UI
    enableAnswerDeclineButtons(task);
    updateTaskList();
    showTaskIndicator(task);
}

/**
 * Show the task indicator with task details
 * @param {Object} task - The task to show details for
 */
function showTaskIndicator(task) {
    const indicator = document.getElementById('active-task-indicator');
    if (!indicator) return;
    
    const interactionId = task?.data?.interactionId || '';
    const mediaType = task?.data?.interaction?.mediaType || '';
    const customer = task?.data?.interaction?.customerName || task?.data?.interaction?.fromAddress || '';
    
    let info = `Incoming Task: You have a new interaction to accept.`;
    if (interactionId) info += `\nID: ${interactionId}`;
    if (mediaType) info += `\nType: ${mediaType}`;
    if (customer) info += `\nCustomer: ${customer}`;
    
    indicator.textContent = info;
    indicator.style.display = 'block';
}

/**
 * Agent has been assigned a task
 * @param {Object} task - The assigned task
 */
function handleTaskAssigned(task) {
    console.log('Task assigned:', task.data.interactionId);
    updateTaskList();
    handleTaskSelect(task);
}

/**
 * Task was unassigned from the agent
 * @param {Object} task - The unassigned task
 */
function handleTaskUnassigned(task) {
    console.log('Task unassigned:', task.data.interactionId);
    if (currentTask?.data.interactionId === task.data.interactionId) {
        clearCurrentTask();
    }
    updateTaskList();
}

/**
 * Handle voice media track
 * @param {MediaStreamTrack} track - The audio track
 */
function handleMediaTrack(track) {
    const audioElement = document.getElementById('remote-audio');
    if (audioElement) {
        audioElement.srcObject = new MediaStream([track]);
    }
}

/**
 * Task put on hold
 */
function handleTaskHold() {
    console.log('Task held');
    isHold = true;
    updateHoldControl();
}

/**
 * Task resumed from hold
 */
function handleTaskResume() {
    console.log('Task resumed');
    isHold = false;
    updateHoldControl();
}

/**
 * Task has ended
 * @param {Object} task - The task that ended
 */
function handleTaskEnd(task) {
    console.log('Task ended:', task.data.interactionId);
    
    // Hide active task indicator
    const indicator = document.getElementById('active-task-indicator');
    if (indicator) indicator.style.display = 'none';
    
    // FIXED: Disable accept/decline buttons rather than hiding them
    const acceptBtn = document.getElementById('btn-accept');
    const declineBtn = document.getElementById('btn-decline');
    if (acceptBtn) acceptBtn.disabled = true;
    if (declineBtn) declineBtn.disabled = true;
    
    // Process task end based on wrapup requirement
    if (currentTask?.data.interactionId === task.data.interactionId) {
        if (task.data.wrapUpRequired) {
            console.info('Call ended, wrapup required');
            updateWrapupCodes(window.wrapupCodes || []);
            enableWrapupMode();
        } else {
            console.log('Task ended without call being answered');
            clearCurrentTask();
        }
        updateTaskList();
        handleTaskSelect(task);
    }
}

/**
 * Task wrapped up
 * @param {Object} task - The wrapped up task
 */
function handleTaskWrappedUp(task) {
    console.log('Task wrapped up:', task.data.interactionId);
    if (currentTask?.data.interactionId === task.data.interactionId) {
        clearCurrentTask();
        updateTaskList();
    }
}

/**
 * Task restored after page refresh/reconnection
 * @param {Object} task - The hydrated task
 */
function handleTaskHydrate(task) {
    console.log('Task hydrated:', task.data.interactionId);
    currentTask = task;
    handleTaskSelect(currentTask);
}

/**
 * Task rejected
 * @param {string} reason - Reason for rejection
 */
function handleTaskRejected(reason) {
    console.info('Task rejected with reason:', reason);
}

/**
 * Task in wrapup state
 * @param {Object} data - Wrapup data with task
 */
function handleWrapup(data) {
    console.log('Task in wrapup state');
    
    // Update task if provided
    if (data && data.task) {
        console.log('Setting current task from wrapup event:', data.task.data.interactionId);
        currentTask = data.task;
    }
    
    // Enable wrapup UI
    updateWrapupCodes(window.wrapupCodes || []);
    enableWrapupMode();
}

/**
 * Task contact offered
 * @param {Object} task - The offered task
 */
function handleTaskOfferContact(task) {
    console.log('Task contact offered:', task.data.interactionId);
    if (!currentTask) {
        currentTask = task;
        enableAnswerDeclineButtons(task);
    }
    updateTaskList();
}

//--------------------------------------------------
// RECORDING EVENT HANDLERS
//--------------------------------------------------

/**
 * Recording successfully paused
 */
function handleRecordingPaused() {
    console.log('Recording paused');
    isRecordingPaused = true;
    updateRecordingControl();
}

/**
 * Recording pause failed
 */
function handleRecordingPauseFailed() {
    console.error('Recording pause failed');
    isRecordingPaused = false;
    updateRecordingControl();
}

/**
 * Recording successfully resumed
 */
function handleRecordingResumed() {
    console.log('Recording resumed');
    isRecordingPaused = false;
    updateRecordingControl();
}

/**
 * Recording resume failed
 */
function handleRecordingResumeFailed() {
    console.error('Recording resume failed');
    isRecordingPaused = true;
    updateRecordingControl();
}

//--------------------------------------------------
// TASK ACTION FUNCTIONS
//--------------------------------------------------

/**
 * Accept an incoming task
 * @param {Object} task - The task to accept
 */
export async function acceptTask(task = currentTask) {
    if (!task) {
        console.warn('No task available to accept');
        return;
    }

    try {
        await task.accept();
        console.log('✅ Task accepted:', task.data.interactionId);

        if (isVoiceTask(task)) {
            await setupVoiceTask(task);
        }
    } catch (error) {
        console.error('❌ Failed to accept task:', error);
        throw error;
    }
}

/**
 * Decline an incoming task
 * @param {Object} task - The task to decline
 */
export async function declineTask(task = currentTask) {
    if (!task) {
        console.warn('No task available to decline');
        return;
    }

    try {
        await task.decline();
        console.log('✅ Task declined');
        currentTask = null;
    } catch (error) {
        console.error('❌ Failed to decline task:', error);
        throw error;
    }
}

/**
 * Setup media for voice tasks
 * @param {Object} task - The voice task
 */
export async function setupVoiceTask(task) {
    if (!isVoiceTask(task)) {
        throw new Error('Media setup only available for voice tasks');
    }

    try {
        await task.setupMedia({
            audio: true,
            video: false,
            ringback: true
        });
        console.log('✅ Voice media setup complete');
    } catch (error) {
        console.error('❌ Voice media setup failed:', error);
        throw error;
    }
}

/**
 * Toggle hold state for a call
 * @param {Object} task - The task to hold/resume
 */
export async function toggleHold(task = currentTask) {
    if (!isVoiceTask(task)) {
        console.warn('Hold/Resume only available for voice tasks');
        return;
    }

    const holdBtn = document.getElementById('btn-hold');
    if (holdBtn) holdBtn.disabled = true;

    try {
        if (isHold) {
            await task.resume();
            console.info('Call resumed successfully');
        } else {
            await task.hold();
            console.info('Call held successfully');
        }
    } catch (error) {
        console.error('❌ Hold/Resume failed:', error);
    } finally {
        // Re-enable button and update UI
        updateHoldControl();
    }
}

/**
 * Toggle mute state
 * @param {Object} task - The task to mute/unmute
 */
export function toggleMute(task = currentTask) {
    if (!isVoiceTask(task)) {
        console.warn('Mute only available for voice tasks');
        return;
    }

    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) muteBtn.disabled = true;

    try {
        task.toggleMute();
        isMuted = !isMuted;
    } catch (error) {
        console.error('❌ Mute toggle failed:', error);
    } finally {
        // Re-enable button and update UI
        updateMuteControl();
    }
}

/**
 * Toggle recording pause state
 * @param {Object} task - The task to control recording for
 */
export async function toggleRecordingPause(task = currentTask) {
    if (!isVoiceTask(task)) {
        console.warn('Recording control only available for voice tasks');
        return;
    }

    const recordingBtn = document.getElementById('pause-resume-recording');
    if (recordingBtn) recordingBtn.disabled = true;

    try {
        if (isRecordingPaused) {
            await task.resumeRecording();
            console.info('Recording resumed successfully');
            isRecordingPaused = false;
        } else {
            await task.pauseRecording();
            console.info('Recording paused successfully');
            isRecordingPaused = true;
        }
    } catch (error) {
        console.error('❌ Recording control failed:', error);
    } finally {
        // Re-enable button and update UI
        updateRecordingControl();
    }
}

/**
 * Complete wrapup for a task
 * @param {Object} task - The task to wrap up
 */
export async function submitWrapup(task = currentTask) {
    if (!task) {
        console.warn('No task available for wrapup');
        return;
    }

    const wrapupBtn = document.getElementById('btn-wrapup');
    const wrapupCodesDropdown = document.getElementById('wrapup-codes');
    
    if (wrapupBtn) wrapupBtn.disabled = true;

    try {
        const selectedCode = wrapupCodesDropdown?.options[wrapupCodesDropdown.selectedIndex];
        if (!selectedCode || !selectedCode.value) {
            throw new Error('No wrapup code selected');
        }

        await task.wrapup({
            wrapUpReason: selectedCode.text,
            auxCodeId: selectedCode.value
        });
        console.info('✅ Call wrapped up successfully');
        
        // Disable controls after successful wrapup
        disableCallControls();
        if (wrapupCodesDropdown) wrapupCodesDropdown.disabled = true;
        clearCurrentTask();
    } catch (error) {
        console.error('❌ Wrapup failed:', error);
        // Re-enable wrapup button on failure
        if (wrapupBtn) wrapupBtn.disabled = false;
    }
}

/**
 * End a task
 * @param {Object} task - The task to end
 */
export async function endTask(task = currentTask) {
    if (!task) {
        console.warn('No task available to end');
        return;
    }

    try {
        await task.end();
        console.log('✅ Task ended successfully:', task.data.interactionId);
    } catch (error) {
        console.error('❌ Failed to end task:', error);
        throw error;
    }
}

//--------------------------------------------------
// UI UPDATE FUNCTIONS
//--------------------------------------------------

/**
 * Update wrapup codes dropdown
 * @param {Array} codes - Array of wrapup codes
 */
export function updateWrapupCodes(codes) {
    wrapupCodes = codes || [];
    const wrapupCodesDropdown = document.getElementById('wrapup-codes');
    if (!wrapupCodesDropdown) return;
    
    // Reset and create placeholder option
    wrapupCodesDropdown.innerHTML = '<option value="" selected>Choose Wrapup Code...</option>';
    
    // Add wrapup codes
    wrapupCodes.forEach((code) => {
        const option = document.createElement('option');
        option.text = code.name || code.label || 'Unknown';
        option.value = code.id;
        wrapupCodesDropdown.add(option);
    });

    // Enable the dropdown
    wrapupCodesDropdown.disabled = false;
    
    console.log(`Added ${wrapupCodes.length} wrapup codes to dropdown`);
}

/**
 * Clear current task and reset state
 */
function clearCurrentTask() {
    currentTask = null;
    isHold = false;
    isMuted = false;
    isRecordingPaused = false;
    resetCallControls();
    resetConsultControls();
}

/**
 * Enable wrapup mode UI
 */
function enableWrapupMode() {
    console.log('Enabling wrapup mode...');
    const wrapupBtn = document.getElementById('btn-wrapup');
    const wrapupCodesDropdown = document.getElementById('wrapup-codes');

    if (wrapupBtn && wrapupCodesDropdown) {
        // Enable wrapup controls
        wrapupBtn.disabled = false;
        wrapupCodesDropdown.disabled = false;
        
        // Disable call controls
        disableCallControls();
        
        console.log('✅ Wrapup mode enabled');
    } else {
        console.error('❌ Missing wrapup UI elements');
    }
}

/**
 * Enable answer and decline buttons for an incoming task
 * @param {Object} task - The incoming task
 */
function enableAnswerDeclineButtons(task) {
    if (!task) return;

    const answerBtn = document.getElementById('btn-accept');
    const declineBtn = document.getElementById('btn-decline');
    
    if (!answerBtn || !declineBtn) return;
    
    const isNewTask = task.data.interaction.state === 'new';
    answerBtn.disabled = !isNewTask;
    declineBtn.disabled = !isNewTask;
}

/**
 * Handle task selection
 * @param {Object} task - The selected task
 */
function handleTaskSelect(task) {
    if (!task) {
        console.log('No task selected');
        return;
    }
    
    console.log('Task selected:', task.data.interactionId);
    currentTask = task;
    enableCallControls();
}

/**
 * Enable call control buttons
 */
function enableCallControls() {
    const controls = [
        'btn-hold',
        'btn-mute',
        'btn-transfer',
        'btn-end',
        'pause-resume-recording'
    ];
    
    controls.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.disabled = false;
    });
}

/**
 * Reset call control buttons to initial state
 */
function resetCallControls() {
    const controls = {
        'btn-hold': 'Hold Call',
        'btn-mute': 'Mute Call',
        'btn-transfer': 'Transfer',
        'btn-end': 'End Call',
        'pause-resume-recording': 'Pause Recording'
    };

    Object.entries(controls).forEach(([id, text]) => {
        const element = document.getElementById(id);
        if (element) {
            element.disabled = true;
            element.textContent = text;
        }
    });

    const autoResumeCheckbox = document.getElementById('auto-resume-checkbox');
    if (autoResumeCheckbox) {
        autoResumeCheckbox.disabled = true;
        autoResumeCheckbox.checked = false;
    }
}

/**
 * Update the hold button state
 */
function updateHoldControl() {
    const holdBtn = document.getElementById('btn-hold');
    if (!holdBtn) return;
    
    holdBtn.textContent = isHold ? 'Resume Call' : 'Hold Call';
    holdBtn.disabled = !currentTask || !isVoiceTask(currentTask);
}

/**
 * Update the mute button state
 */
function updateMuteControl() {
    const muteBtn = document.getElementById('btn-mute');
    if (!muteBtn) return;
    
    muteBtn.textContent = isMuted ? 'Unmute Call' : 'Mute Call';
    muteBtn.disabled = !currentTask || !isVoiceTask(currentTask);
}

/**
 * Update the recording control button state
 */
function updateRecordingControl() {
    const recordingBtn = document.getElementById('pause-resume-recording');
    if (!recordingBtn) return;
    
    recordingBtn.textContent = isRecordingPaused ? 'Resume Recording' : 'Pause Recording';
    recordingBtn.disabled = !currentTask || !isVoiceTask(currentTask);
}

/**
 * Disable all call control buttons
 */
function disableCallControls() {
    const controls = [
        'btn-hold',
        'btn-mute',
        'btn-transfer',
        'pause-resume-recording',
        'btn-end'
    ];
    
    controls.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.disabled = true;
        }
    });
}

//--------------------------------------------------
// HELPER FUNCTIONS
//--------------------------------------------------

/**
 * Check if a task is a voice task
 * @param {Object} task - The task to check
 * @returns {boolean} True if the task is a voice task
 */
function isVoiceTask(task) {
    return task?.data?.interaction?.mediaType === 'telephony';
}

/**
 * Update the task list
 * @returns {Array} The updated task list
 */
function updateTaskList() {
    if (!window.webex?.cc?.taskManager) {
        console.warn('Task manager not available');
        return [];
    }
    
    const tasks = window.webex.cc.taskManager.getAllTasks();
    taskList = Object.values(tasks);
    return taskList;
}

// Re-export consult functions for convenience
export { initiateConsult };
