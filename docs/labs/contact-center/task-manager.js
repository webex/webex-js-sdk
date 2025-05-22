/**
 * Task management functionality for Contact Center SDK
 */

import {
    setupConsultEventListeners,
    initializeConsultUI,
    initiateConsult,
    enableConsultTransferControls,
    disableConsultTransferControls,
    resetConsultControls,
    CONSULT_EVENTS
} from './task-consult.js';

// Task events enum
export const TASK_EVENTS = {
  TASK_INCOMING: 'task:incoming',
  TASK_ASSIGNED: 'task:assigned',
  TASK_MEDIA: 'task:media',
  TASK_UNASSIGNED: 'task:unassigned',
  TASK_HOLD: 'task:hold',
  TASK_UNHOLD: 'task:unhold',
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

// Current task and UI state
let currentTask = null;
let taskList = [];
let isHold = false;
let isMuted = false;
let wrapupCodes = [];
let isRecordingPaused = false;
let autoResumeEnabled = false;

/**
 * Initialize the task UI components and event handlers
 * @param {Object} config - Configuration object with element IDs and callbacks
 */
export function initializeTaskUI(config = {}) {
    // Reset all state
    taskList = [];
    currentTask = null;
    isHold = false;
    isMuted = false;
    isRecordingPaused = false;
    autoResumeEnabled = false;

    // Initialize basic call controls
    const elements = {
        accept: document.getElementById('btn-accept'),
        decline: document.getElementById('btn-decline'),
        hold: document.getElementById('btn-hold'),
        mute: document.getElementById('btn-mute'),
        wrapup: document.getElementById('btn-wrapup'),
        wrapupCodes: document.getElementById('wrapup-codes'),
        transfer: document.getElementById('btn-transfer'),
        pauseResumeRecording: document.getElementById('pause-resume-recording'),
        autoResumeCheckbox: document.getElementById('auto-resume-checkbox'),
        taskList: document.getElementById('taskList')
    };

    // Disable initial controls
    Object.values(elements).forEach(el => {
        if (el && (el.tagName === 'BUTTON' || el.tagName === 'SELECT')) {
            el.disabled = true;
        }
    });

    // Set initial button text
    if (elements.hold) elements.hold.textContent = 'Hold Call';
    if (elements.mute) elements.mute.textContent = 'Mute Call';
    if (elements.pauseResumeRecording) elements.pauseResumeRecording.textContent = 'Pause Recording';

    // Initialize consult UI
    initializeConsultUI();

    // Setup button click handlers with reference to proper events
    setupEventHandlers(config);
}

/**
 * Setup event handlers for buttons and controls
 */
function setupEventHandlers(config) {
    const elements = {
        accept: document.getElementById('btn-accept'),
        decline: document.getElementById('btn-decline'),
        hold: document.getElementById('btn-hold'),
        mute: document.getElementById('btn-mute'),
        wrapup: document.getElementById('btn-wrapup'),
        pauseResumeRecording: document.getElementById('pause-resume-recording'),
        autoResumeCheckbox: document.getElementById('auto-resume-checkbox')
    };

    // Set up click handlers
    if (config.onAccept) elements.accept?.addEventListener('click', () => config.onAccept(currentTask));
    if (config.onDecline) elements.decline?.addEventListener('click', () => config.onDecline(currentTask));
    if (config.onHold) elements.hold?.addEventListener('click', () => config.onHold(currentTask));
    if (config.onMute) elements.mute?.addEventListener('click', () => config.onMute(currentTask));
    if (config.onWrapup) elements.wrapup?.addEventListener('click', () => config.onWrapup(currentTask));

    // Recording controls
    if (elements.pauseResumeRecording) {
        elements.pauseResumeRecording.addEventListener('click', () => toggleRecordingPause(currentTask));
    }

    if (elements.autoResumeCheckbox) {
        elements.autoResumeCheckbox.addEventListener('change', (event) => {
            autoResumeEnabled = event.target.checked;
        });
    }
}

/**
 * Setup task event listeners
 * @param {Object} webex - Webex SDK instance
 */
export function setupTaskEventListeners(webex) {
    // Task lifecycle events
    webex.cc.on(TASK_EVENTS.TASK_INCOMING, handleIncomingTask);
    webex.cc.on(TASK_EVENTS.TASK_ASSIGNED, handleTaskAssigned);
    webex.cc.on(TASK_EVENTS.TASK_MEDIA, handleMediaTrack);
    webex.cc.on(TASK_EVENTS.TASK_UNASSIGNED, handleTaskUnassigned);
    webex.cc.on(TASK_EVENTS.TASK_HOLD, handleTaskHold);
    webex.cc.on(TASK_EVENTS.TASK_UNHOLD, handleTaskUnhold);
    webex.cc.on(TASK_EVENTS.TASK_END, handleTaskEnd);
    webex.cc.on(TASK_EVENTS.TASK_WRAPUP, handleWrapup);
    webex.cc.on(TASK_EVENTS.TASK_WRAPPEDUP, handleTaskWrappedUp);
    webex.cc.on(TASK_EVENTS.TASK_REJECT, handleTaskRejected);
    webex.cc.on(TASK_EVENTS.TASK_HYDRATE, handleTaskHydrate);
    webex.cc.on(TASK_EVENTS.TASK_OFFER_CONTACT, handleTaskOfferContact);

    // Setup consult event listeners
    setupConsultEventListeners(webex);

    // Recording events
    webex.cc.on(TASK_EVENTS.TASK_RECORDING_PAUSED, handleRecordingPaused);
    webex.cc.on(TASK_EVENTS.TASK_RECORDING_PAUSE_FAILED, handleRecordingPauseFailed);
    webex.cc.on(TASK_EVENTS.TASK_RECORDING_RESUMED, handleRecordingResumed);
    webex.cc.on(TASK_EVENTS.TASK_RECORDING_RESUME_FAILED, handleRecordingResumeFailed);

    console.log('✅ Task event listeners registered');
}

// Task Lifecycle Event Handlers
function handleTaskAssigned(task) {
    console.log('Task assigned:', task.data.interactionId);
    updateTaskList();
    handleTaskSelect(task);
}

function handleTaskUnassigned(task) {
    console.log('Task unassigned:', task.data.interactionId);
    if (currentTask?.data.interactionId === task.data.interactionId) {
        clearCurrentTask();
    }
    updateTaskList();
}

function handleTaskHold(task) {
    console.log('Task held:', task.data.interactionId);
    if (currentTask?.data.interactionId === task.data.interactionId) {
        isHold = true;
        updateHoldControl();
    }
}

function handleTaskUnhold(task) {
    console.log('Task unheld:', task.data.interactionId);
    if (currentTask?.data.interactionId === task.data.interactionId) {
        isHold = false;
        updateHoldControl();
    }
}

function handleTaskEnd(task) {
    console.log('Task ended:', task.data.interactionId);
    if (currentTask?.data.interactionId === task.data.interactionId) {
        if (!task.data.wrapUpRequired) {
            console.log('Task ended without call being answered');
            document.getElementById('btn-accept').disabled = true;
            document.getElementById('btn-decline').disabled = true;
            clearCurrentTask();
        } else {
            console.info('Call ended, wrapup required');
            enableWrapupMode();
        }
        updateTaskList();
        handleTaskSelect(task);
    }
}

function handleTaskWrappedUp(task) {
    console.log('Task wrapped up:', task.data.interactionId);
    if (currentTask?.data.interactionId === task.data.interactionId) {
        clearCurrentTask();
        updateTaskList();
    }
}

function handleTaskHydrate(task) {
    console.log('Task hydrated:', task.data.interactionId);
    currentTask = task;
    handleTaskSelect(currentTask);
}

function handleIncomingTask(task) {
    console.log('🔔 Incoming task:', task.data.interactionId);
    currentTask = task;
    enableAnswerDeclineButtons(task);
    updateTaskList();
}

function handleMediaTrack(track) {
    if (document.getElementById('remote-audio')) {
        document.getElementById('remote-audio').srcObject = new MediaStream([track]);
    }
}

function handleTaskRejected(reason) {
    console.info('Task rejected with reason:', reason);
}

function handleWrapup(data) {
    console.log('Task in wrapup:', data);
    enableWrapupMode();
}

function handleTaskOfferContact(task) {
    console.log('Task contact offered:', task.data.interactionId);
    if (!currentTask) {
        currentTask = task;
        enableAnswerDeclineButtons(task);
    }
    updateTaskList();
}

// Recording Event Handlers
function handleRecordingPaused(task) {
    console.log('Recording paused:', task.data.interactionId);
    if (currentTask?.data.interactionId === task.data.interactionId) {
        isRecordingPaused = true;
        updateRecordingControl();
    }
}

function handleRecordingPauseFailed(task) {
    console.error('Recording pause failed:', task.data.interactionId);
    if (currentTask?.data.interactionId === task.data.interactionId) {
        isRecordingPaused = false;
        updateRecordingControl();
    }
}

function handleRecordingResumed(task) {
    console.log('Recording resumed:', task.data.interactionId);
    if (currentTask?.data.interactionId === task.data.interactionId) {
        isRecordingPaused = false;
        updateRecordingControl();
        if (document.getElementById('auto-resume-checkbox')) {
            document.getElementById('auto-resume-checkbox').disabled = true;
        }
    }
}

function handleRecordingResumeFailed(task) {
    console.error('Recording resume failed:', task.data.interactionId);
    if (currentTask?.data.interactionId === task.data.interactionId) {
        isRecordingPaused = true;
        updateRecordingControl();
    }
}

// Action Functions
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
        updateHoldControl();
    } finally {
        if (holdBtn) holdBtn.disabled = false;
    }
}

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
        updateMuteControl();
    } catch (error) {
        console.error('❌ Mute toggle failed:', error);
    } finally {
        if (muteBtn) muteBtn.disabled = false;
    }
}

