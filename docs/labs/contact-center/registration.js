/**
 * Registration functionality for Contact Center SDK
 * Shows both simple window.webex usage and robust implementation
 */

/**
 * Register agent with Contact Center
 * Simple usage from lab.html:
 * const response = await window.webex.cc.register();
 * 
 * @param {Object} webex - Webex SDK instance
 * @returns {Promise<Object>} Registration response
 */
export async function register(webex) {
    try {
        const response = await webex.cc.register();
        /*
        Response includes:
        {
            teams: [{ id: '123', name: 'Support' }],
            loginVoiceOptions: ['BROWSER', 'AGENT_DN', 'EXTENSION'],
            webRtcEnabled: true,
            idleCodes: [{
                id: '07f1c9af-b86c-4a9b-a59a-347545303014',
                name: 'WellbeingBreak',
                isSystem: true,
                isDefault: false
            }],
            capabilities: {
                voice: true,
                chat: true,
                email: false
            },
            deviceType: 'BROWSER'
        }
        */
        console.log('Registration successful:', response);
        
        // Store key registration data for reuse
        window.agentRegistration = {
            teams: response.teams,
            deviceType: response.deviceType,
            capabilities: response.capabilities,
            idleCodes: response.idleCodes,
            wrapupCodes: response.wrapupCodes
        };

        return response;
    } catch (error) {
        console.error('Registration failed:', error);
        throw error;
    }
}

/**
 * Deregister agent from Contact Center
 * Simple usage from lab.html:
 * await window.webex.cc.deregister();
 * 
 * @param {Object} webex - Webex SDK instance 
 */
export async function deregister(webex) {
    try {
        await webex.cc.deregister();
        // Clean up stored registration data
        window.agentRegistration = null;
        console.log('Deregistration successful');
    } catch (error) {
        console.error('Deregistration failed:', error);
        throw error;
    }
}

/**
 * Handle registration response to set up UI elements
 * @param {Object} response - Registration response from server
 */
export function handleRegistrationResponse(response) {
    populateTeamsDropdown(response.teams);
    populateLoginOptions(response.loginVoiceOptions, response.webRtcEnabled);
    populateStateOptions(response.idleCodes);
    populateWrapupCodes(response.wrapupCodes);
}

// Helper to populate wrapup codes dropdown
function populateWrapupCodes(wrapupCodes) {
    if (!wrapupCodes) return;

    // Store wrapup codes globally for task manager
    window.wrapupCodes = wrapupCodes;

    // Populate wrapup codes dropdown
    const wrapupCodesDropdown = document.getElementById('wrapup-codes');
    if (wrapupCodesDropdown) {
        wrapupCodesDropdown.innerHTML = '<option value="" selected>Choose Wrapup Code...</option>';
        wrapupCodes.forEach(code => {
            const option = document.createElement('option');
            option.value = code.id;
            option.text = code.name;
            wrapupCodesDropdown.appendChild(option);
        });
    }
}

// Private helper functions
function populateTeamsDropdown(teams) {
    const teamsDropdown = document.getElementById('teamsDropdown');
    teamsDropdown.innerHTML = '<option value="" selected>Choose Team...</option>';

    teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.text = team.name;
        teamsDropdown.add(option);
    });
}

function populateLoginOptions(loginOptions, webRtcEnabled) {
    const agentLoginDropdown = document.getElementById('AgentLogin');
    agentLoginDropdown.innerHTML = '<option value="" selected>Choose Agent Login...</option>';

    // Filter options based on WebRTC availability
    const availableOptions = loginOptions.filter(
        opt => webRtcEnabled || opt !== 'BROWSER'
    );

    availableOptions.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.text = opt;
        agentLoginDropdown.add(option);
    });
}

function populateStateOptions(idleCodes) {
    const stateSelect = document.getElementById('sel-state');
    stateSelect.innerHTML = '<option value="">Choose State...</option>';

    // Add basic states group
    const statesGroup = document.createElement('optgroup');
    statesGroup.label = 'States';

    // Add Available state first
    const availableOption = document.createElement('option');
    availableOption.value = '0';
    availableOption.text = 'Available';
    availableOption.dataset.state = 'Available';
    statesGroup.appendChild(availableOption);

    // Add other idle codes
    idleCodes?.forEach((code) => {
        if (code.id !== '0') { // Skip Available since we added it first
            const option = document.createElement('option');
            option.value = code.id;
            option.text = code.name;
            option.dataset.state = code.name;
            option.dataset.isSystem = code.isSystem;
            option.dataset.isDefault = code.isDefault;
            statesGroup.appendChild(option);
        }
    });

    stateSelect.appendChild(statesGroup);
}
