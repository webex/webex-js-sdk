/**
 * Digital Channels module for Contact Center
 * Handles chat and email interactions through IMI Engage widget integration
 */

let isBundleLoaded = false;

/**
 * Initialize IMI Engage widget
 * @param {string} accessToken - The access token for authentication
 */
export function initializeEngageWidget(accessToken) {
  if (isBundleLoaded) {
    const config = {
      logger: console,
      cb: (name, data) => {
        const event = new CustomEvent(name, {
          detail: data,
        });
        window.dispatchEvent(event);
      },
    };

    const imiEngageWC = new window.ImiEngageWC(config);
    imiEngageWC.setParam("data", {
      jwt: accessToken,
      lang: "en-US",
      source: "wxcc",
    });
  } else {
    console.error("IMI Engage bundle not loaded");
  }
}

/**
 * Handle bundle loaded event
 */
export function handleBundleLoaded() {
  console.log("IMI Engage bundle has been loaded");
  isBundleLoaded = true;
}

/**
 * Load chat widget for a task
 * @param {Object} task - The chat task
 * @param {Object} params - Widget parameters
 */
export function loadChatWidget(task, { elementId = 'engageWidget', height = '500px' }) {
  const mediaId = task.data.interaction?.callAssociatedDetails?.mediaResourceId;
  if (!mediaId) {
    console.error('Missing mediaId for chat widget');
    return;
  }

  const containerElement = document.getElementById(elementId);
  if (!containerElement) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  containerElement.style.height = height;
  containerElement.innerHTML = `
    <imi-engage 
      theme="LIGHT" 
      lang="en-US" 
      conversationid="${mediaId}"
    ></imi-engage>
  `;
}

/**
 * Load email composer widget for a task
 * @param {Object} task - The email task
 * @param {Object} params - Widget parameters
 */
export function loadEmailWidget(task, { 
  elementId = 'engageWidget',
  height = '900px',
  agentName,
  agentId
}) {
  const mediaId = task.data.interaction?.callAssociatedDetails?.mediaResourceId;
  if (!mediaId) {
    console.error('Missing mediaId for email widget');
    return;
  }

  const containerElement = document.getElementById(elementId);
  if (!containerElement) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  containerElement.style.height = height;
  containerElement.innerHTML = `
    <imi-email-composer
      taskId="${mediaId}"
      orgId="${task.data.orgId}"
      agentName="${agentName}"
      agentId="${agentId}"
      interactionId="${task.data.interactionId}"
    ></imi-email-composer>
  `;
}

/**
 * Clear digital channel widget
 * @param {string} elementId - The widget container element ID
 */
export function clearWidget(elementId = 'engageWidget') {
  const containerElement = document.getElementById(elementId);
  if (containerElement) {
    containerElement.innerHTML = '';
    containerElement.style.height = '100px';
  }
}

/**
 * Handle digital channel task
 * @param {Object} task - The task to handle
 * @param {Object} agentInfo - Agent information for the widgets
 */
export function handleDigitalChannelTask(task, agentInfo = {}) {
  if (!isBundleLoaded) {
    console.error('IMI Engage bundle not loaded');
    return;
  }

  // Clear any existing widgets
  clearWidget();

  // Load appropriate widget based on task type
  if (!task.data.wrapUpRequired) {
    const mediaType = task.data.interaction.mediaType;
    
    if (['chat', 'social'].includes(mediaType)) {
      loadChatWidget(task, { height: '500px' });
    } else if (mediaType === 'email') {
      loadEmailWidget(task, { 
        height: '900px',
        agentName: agentInfo.agentName,
        agentId: agentInfo.agentId
      });
    }
  }
}

/**
 * Check if IMI Engage bundle is loaded
 * @returns {boolean} Bundle loaded status
 */
export function isEngageBundleLoaded() {
  return isBundleLoaded;
}

// Event listener for bundle load
document.addEventListener(
  "imi-engage-bundle-load-success",
  handleBundleLoaded
);
