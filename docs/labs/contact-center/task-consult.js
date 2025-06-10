/**
 * Consult management functionality for Contact Center SDK
 */

// Consult events enum
export const CONSULT_EVENTS = {
    TASK_CONSULT_CREATED: 'task:consultCreated',
    TASK_OFFER_CONSULT: 'task:offerConsult',
    TASK_CONSULT_ACCEPTED: 'task:consultAccepted',
    TASK_CONSULTING: 'task:consulting',
    TASK_CONSULT_QUEUE_FAILED: 'task:consultQueueFailed',
    TASK_CONSULT_QUEUE_CANCELLED: 'task:consultQueueCancelled',
    TASK_CONSULT_END: 'task:consultEnd'
};

let currentConsultQueueId = null;

/**
 * Initialize the consult UI components
 */
export function initializeConsultUI() {
    const consultBtn = document.getElementById('btn-consult');
    const endConsultBtn = document.getElementById('btn-end-consult');
    const consultTransferBtn = document.getElementById('btn-consult-transfer');

    if (consultBtn) consultBtn.style.display = 'inline-block';
    if (endConsultBtn) endConsultBtn.style.display = 'none';
    if (consultTransferBtn) {
        consultTransferBtn.style.display = 'none';
        consultTransferBtn.disabled = true;
    }
}

/**
 * Setup consult event listeners
 * @param {Object} task - The task object to setup listeners for
 */
export function setupConsultEventListeners(task) {
    task.on(CONSULT_EVENTS.TASK_CONSULT_CREATED, handleConsultCreated);
    task.on(CONSULT_EVENTS.TASK_OFFER_CONSULT, handleConsultOffer);
    task.on(CONSULT_EVENTS.TASK_CONSULT_ACCEPTED, handleConsultAccepted);
    task.on(CONSULT_EVENTS.TASK_CONSULTING, handleConsulting);
    task.on(CONSULT_EVENTS.TASK_CONSULT_QUEUE_FAILED, handleConsultQueueFailed);
    task.on(CONSULT_EVENTS.TASK_CONSULT_QUEUE_CANCELLED, handleConsultQueueCancelled);
    task.on(CONSULT_EVENTS.TASK_CONSULT_END, handleConsultEnd);
}

/**
 * Initiate a consult
 * @param {Object} task - The task to initiate consult on
 * @param {Object} consultPayload - The consult payload
 */
export async function initiateConsult(task, consultPayload) {
    if (!task || !consultPayload) {
        console.error('Invalid task or consult payload');
        return;
    }

    try {
        if (consultPayload.destinationType === 'queue') {
            currentConsultQueueId = consultPayload.to;
            const endConsultBtn = document.getElementById('btn-end-consult');
            if (endConsultBtn) endConsultBtn.innerText = 'Cancel Consult';
        }

        await task.consult(consultPayload);
        console.log('Consult initiated successfully');
        updateConsultUI();
    } catch (error) {
        console.error('Failed to initiate consult:', error);
        if (consultPayload.destinationType === 'queue') {
            currentConsultQueueId = null;
            refreshConsultUI();
        }
        throw error;
    }
}

// Event Handlers
function handleConsultCreated(task) {
    console.log('Consult created:', task.data.interactionId);
    hideConsultButton();
    showEndConsultButton();
    disableCallControlsPostConsult();
}

function handleConsultOffer(task) {
    console.log('Received consult offer:', task.data.interactionId);
}

function handleConsultAccepted(task) {
    console.log('Consult accepted:', task.data.interactionId);
    hideConsultButton();
    showEndConsultButton();
    
    // Disable consult transfer until consulting begins
    const consultTransferBtn = document.getElementById('btn-consult-transfer');
    if (consultTransferBtn) consultTransferBtn.disabled = true;
}

function handleConsulting(task) {
    console.log('Consulting in progress:', task.data.interactionId);
    const consultTransferBtn = document.getElementById('btn-consult-transfer');
    if (consultTransferBtn) {
        consultTransferBtn.style.display = 'inline-block';
        consultTransferBtn.disabled = false;
    }
}

function handleConsultQueueFailed(task) {
    console.error('Queue consult failed:', task.data.interactionId);
    currentConsultQueueId = null;
    hideEndConsultButton();
    showConsultButton();
}

function handleConsultQueueCancelled(task) {
    console.log('Queue consult cancelled:', task.data.interactionId);
    currentConsultQueueId = null;
    hideEndConsultButton();
    showConsultButton();
    enableTransferControls();
    enableCallControlsPostConsult();
}

function handleConsultEnd(task) {
    console.log('Consult ended:', task.data.interactionId);
    currentConsultQueueId = null;
    refreshConsultUI();

    if (task.data.isConsulted) {
        enableWrapupMode();
    }
}

// UI Helper Functions
function hideConsultButton() {
    const consultBtn = document.getElementById('btn-consult');
    if (consultBtn) consultBtn.style.display = 'none';
}

function showConsultButton() {
    const consultBtn = document.getElementById('btn-consult');
    if (consultBtn) consultBtn.style.display = 'inline-block';
}

function hideEndConsultButton() {
    const endConsultBtn = document.getElementById('btn-end-consult');
    if (endConsultBtn) endConsultBtn.style.display = 'none';
}

function showEndConsultButton() {
    const endConsultBtn = document.getElementById('btn-end-consult');
    if (endConsultBtn) endConsultBtn.style.display = 'inline-block';
}

function disableCallControlsPostConsult() {
    const controls = ['btn-hold', 'pause-resume-recording', 'btn-end'];
    controls.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.disabled = true;
    });
}

function enableCallControlsPostConsult() {
    const controls = ['btn-hold', 'pause-resume-recording', 'btn-end'];
    controls.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.disabled = false;
    });
}

function enableTransferControls() {
    const transferBtn = document.getElementById('btn-transfer');
    if (transferBtn) transferBtn.disabled = false;
}

function refreshConsultUI() {
    enableCallControlsPostConsult();
    enableTransferControls();
    showConsultButton();
    hideEndConsultButton();

    const consultTransferBtn = document.getElementById('btn-consult-transfer');
    if (consultTransferBtn) {
        consultTransferBtn.style.display = 'none';
        consultTransferBtn.disabled = true;
    }
}

function enableWrapupMode() {
    const wrapupBtn = document.getElementById('btn-wrapup');
    const wrapupCodesDropdown = document.getElementById('wrapup-codes');
    if (wrapupBtn && wrapupCodesDropdown) {
        wrapupBtn.disabled = false;
        wrapupCodesDropdown.disabled = false;
    }
    disableCallControlsPostConsult();
}

// UI State Update
function updateConsultUI() {
    disableCallControlsPostConsult();
    const transferBtn = document.getElementById('btn-transfer');
    if (transferBtn) transferBtn.disabled = true;
    hideConsultButton();
    showEndConsultButton();
}

/**
 * Reset the consult controls to their initial state
 */
export function resetConsultControls() {
    const consultBtn = document.getElementById('btn-consult');
    const endConsultBtn = document.getElementById('btn-end-consult');
    const consultTransferBtn = document.getElementById('btn-consult-transfer');

    if (consultBtn) {
        consultBtn.style.display = 'inline-block';
        consultBtn.disabled = true;
    }
    if (endConsultBtn) {
        endConsultBtn.style.display = 'none';
        endConsultBtn.disabled = true;
    }
    if (consultTransferBtn) {
        consultTransferBtn.style.display = 'none';
        consultTransferBtn.disabled = true;
    }
}
