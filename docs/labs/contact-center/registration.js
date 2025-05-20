/**
 * Registration module for Contact Center
 * Handles agent registration and WebSocket connection setup
 */

/**
 * Register the agent and set up WebSocket event listeners
 * @param {Object} webex - The initialized Webex instance
 * @returns {Promise} Resolves with the agent profile
 */
export async function register(webex) {
  try {
    const agentProfile = await webex.cc.register();
    console.log('Event subscription successful:', agentProfile);
    
    // Set up WebSocket event listeners
    setupWebSocketListeners(webex);
    
    return agentProfile;
  } catch (error) {
    console.error('Event subscription failed:', error);
    throw error;
  }
}

/**
 * Deregister the agent
 * @param {Object} webex - The initialized Webex instance
 * @returns {Promise} Resolves when deregistration is complete
 */
export async function deregister(webex) {
  try {
    await webex.cc.deregister();
    console.log('Deregistered successfully');
  } catch (error) {
    console.error('Deregister failed:', error);
    throw error;
  }
}

/**
 * Log in the agent with specific team and device settings
 * @param {Object} webex - The initialized Webex instance
 * @param {Object} params - Login parameters
 * @returns {Promise} Resolves with the login response
 */
export async function agentLogin(webex, { teamId, loginOption, dialNumber }) {
  try {
    const response = await webex.cc.stationLogin({
      teamId,
      loginOption,
      dialNumber
    });
    console.log('Agent logged in successfully:', response);
    return response;
  } catch (error) {
    console.error('Agent login failed:', error);
    throw error;
  }
}

/**
 * Log out the agent
 * @param {Object} webex - The initialized Webex instance
 * @returns {Promise} Resolves when logout is complete
 */
export async function agentLogout(webex) {
  try {
    await webex.cc.stationLogout({ logoutReason: 'logout' });
    console.log('Agent logged out successfully');
  } catch (error) {
    console.error('Agent logout failed:', error);
    throw error;
  }
}

/**
 * Update agent's device type settings
 * @param {Object} webex - The initialized Webex instance
 * @param {Object} params - Device type parameters
 * @returns {Promise} Resolves when update is complete
 */
export async function updateAgentDeviceType(webex, { loginOption, dialNumber }) {
  try {
    const response = await webex.cc.updateAgentDeviceType({
      loginOption,
      dialNumber
    });
    console.log('Profile updated successfully:', response);
    return response;
  } catch (error) {
    console.error('Profile update failed:', error);
    throw error;
  }
}

/**
 * Set up WebSocket event listeners for various agent events
 * @param {Object} webex - The initialized Webex instance
 */
function setupWebSocketListeners(webex) {
  // Agent state change events
  webex.cc.on('agent:stateChange', (data) => {
    if (data?.type === 'AgentStateChangeSuccess') {
      console.log('Agent state changed:', data);
    }
  });

  // Multiple login detection
  webex.cc.on('agent:multiLogin', (data) => {
    if (data?.type === 'AgentMultiLoginCloseSession') {
      console.warn('Multiple Agent Login Session Detected!');
    }
  });

  // Agent re-login events
  webex.cc.on('agent:reloginSuccess', (data) => {
    console.log('Agent re-login successful:', data);
  });

  // Station login events
  webex.cc.on('agent:stationLoginSuccess', (data) => {
    console.log('Agent station-login success:', data);
  });

  // Task events
  webex.cc.on('task:incoming', (task) => {
    console.log('Incoming task:', task);
  });

  webex.cc.on('task:hydrate', (task) => {
    console.log('Task hydrated:', task);
  });
}
