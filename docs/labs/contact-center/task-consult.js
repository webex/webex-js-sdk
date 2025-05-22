/**
 * Consult functionality for Contact Center SDK
 */

// Current consult state
let currentConsultTask = null;
let currentConsultQueueId = null;

// Consult events from TASK_EVENTS enum
export const CONSULT_EVENTS = {
    CONSULT_END: 'task:consultEnd',
    CONSULT_QUEUE_CANCELLED: 'task:consultQueueCancelled',
    CONSULT_QUEUE_FAILED: 'task:consultQueueFailed',
    CONSULT_ACCEPTED: 'task:consultAccepted',
    CONSULTING: 'task:consulting',
    CONSULT_CREATED: 'task:consultCreated',
    OFFER_CONSULT: 'task:offerConsult'
};

/**
 * Setup consult event listeners
 * @param {Object} webex - Webex SDK instance
 */
export function setupConsultEventListeners(webex) {
    webex.cc.on(CONSULT_EVENTS.CONSULT_CREATED, handleConsultCreated);
    webex.cc.on(CONSULT_EVENTS.OFFER_CONSULT, handleConsultOffer);
    webex.cc.on(CONSULT_EVENTS.CONSULT_ACCEPTED, handleConsultAccepted);
    webex.cc.on(CONSULT_EVENTS.CONSULTING, handleConsulting);
    webex.cc.on(CONSULT_EVENTS.CONSULT_QUEUE_FAILED, handleConsultQueueFailed);
    webex.cc.on(CONSULT_EVENTS.CONSULT_QUEUE_CANCELLED, handleConsultQueueCancelled);
    webex.cc.on(CONSULT_EVENTS.CONSULT_END, handleConsultEnd);

    console.log('✅ Consult event listeners registered');
}

/**
 * Initialize consult UI components
 */
export function initializeConsultUI() {
    const elements = {
        consult: document.getElementById('btn-consult'),
        endConsult: document.getElementById('btn-end-consult'),
        consultTransfer: document.getElementById('btn-consult-transfer')
    };

    // Initialize visibility
    if (elements.consult) elements.consult.style.display = 'none';
    if (elements.endConsult) elements.endConsult.style.display = 'none';
    if (elements.consultTransfer) elements.consultTransfer.disabled = true;
}

/**
 * Initiate consult with another agent or queue
 * @param {Object} task - Current task
 * @param {Object} consultPayload - Consult parameters
 */
export async function initiateConsult(task, consultPayload) {
    if (!task) {
        console.warn('No active task for consult');
        return;
    }

    try {
        if (consultPayload.destinationType === 'queue') {
            currentConsultQueueId = consultPayload.to;
        }
        await task.consult(consultPayload);
        console.log('✅ Consult initiated successfully');
        currentConsultTask = task;
    } catch (error) {
        console.error('❌ Failed to initiate consult:', error);
        currentConsultQueueId = null;
        throw error;
    }
}

// Event Handlers
function handleConsultCreated(task) {
    console.info('Consult created for task:', task.data.interactionId);
    currentConsultTask = task;
    enableConsultTransferControls();
}

function handleConsultOffer(task) {
    console.info('Received consult offer from another agent for task:', task.data.interactionId);
}

function handleConsultAccepted(task) {
    console.info('Consult accepted for task:', task.data.interactionId);
    if (currentConsultTask?.data.interactionId === task.data.interactionId) {
        disableConsultTransferControls();
    }
}

function handleConsulting(task) {
    console.info('Consulting for task:', task.data.interactionId);
    if (currentConsultTask?.data.interactionId === task.data.interactionId) {
        enableConsultTransferControls();
    }
}

function handleConsultQueueFailed(task) {
    console.error('Consult queue failed for task:', task.data.interactionId);
    if (currentConsultTask?.data.interactionId === task.data.interactionId) {
        resetConsultControls();
        currentConsultTask = null;
        currentConsultQueueId = null;
    }
}

function handleConsultQueueCancelled(task) {
    console.log('Consult queue cancelled for task:', task.data.interactionId);
    if (currentConsultTask?.data.interactionId === task.data.interactionId) {
        resetConsultControls();
        currentConsultTask = null;
        currentConsultQueueId = null;
    }
}

function handleConsultEnd(task) {
    console.log('Consult ended for task:', task.data.interactionId);
    if (currentConsultTask?.data.interactionId === task.data.interactionId) {
        resetConsultControls();
        currentConsultTask = null;
        currentConsultQueueId = null;
    }
}

// UI Controls
export function enableConsultTransferControls() {
    const consultTransferBtn = document.getElementById('btn-consult-transfer');
    if (consultTransferBtn) {
        consultTransferBtn.disabled = false;
        consultTransferBtn.style.display = 'inline-block';
    }
}

export function disableConsultTransferControls() {
    const consultTransferBtn = document.getElementById('btn-consult-transfer');
    if (consultTransferBtn) {
        consultTransferBtn.disabled = true;
    }
}

export function resetConsultControls() {
    const elements = {
        consult: document.getElementById('btn-consult'),
        endConsult: document.getElementById('btn-end-consult'),
        consultTransfer: document.getElementById('btn-consult-transfer')
    };

    if (elements.consult) {
        elements.consult.style.display = 'inline-block';
        elements.consult.disabled = false;
    }
    if (elements.endConsult) {
        elements.endConsult.style.display = 'none';
        elements.endConsult.disabled = true;
    }
    if (elements.consultTransfer) {
        elements.consultTransfer.disabled = true;
        elements.consultTransfer.style.display = 'none';
    }
}

// State getters
export function getCurrentConsultTask() {
    return currentConsultTask;
}

export function getCurrentConsultQueueId() {
    return currentConsultQueueId;
}
