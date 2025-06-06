/**
 * Agent state management functionality for Contact Center SDK
 * Shows both simple window.webex usage and robust implementation
 */

/**
 * Set agent state
 * Simple usage from lab.html:
 * await window.webex.cc.setAgentState({
 *     state: 'WellbeingBreak',
 *     auxCodeId: '07f1c9af-b86c-4a9b-a59a-347545303014'
 * });
 * 
 * @param {Object} webex - Webex SDK instance
 * @param {Object} params - State change parameters
 * @param {string} params.state - State name
 * @param {string} params.auxCodeId - Aux/Idle code ID
 * @returns {Promise<Object>} State change response
 */
export async function setAgentState(webex, { state, auxCodeId }) {
    try {
        const response = await webex.cc.setAgentState({
            state,
            auxCodeId
        });
        console.log('✅ Agent state set successfully:', state);
        return response;
    } catch (error) {
        console.error('Agent state set failed:', error);
        throw error;
    }
}

/**
 * Handle state change from UI selection
 * @param {Object} webex - Webex SDK instance
 */
export async function handleStateChange(webex) {
    if (!webex?.cc) {
        console.error('Webex CC SDK not initialized');
        alert('Webex CC SDK not initialized');
        return;
    }

    const stateSelect = document.getElementById('sel-state');
    const selectedOption = stateSelect.options[stateSelect.selectedIndex];
    
    if (!selectedOption?.value) {
        alert('Please select a state');
        return;
    }

    const stateButton = document.getElementById('btn-set-state');
    if (stateButton) stateButton.disabled = true;

    try {
        const stateParams = {
            state: selectedOption.dataset.state || 'Idle',
            auxCodeId: selectedOption.value
        };

        if (selectedOption.text === 'Available') {
            stateParams.state = 'Available';
        }

        await setAgentState(webex, stateParams);
        console.log('✅ Agent state changed to:', stateParams.state, 'with auxId:', stateParams.auxCodeId);

        // Update state selection to reflect change
        stateSelect.value = selectedOption.value;
    } catch (e) {
        console.error('Agent state change failed:', e);
        alert('Failed to change agent state');
    } finally {
        if (stateButton) stateButton.disabled = false;
    }
}

/**
 * Setup state change event listeners
 * Simple usage from lab.html:
 * window.webex.cc.on('agent:stateChange', (data) => {
 *     console.log('Agent state changed:', data.state);
 * });
 * 
 * @param {Object} webex - Webex SDK instance
 */
export function setupStateEventListeners(webex) {
    webex.cc.on('agent:stateChange', (data) => {
        if (data?.type === 'AgentStateChangeSuccess') {
            updateStateUI(data);
        }
    });
}

/**
 * Initialize state management UI
 */
export function initializeStateUI() {
    // Set up button click handler
    const stateButton = document.getElementById('btn-set-state');
    const stateSelect = document.getElementById('sel-state');

    if (stateButton && stateSelect) {
        // Initially disable state controls
        stateSelect.disabled = true;
        stateButton.disabled = true;

        // Set up button click handler
        stateButton.onclick = () => {
            if (window.webex) {
                handleStateChange(window.webex);
            } else {
                console.error('Webex instance not available');
                alert('Webex instance not available');
            }
        };

        // Set up select change handler
        stateSelect.onchange = () => {
            if (stateSelect.value) {
                stateButton.disabled = false;
            }
        };
    }
}

// Private helper functions

/**
 * Update UI to reflect current state
 * @param {Object} data - State change event data
 */
function updateStateUI(data) {
    const stateSelect = document.getElementById('sel-state');
    const auxCodeId = data.auxCodeId?.trim() || '0';
    const state = data.state || 'Idle';

    // Find option that matches the auxCodeId or state
    let option = Array.from(stateSelect.options).find(opt =>
        (opt.dataset.isAux && opt.value === auxCodeId) ||
        (!opt.dataset.isAux && opt.text.toLowerCase() === state.toLowerCase())
    );

    // If no match found and it's Available state, find Available option
    if (!option && state === 'Available') {
        option = Array.from(stateSelect.options).find(opt => opt.value === '0');
    }

    if (option) {
        stateSelect.value = option.value;
        console.log('✅ Agent state updated to:', option.text,
            option.dataset.isAux ? `(aux code: ${option.value})` : '');
    } else {
        console.warn('Could not find matching state option for:', state, auxCodeId);
    }
}

/**
 * Enable/disable state management controls
 * @param {boolean} enabled - Whether controls should be enabled
 */
export function setStateControlsEnabled(enabled) {
    document.getElementById('sel-state').disabled = !enabled;
    document.getElementById('btn-set-state').disabled = !enabled;
}