export async function toggleRecordingPause(task = currentTask) {
    if (!isVoiceTask(task)) {
        console.warn('Recording control only available for voice tasks');
        return;
    }

    const recordingBtn = document.getElementById('pause-resume-recording');
    if (recordingBtn) recordingBtn.disabled = true;

    try {
        if (isRecordingPaused) {
            const resumeParams = autoResumeEnabled ? { autoResumed: true } : undefined;
            await task.resumeRecording(resumeParams);
            console.info('Recording resumed successfully');
            isRecordingPaused = false;
            if (document.getElementById('auto-resume-checkbox')) {
                document.getElementById('auto-resume-checkbox').disabled = true;
            }
        } else {
            await task.pauseRecording();
            console.info('Recording paused successfully');
            isRecordingPaused = true;
            if (document.getElementById('auto-resume-checkbox')) {
                document.getElementById('auto-resume-checkbox').disabled = false;
            }
        }
        updateRecordingControl();
    } catch (error) {
        console.error('❌ Recording control failed:', error);
    } finally {
        if (recordingBtn) recordingBtn.disabled = false;
    }
}

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
        if (!selectedCode) {
            throw new Error('No wrapup code selected');
        }

        await task.wrapup({
            wrapUpReason: selectedCode.text,
            auxCodeId: selectedCode.value
        });
        console.info('Call wrapped up successfully');
        
        // Disable all controls after successful wrapup
        disableCallControls();
        wrapupCodesDropdown.disabled = true;
        clearCurrentTask();
    } catch (error) {
        console.error('❌ Wrapup failed:', error);
        if (wrapupBtn) wrapupBtn.disabled = false;
    }
}

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

