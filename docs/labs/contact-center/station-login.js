/**
 * Station login functionality for Contact Center SDK
 * Shows both simple window.webex usage and robust implementation
 */

let deviceId = null;
let agentDeviceType = null;

/**
 * Handle agent login type selection
 * @param {Event} event - Change event from login type dropdown
 */
export function handleAgentLogin(event) {
    agentDeviceType = event.target.value;
    const dialNumberInput = document.getElementById('dialNumber');
    dialNumberInput.disabled = !(agentDeviceType === 'AGENT_DN' || agentDeviceType === 'EXTENSION');
}

/**
 * Perform station login
 * @param {Object} webex - Webex SDK instance
 */
export async function handleStationLogin(webex) {
    const teamId = document.getElementById('teamsDropdown').value;
    const dialNumber = document.getElementById('dialNumber').value;

    // Validate inputs
    if (!teamId) {
        alert('Please select a team');
        return;
    }

    if (!agentDeviceType) {
        alert('Please select agent login type');
        return;
    }

    if ((agentDeviceType === 'AGENT_DN' || agentDeviceType === 'EXTENSION') && !dialNumber) {
        alert('Dial number is required for selected login type');
        return;
    }

    try {
        const response = await webex.cc.stationLogin({
            teamId,
            loginOption: agentDeviceType,
            dialNumber
        });

        console.log('✅ Station login successful:', response);
        deviceId = response.deviceId;
        window.deviceId = deviceId; // Store for cleanup

        // Update UI state
        updateUIAfterLogin(agentDeviceType);

        return response;
    } catch (error) {
        console.error('❌ Station login failed:', error);
        alert('Station login failed: ' + error.message);
        throw error;
    }
}

/**
 * Perform station logout
 * @param {Object} webex - Webex SDK instance
 */
export async function handleStationLogout(webex) {
    if (!deviceId) {
        console.warn('No device ID found for logout');
        return;
    }

    try {
        await webex.cc.stationLogout({ 
            logoutReason: 'userInitiated',
            deviceId
        });
        console.log('✅ Station logout successful');
        
        // Reset UI state
        updateUIAfterLogout();
        
        // Clear stored device info
        deviceId = null;
        window.deviceId = null;
        agentDeviceType = null;
    } catch (error) {
        console.error('❌ Station logout failed:', error);
        alert('Station logout failed: ' + error.message);
        throw error;
    }
}

/**
 * Setup station event listeners
 * @param {Object} webex - Webex SDK instance
 */
export function setupStationEventListeners(webex) {
    webex.cc.on('agent:stationLoginSuccess', (data) => {
        console.log('Station login success:', data);
        deviceId = data.deviceId;
        window.deviceId = deviceId;
        agentDeviceType = data.deviceType;

        handleInitialState(data);
    });

    webex.cc.on('agent:multiLogin', (data) => {
        if (data?.type === 'AgentMultiLoginCloseSession') {
            console.warn('Multiple agent login sessions detected!');
            alert('Multiple agent login sessions detected - this session will be closed');
            handleStationLogout(webex).catch(console.error);
        }
    });
}

// Private helper functions
function updateUIAfterLogin(deviceType) {
    // Disable registration fields
    document.getElementById('teamsDropdown').disabled = true;
    document.getElementById('AgentLogin').disabled = true;
    document.getElementById('loginStation').disabled = true;
    document.getElementById('dialNumber').disabled = true;

    // Show logout button
    document.getElementById('logoutStation').classList.remove('hidden');
    
    // Enable controls
    document.getElementById('sel-state').disabled = false;
    document.getElementById('btn-set-state').disabled = false;
    document.getElementById('btn-accept').disabled = false;
    document.getElementById('btn-decline').disabled = false;
    document.getElementById('btn-hold').disabled = false;
    document.getElementById('btn-mute').disabled = false;
}

function updateUIAfterLogout() {
    // Re-enable login controls
    document.getElementById('teamsDropdown').disabled = false;
    document.getElementById('AgentLogin').disabled = false;
    document.getElementById('loginStation').disabled = false;

    // Reset and hide logout button
    document.getElementById('logoutStation').classList.add('hidden');
    document.getElementById('dialNumber').value = '';
    document.getElementById('dialNumber').disabled = true;
    document.getElementById('AgentLogin').value = '';

    // Disable other controls
    document.getElementById('sel-state').disabled = true;
    document.getElementById('btn-set-state').disabled = true;
    document.getElementById('btn-accept').disabled = true;
    document.getElementById('btn-decline').disabled = true;
    document.getElementById('btn-hold').disabled = true;
    document.getElementById('btn-mute').disabled = true;
}

function handleInitialState(data) {
    if (!data) return;
    
    const auxCodeId = data.auxCodeId?.trim() || '0';
    const state = data.state || 'Idle';
    const stateSelect = document.getElementById('sel-state');

    const stateOption = Array.from(stateSelect.options).find(opt =>
        (opt.dataset.isAux && opt.value === auxCodeId) ||
        (!opt.dataset.isAux && opt.text.toLowerCase() === state.toLowerCase())
    );
    
    if (stateOption) {
        stateSelect.value = stateOption.value;
    }
}
