/**
 * Agent State module for Contact Center
 * Handles agent state management including status changes and idle codes
 */

let stateTimer = null;

/**
 * Set agent state
 * @param {Object} webex - The Webex instance
 * @param {Object} params - State change parameters
 * @returns {Promise} Resolves when state is set
 */
export async function setAgentState(webex, { state, auxCodeId, lastStateChangeReason, agentId }) {
  try {
    const response = await webex.cc.setAgentState({
      state,
      auxCodeId,
      lastStateChangeReason,
      agentId
    });
    console.log('Agent state set successfully:', response);
    return response;
  } catch (error) {
    console.error('Agent state set failed:', error);
    throw error;
  }
}

/**
 * Start state timer to track duration in current state
 * @param {string} lastStateChangeTimestamp - Timestamp of last state change
 * @param {string} lastIdleCodeChangeTimestamp - Timestamp of last idle code change
 */
export function startStateTimer(lastStateChangeTimestamp, lastIdleCodeChangeTimestamp) {
  if (lastStateChangeTimestamp === null) {
    return;
  }
  
  if (stateTimer) {
    clearInterval(stateTimer);
  }

  stateTimer = setInterval(() => {
    const currentTime = new Date().getTime();
    const stateTimeDifference = currentTime - new Date(lastStateChangeTimestamp).getTime();
    const idleCodeChangeTimeDifference = lastIdleCodeChangeTimestamp ? 
      currentTime - new Date(lastIdleCodeChangeTimestamp).getTime() : null;

    const stateHours = String(Math.floor(stateTimeDifference / (1000 * 60 * 60))).padStart(2, '0');
    const stateMinutes = String(Math.floor((stateTimeDifference % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
    const stateSeconds = String(Math.floor((stateTimeDifference % (1000 * 60)) / 1000)).padStart(2, '0');

    const timeDisplay = formatTimeDisplay(
      stateHours, 
      stateMinutes, 
      stateSeconds, 
      idleCodeChangeTimeDifference,
      lastStateChangeTimestamp,
      lastIdleCodeChangeTimestamp
    );

    // This would be implemented by the UI layer
    console.log('State timer:', timeDisplay);
  }, 1000);
}

/**
 * Stop the state timer
 */
export function stopStateTimer() {
  if (stateTimer) {
    clearInterval(stateTimer);
    stateTimer = null;
  }
}

/**
 * Get buddy agents for consultation
 * @param {Object} webex - The Webex instance
 * @param {string} mediaType - Media type filter
 * @returns {Promise<Array>} Resolves with list of buddy agents
 */
export async function getBuddyAgents(webex, mediaType = 'telephony') {
  try {
    const response = await webex.cc.getBuddyAgents({ mediaType });
    
    if (!response?.data?.agentList) {
      console.error('Failed to fetch buddy agents: Invalid response format');
      return [];
    }

    return response.data.agentList;
  } catch (error) {
    console.error('Failed to fetch buddy agents:', error);
    throw error;
  }
}

/**
 * Handle agent state rejection
 * @param {string} reason - Rejection reason
 * @param {Array} idleCodes - Available idle codes
 * @returns {Object} State reason details
 */
export function handleAgentStateRejection(reason) {
  let stateReason = '';
  
  switch (reason) {
    case 'USER_BUSY':
      stateReason = 'Agent declined call';
      break;
    case 'RONA_TIMER_EXPIRED':
      stateReason = 'Agent unavailable';
      break;
    default:
      stateReason = '';
  }

  return {
    reasonText: stateReason,
    requiresStateChange: Boolean(stateReason)
  };
}

/**
 * Format time display string
 * @private
 */
function formatTimeDisplay(
  stateHours, 
  stateMinutes, 
  stateSeconds, 
  idleCodeChangeTimeDifference,
  lastStateChangeTimestamp,
  lastIdleCodeChangeTimestamp
) {
  let timeDisplay = `${stateHours}:${stateMinutes}:${stateSeconds}`;

  if (idleCodeChangeTimeDifference !== null && lastStateChangeTimestamp !== lastIdleCodeChangeTimestamp) {
    const idleCodeChangeHours = String(Math.floor(idleCodeChangeTimeDifference / (1000 * 60 * 60))).padStart(2, '0');
    const idleCodeChangeMinutes = String(Math.floor((idleCodeChangeTimeDifference % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
    const idleCodeChangeSeconds = String(Math.floor((idleCodeChangeTimeDifference % (1000 * 60)) / 1000)).padStart(2, '0');

    timeDisplay = `${idleCodeChangeHours}:${idleCodeChangeMinutes}:${idleCodeChangeSeconds} / ${timeDisplay}`;
  }

  return timeDisplay;
}

/**
 * Get the current state timer
 * @returns {number|null} Current state timer
 */
export function getStateTimer() {
  return stateTimer;
}