// Helper Functions
function isVoiceTask(task) {
    return task?.data?.interaction?.mediaType === 'telephony';
}

export function updateWrapupCodes(codes) {
    wrapupCodes = codes;
    const wrapupCodesDropdown = document.getElementById('wrapup-codes');
    if (wrapupCodesDropdown) {
        wrapupCodesDropdown.innerHTML = '';
        wrapupCodes.forEach((code) => {
            const option = document.createElement('option');
            option.text = code.name;
            option.value = code.id;
            wrapupCodesDropdown.add(option);
        });
    }
}

function clearCurrentTask() {
    currentTask = null;
    isHold = false;
    isMuted = false;
    isRecordingPaused = false;
    autoResumeEnabled = false;
    resetCallControls();
    resetConsultControls();
}

function enableWrapupMode() {
    const wrapupBtn = document.getElementById('btn-wrapup');
    const wrapupCodesDropdown = document.getElementById('wrapup-codes');
    if (wrapupBtn && wrapupCodesDropdown) {
        wrapupBtn.disabled = false;
        wrapupCodesDropdown.disabled = false;
        disableCallControls();
    }
}

function enableAnswerDeclineButtons(task) {
    if (!task) return;

    const answerBtn = document.getElementById('btn-accept');
    const declineBtn = document.getElementById('btn-decline');
    
    if (task.data.interaction.state === 'new') {
        answerBtn.disabled = false;
        declineBtn.disabled = false;
    } else {
        answerBtn.disabled = true;
        declineBtn.disabled = true;
    }
}

