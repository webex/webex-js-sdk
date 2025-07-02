/**
 * Main entry point that connects lab.html examples to our modular implementation
 */

import { initWithAccessToken, initOauth } from './auth.js';
import { register, deregister, handleRegistrationResponse } from './registration.js';
import { 
    handleAgentLogin, 
    handleStationLogin, 
    handleStationLogout,
    setupStationEventListeners 
} from './station-login.js';
import { 
    initializeStateUI, 
    setupStateEventListeners,
    handleStateChange 
} from './state-change.js';
import { 
    initializeTaskUI,
    setupTaskEventListeners,
    acceptTask,
    toggleHold,
    toggleMute
} from './task-manager.js';

// Button click handlers
const taskHandlers = {
    onAccept: async (task) => {
        try {
            await acceptTask(task);
            console.log('Task accepted successfully');
        } catch (error) {
            console.error('Failed to accept task:', error);
        }
    },
    onDecline: async (task) => {
        try {
            declineTask(task);
            console.log('Task declined successfully');
        } catch (error) {
            console.error('Failed to decline task:', error);
        }
    },
    onHold: async (task) => {
        try {
            await toggleHold(task);
            console.log('Hold/Resume successful');
        } catch (error) {
            console.error('Hold/Resume failed:', error);
        }
    },
    onMute: (task) => {
        try {
            toggleMute(task);
            console.log('Mute/Unmute successful');
        } catch (error) {
            console.error('Mute/Unmute failed:', error);
        }
    },
    onWrapup: async (task) => {
        try {
         submitWrapup(task);
            console.log('Wrapup successful');
        } catch (error) {
            console.error('Wrapup failed:', error);
        }
    }
};
import { setupCleanupHandlers } from './cleanup.js';

// Main initialization
async function init() {
    console.log('Initializing Contact Center SDK Lab...');

    // Initialize task UI with handlers
    initializeTaskUI(taskHandlers);

    // Get URL parameters for OAuth callback
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    
    if (accessToken) {
        try {
            window.webex = await initWithAccessToken(accessToken);
            console.log('✅ Authenticated with token successfully');
            enablePostAuthControls();
        } catch (e) {
            console.error('❌ Failed to initialize with access token:', e);
        }
    }

    // Initialize UI components
    initializeStateUI();

    // Wire up auth button handlers
    document.getElementById('btn-token-auth').onclick = handleTokenAuth;
    document.getElementById('btn-oauth').onclick = handleOAuth;

    // Wire up registration handlers
    document.getElementById('btn-register').onclick = handleRegister;
    document.getElementById('btn-deregister').onclick = handleDeregister;

    // Wire up state change handlers
    document.getElementById('sel-state')?.addEventListener('change', function() {
        const stateBtn = document.getElementById('btn-set-state');
        if (stateBtn) {
            stateBtn.disabled = !this.value;
        }
    });

    // Make handlers globally accessible for HTML
    window.handleAgentLogin = handleAgentLogin;
    window.handleStationLogin = () => handleStationLogin(window.webex);
    window.handleStationLogout = () => handleStationLogout(window.webex);
    window.handleStateChange = () => handleStateChange(window.webex);
    window.handleToggleHold = () => toggleHold(window.webex);
    window.handleToggleMute = () => toggleMute(window.webex);
    window.handleAcceptTask = () => acceptTask(window.webex);
}

// Auth handlers that match lab.html examples
async function handleTokenAuth() {
    const token = document.getElementById('access-token').value.trim();
    if (!token) {
        alert('Please enter an access token');
        return;
    }

    try {
        window.webex = await initWithAccessToken(token);
        console.log('✅ Authenticated with token successfully');
        enablePostAuthControls();
        document.getElementById('access-token').value = '';
    } catch (e) {
        console.error('❌ Token authentication failed:', e);
        alert('Failed to authenticate with token');
    }
}

async function handleOAuth() {
    try {
        window.webex = await initOauth();
        console.log('OAuth flow started...');
    } catch (e) {
        console.error('❌ OAuth authentication failed:', e);
    }
}

// Registration handlers
async function handleRegister() {
    try {
        const response = await register(window.webex);
        console.log('✅ Agent registered successfully');

        // Set up all event listeners
        setupTaskEventListeners(window.webex);
        setupStateEventListeners(window.webex);
        setupStationEventListeners(window.webex);
        setupCleanupHandlers(window.webex, window.deviceId);

        // Enable state controls after successful registration
        const stateSelect = document.getElementById('sel-state');
        if (stateSelect) {
            stateSelect.disabled = false;
            if (stateSelect.value) {
                document.getElementById('btn-set-state').disabled = false;
            }
        }

        // Handle registration response and enable controls
        handleRegistrationResponse(response);

        // Enable station controls
        document.getElementById('teamsDropdown').disabled = false;
        document.getElementById('AgentLogin').disabled = false;
        document.getElementById('loginStation').disabled = false;
        document.getElementById('btn-deregister').disabled = false;
    } catch (e) {
        console.error('❌ Registration failed:', e);
    }
}

async function handleDeregister() {
    try {
        await deregister(window.webex);
        console.log('✅ Agent deregistered successfully');
        disableControls();
    } catch (e) {
        console.error('❌ Deregistration failed:', e);
        alert(`Registration failed: ${e.message || 'Unknown error'}`);
    }
}

// UI Helpers
function enablePostAuthControls() {
    document.getElementById('btn-register').disabled = false;
}

function disableControls() {
    [
        'sel-state',
        'btn-set-state',
        'btn-deregister',
        'btn-accept',
        'btn-decline',
        'btn-hold',
        'btn-mute',
        'teamsDropdown',
        'AgentLogin',
        'loginStation'
    ].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.disabled = true;
    });

    // Hide logout button
    const logoutBtn = document.getElementById('logoutStation');
    if (logoutBtn) logoutBtn.classList.add('hidden');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