function handleTaskSelect(task) {
    if (!task) {
        console.log('No task selected');
        return;
    }
    console.log('Task selected:', task.data.interactionId);
    enableCallControls();
}

function enableCallControls() {
    document.getElementById('btn-hold').disabled = false;
    document.getElementById('btn-mute').disabled = false;
    document.getElementById('btn-transfer').disabled = false;
    document.getElementById('pause-resume-recording')?.disabled = false;
}

function resetCallControls() {
    const controls = {
        'btn-hold': 'Hold Call',
        'btn-mute': 'Mute Call',
        'btn-transfer': 'Transfer',
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

function updateHoldControl() {
    const holdBtn = document.getElementById('btn-hold');
    if (holdBtn) {
        holdBtn.textContent = isHold ? 'Resume Call' : 'Hold Call';
        holdBtn.disabled = !currentTask || !isVoiceTask(currentTask);
    }
}

function updateMuteControl() {
    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) {
        muteBtn.textContent = isMuted ? 'Unmute Call' : 'Mute Call';
        muteBtn.disabled = !currentTask || !isVoiceTask(currentTask);
    }
}

function updateRecordingControl() {
    const recordingBtn = document.getElementById('pause-resume-recording');
    if (recordingBtn) {
        recordingBtn.textContent = isRecordingPaused ? 'Resume Recording' : 'Pause Recording';
        recordingBtn.disabled = !currentTask || !isVoiceTask(currentTask);
    }
}

function disableCallControls() {
    const controls = [
        'btn-hold',
        'btn-mute',
        'btn-transfer',
        'pause-resume-recording',
        'btn-end',
        'auto-resume-checkbox'
    ];
    
    controls.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.disabled = true;
            if (element.tagName === 'BUTTON') {
                element.textContent = element.textContent.replace('Resume', '').replace('Unmute', 'Mute');
            }
        }
    });
}

// Task List Management
export function getTaskList() {
    return taskList;
}

export function updateTaskList() {
    const tasks = window.webex.cc.taskManager.getAllTasks();
    taskList = Object.values(tasks);
    return taskList;
}

export function getCurrentTask() {
    return currentTask;
}

export function handleTaskListUpdate(callback) {
    updateTaskList();
    if (typeof callback === 'function') {
        callback(taskList);
    }
}

// Re-export consult functions for convenience
export { initiateConsult };
